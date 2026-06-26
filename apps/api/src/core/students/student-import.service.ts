import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { TNPT_36_COMBOS } from '@vnu/shared-types';
import { Student } from '../../database/entities/student.entity';
import { Class } from '../../database/entities/class.entity';
import { School } from '../../database/entities/school.entity';
import { StudentSession } from '../../database/entities/student-session.entity';

const VALID_COMBO_CODES = new Set(TNPT_36_COMBOS.map((c) => c.comboCode));
const MAX_IMPORT_ROWS = 500;

const TEMPLATE_HEADERS = [
  'Họ tên',
  'Mã học sinh',
  'Lớp',
  'Mã tổ hợp',
  'Nhóm môn',
  'Ghi chú',
];

@Injectable()
export class StudentImportService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Class)
    private readonly classRepo: Repository<Class>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
    @InjectRepository(StudentSession)
    private readonly studentSessionRepo: Repository<StudentSession>,
  ) {}

  async buildTemplateBuffer(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    const sheet = workbook.addWorksheet('Danh sách thí sinh');
    sheet.columns = TEMPLATE_HEADERS.map((header) => ({
      header,
      key: header,
      width: 20,
    }));
    sheet.getRow(1).font = { bold: true };
    sheet.addRow(['Nguyễn Văn A', 'HS001', '12A1', 'A00', 'MATH', '']);

    const comboSheet = workbook.addWorksheet('Tổ hợp TN THPT');
    comboSheet.addRow(['Mã tổ hợp', 'Tên tổ hợp', 'Môn thi', 'Khối xét tuyển']);
    comboSheet.getRow(1).font = { bold: true };
    comboSheet.columns = [
      { width: 14 },
      { width: 36 },
      { width: 48 },
      { width: 18 },
    ];
    for (const combo of TNPT_36_COMBOS) {
      comboSheet.addRow([
        combo.comboCode,
        combo.comboName,
        combo.subjects.join(', '),
        combo.admissionBlocks.join(', '),
      ]);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async listStudents(className?: string, comboCode?: string) {
    const qb = this.studentRepo
      .createQueryBuilder('student')
      .leftJoinAndSelect('student.class', 'class')
      .leftJoinAndSelect('student.school', 'school')
      .orderBy('student.fullName', 'ASC');

    if (className) {
      qb.andWhere('class.name = :className', { className });
    }
    if (comboCode) {
      qb.andWhere('student.comboCode = :comboCode', { comboCode });
    }

    return qb.getMany().then((rows) =>
      rows.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        studentCode: s.studentCode,
        comboCode: s.comboCode,
        subjectGroup: s.subjectGroup,
        className: s.class?.name,
      })),
    );
  }

  async importFromBuffer(buffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException('File Excel không có sheet dữ liệu');
    }

    const headerMap = this.parseHeaderMap(sheet.getRow(1));
    const dataRowCount = Math.max(0, sheet.rowCount - 1);
    if (dataRowCount > MAX_IMPORT_ROWS) {
      throw new BadRequestException(`Tối đa ${MAX_IMPORT_ROWS} dòng dữ liệu mỗi file`);
    }

    const school = await this.resolveSchool();
    let created = 0;
    let updated = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (let rowNum = 2; rowNum <= sheet.rowCount; rowNum++) {
      const values = this.rowToRecord(sheet.getRow(rowNum), headerMap);
      if (this.isEmptyRow(values)) continue;

      try {
        const fullName = values['Họ tên']?.trim();
        const studentCode = values['Mã học sinh']?.trim();
        const className = values['Lớp']?.trim();
        const comboCode = values['Mã tổ hợp']?.trim().toUpperCase() || undefined;
        const subjectGroup = values['Nhóm môn']?.trim().toUpperCase() || undefined;

        if (!fullName) throw new Error('Thiếu Họ tên');
        if (!studentCode) throw new Error('Thiếu Mã học sinh');
        if (comboCode && !VALID_COMBO_CODES.has(comboCode)) {
          throw new Error(`Mã tổ hợp không hợp lệ: ${comboCode}`);
        }

        let classId: string | undefined;
        if (className) {
          const cls = await this.findOrCreateClass(className, school.id);
          classId = cls.id;
        }

        const existing = await this.studentRepo.findOne({ where: { studentCode } });
        if (existing) {
          await this.studentRepo.update(existing.id, {
            fullName,
            comboCode: comboCode ?? undefined,
            subjectGroup: subjectGroup ?? undefined,
            classId: classId ?? existing.classId,
            schoolId: school.id,
          });
          updated++;
        } else {
          await this.studentRepo.save(
            this.studentRepo.create({
              fullName,
              studentCode,
              comboCode,
              subjectGroup,
              classId,
              schoolId: school.id,
            }),
          );
          created++;
        }
      } catch (err) {
        errors.push({
          row: rowNum,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { created, updated, errors };
  }

  async deleteStudent(id: string) {
    const student = await this.studentRepo.findOne({ where: { id } });
    if (!student) throw new NotFoundException('Student not found');

    const sessionCount = await this.studentSessionRepo.count({
      where: { studentId: id },
    });
    if (sessionCount > 0) {
      throw new BadRequestException('Không thể xóa thí sinh đã có phiên thi');
    }

    await this.studentRepo.delete(id);
    return { deleted: true };
  }

  private async resolveSchool(): Promise<School> {
    let school = await this.schoolRepo.findOne({
      where: {},
      order: { createdAt: 'ASC' },
    });
    if (!school) {
      school = await this.schoolRepo.save(
        this.schoolRepo.create({ name: 'THPT Demo VNU', code: 'VNU001' }),
      );
    }
    return school;
  }

  private async findOrCreateClass(name: string, schoolId: string): Promise<Class> {
    let cls = await this.classRepo.findOne({ where: { name, schoolId } });
    if (!cls) {
      const gradeMatch = name.match(/^(\d+)/);
      cls = await this.classRepo.save(
        this.classRepo.create({
          name,
          schoolId,
          grade: gradeMatch?.[1],
        }),
      );
    }
    return cls;
  }

  private parseHeaderMap(headerRow: ExcelJS.Row): Map<number, string> {
    const map = new Map<number, string>();
    headerRow.eachCell((cell, colNumber) => {
      const val = String(cell.value ?? '').trim();
      if (val) map.set(colNumber, val);
    });
    return map;
  }

  private rowToRecord(
    row: ExcelJS.Row,
    headerMap: Map<number, string>,
  ): Record<string, string> {
    const record: Record<string, string> = {};
    headerMap.forEach((header, colNumber) => {
      const cell = row.getCell(colNumber);
      record[header] = cell.value != null ? String(cell.value).trim() : '';
    });
    return record;
  }

  private isEmptyRow(values: Record<string, string>): boolean {
    return Object.values(values).every((v) => !v.trim());
  }
}
