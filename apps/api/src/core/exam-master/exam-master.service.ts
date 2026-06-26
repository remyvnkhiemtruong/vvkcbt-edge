import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In } from 'typeorm';
import * as ExcelJS from 'exceljs';
import {
  TN_THPT_SUBJECTS,
  TNPT_36_COMBOS,
  ExamType,
  ExamRules,
  getSubjectNameVi,
} from '@vnu/shared-types';
import { ExamSession } from '../../database/entities/exam-session.entity';
import { Student } from '../../database/entities/student.entity';
import { Class } from '../../database/entities/class.entity';
import { School } from '../../database/entities/school.entity';
import { StudentSubjectSlot } from '../../database/entities/student-subject-slot.entity';
import { StudentSession } from '../../database/entities/student-session.entity';

const MAX_IMPORT_ROWS = 500;
const CONFIG_SHEET = 'CauHinhKyThi';
const STUDENT_SHEET = 'DanhSachThiSinh';
const GUIDE_SHEET = 'HuongDan';
const RESULT_SHEET = 'KetQua';
const SCHEDULE_HEADER_ROW = 18;

const SUBJECT_BY_NAME = new Map(TN_THPT_SUBJECTS.map((s) => [s.nameVi, s.code]));
const NAME_BY_CODE = new Map(TN_THPT_SUBJECTS.map((s) => [s.code, s.nameVi]));
const MANDATORY_SUBJECTS = TN_THPT_SUBJECTS.filter((s) => s.mandatory).map((s) => s.code);

export interface MasterImportResult {
  students: { created: number; updated: number };
  slots: { created: number; updated: number; removed: number };
  sessionUpdated: boolean;
  errors: Array<{ row: number; message: string; sheet?: string }>;
}

interface SubjectScheduleRow {
  subjectCode: string;
  examDate: Date;
  startTime: string;
  endTime: string;
  durationMin: number;
  structureMode: 'default' | 'custom';
}

@Injectable()
export class ExamMasterService {
  constructor(
    @InjectRepository(ExamSession)
    private readonly sessionRepo: Repository<ExamSession>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Class)
    private readonly classRepo: Repository<Class>,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
    @InjectRepository(StudentSubjectSlot)
    private readonly slotRepo: Repository<StudentSubjectSlot>,
    @InjectRepository(StudentSession)
    private readonly studentSessionRepo: Repository<StudentSession>,
    private readonly dataSource: DataSource,
  ) {}

  async buildTemplateBuffer(examSessionId: string): Promise<Buffer> {
    const session = await this.sessionRepo.findOne({ where: { id: examSessionId } });
    if (!session) throw new NotFoundException('Exam session not found');

    const workbook = new ExcelJS.Workbook();
    this.buildConfigSheet(workbook, session);
    await this.buildStudentSheet(workbook, examSessionId, false);
    this.buildGuideSheet(workbook);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async exportMaster(examSessionId: string): Promise<Buffer> {
    const session = await this.sessionRepo.findOne({ where: { id: examSessionId } });
    if (!session) throw new NotFoundException('Exam session not found');

    const workbook = new ExcelJS.Workbook();
    this.buildConfigSheet(workbook, session);
    await this.buildStudentSheet(workbook, examSessionId, true);
    await this.buildResultSheet(workbook, examSessionId);
    this.buildGuideSheet(workbook);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async importFromBuffer(examSessionId: string, buffer: Buffer): Promise<MasterImportResult> {
    const session = await this.sessionRepo.findOne({ where: { id: examSessionId } });
    if (!session) throw new NotFoundException('Exam session not found');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const configSheet = workbook.getWorksheet(CONFIG_SHEET);
    const studentSheet = workbook.getWorksheet(STUDENT_SHEET) ?? workbook.worksheets[0];
    if (!studentSheet) {
      throw new BadRequestException('File Excel thiếu sheet DanhSachThiSinh');
    }

    const isClosed = session.status === 'closed';
    const config = configSheet && !isClosed ? this.parseConfigSheet(configSheet) : null;
    const schedule = configSheet && !isClosed ? this.parseScheduleTable(configSheet) : new Map<string, SubjectScheduleRow>();
    const defaultSchedule = this.defaultScheduleForSession(session);

    const headerMap = this.parseHeaderMap(studentSheet.getRow(1));
    const subjectCols = this.resolveSubjectColumns(headerMap);
    const dataRowCount = Math.max(0, studentSheet.rowCount - 1);
    if (dataRowCount > MAX_IMPORT_ROWS) {
      throw new BadRequestException(`Tối đa ${MAX_IMPORT_ROWS} dòng dữ liệu mỗi file`);
    }

    const errors: MasterImportResult['errors'] = [];
    const parsedStudents: Array<{
      row: number;
      fullName: string;
      studentCode: string;
      className?: string;
      sbd?: string;
      dateOfBirth?: string;
      gender?: string;
      subjects: Set<string>;
      note?: string;
    }> = [];

    for (let rowNum = 2; rowNum <= studentSheet.rowCount; rowNum++) {
      const values = this.rowToRecord(studentSheet.getRow(rowNum), headerMap);
      if (this.isEmptyRow(values)) continue;

      const fullName = this.pickField(values, ['Họ tên', 'Tên', 'Ho ten'])?.trim();
      const sbd = this.pickField(values, ['SBD', 'sbd'])?.trim() || undefined;
      const studentCode =
        this.pickField(values, ['Mã học sinh', 'Mã HS', 'Ma hoc sinh', 'studentCode'])?.trim() ||
        sbd ||
        `HS${rowNum - 1}`;
      const className = this.pickField(values, ['Lớp', 'Lop', 'className'])?.trim() || undefined;
      const dateOfBirth = this.formatDobForExport(
        this.pickField(values, ['Ngày sinh', 'Ngay sinh', 'dateOfBirth']),
      );
      const gender = this.normalizeGender(
        this.pickField(values, ['Giới tính', 'Gioi tinh', 'gender']),
      );

      if (!fullName) {
        errors.push({ row: rowNum, sheet: STUDENT_SHEET, message: 'Thiếu Họ tên' });
        continue;
      }

      const subjects = new Set<string>();
      for (const [header, code] of subjectCols) {
        if (this.isMarkedX(values[header] ?? '')) subjects.add(code);
      }

      for (const mandatory of MANDATORY_SUBJECTS) {
        if (!subjects.has(mandatory)) {
          errors.push({
            row: rowNum,
            sheet: STUDENT_SHEET,
            message: `Thiếu đăng ký môn bắt buộc: ${getSubjectNameVi(mandatory)}`,
          });
        }
      }

      parsedStudents.push({
        row: rowNum,
        fullName,
        studentCode,
        className,
        sbd,
        dateOfBirth,
        gender,
        subjects,
        note: values['Ghi chú']?.trim(),
      });
    }

    if (errors.length > 0) {
      return {
        students: { created: 0, updated: 0 },
        slots: { created: 0, updated: 0, removed: 0 },
        sessionUpdated: false,
        errors,
      };
    }

    const school = await this.resolveSchool();
    let studentsCreated = 0;
    let studentsUpdated = 0;
    let slotsCreated = 0;
    let slotsUpdated = 0;
    let slotsRemoved = 0;
    let sessionUpdated = false;

    await this.dataSource.transaction(async (manager) => {
      if (config && !isClosed) {
        const rules = this.mergeConfigIntoRules(session.rules ?? this.defaultRules(), config, schedule);
        const updates: Partial<ExamSession> = {
          name: config.tenKyThi ?? session.name,
          routingMode: config.cheDoDinhTuyen ?? session.routingMode,
          status: config.trangThai ?? session.status,
          rules,
        };
        if (schedule.size > 0) {
          const first = [...schedule.values()].sort((a, b) => a.examDate.getTime() - b.examDate.getTime())[0];
          if (first) {
            updates.startAt = this.combineDateAndTime(first.examDate, first.startTime);
          }
        }
        await manager.getRepository(ExamSession).update(examSessionId, updates as never);
        sessionUpdated = true;
      }

      const studentRepo = manager.getRepository(Student);
      const classRepo = manager.getRepository(Class);
      const slotRepo = manager.getRepository(StudentSubjectSlot);

      for (const row of parsedStudents) {
        let classId: string | undefined;
        if (row.className) {
          const cls = await this.findOrCreateClass(row.className, school.id, classRepo);
          classId = cls.id;
        }

        let student = await studentRepo.findOne({ where: { studentCode: row.studentCode } });
        if (student) {
          await studentRepo.update(student.id, {
            fullName: row.fullName,
            classId: classId ?? student.classId,
            schoolId: school.id,
          });
          studentsUpdated++;
        } else {
          student = await studentRepo.save(
            studentRepo.create({
              fullName: row.fullName,
              studentCode: row.studentCode,
              classId,
              schoolId: school.id,
            }),
          );
          studentsCreated++;
        }

        const existingSlots = await slotRepo.find({
          where: { studentId: student.id, examSessionId },
        });
        const existingBySubject = new Map(existingSlots.map((s) => [s.subjectCode, s]));

        for (const subjectCode of row.subjects) {
          const sched = schedule.get(subjectCode) ?? defaultSchedule.get(subjectCode);
          if (!sched) continue;

          const start = this.combineDateAndTime(sched.examDate, sched.startTime);
          const end = this.combineDateAndTime(sched.examDate, sched.endTime);
          if (end <= start) {
            throw new BadRequestException(
              `Lịch môn ${getSubjectNameVi(subjectCode)}: giờ kết thúc phải sau giờ bắt đầu`,
            );
          }

          const existing = existingBySubject.get(subjectCode);
          if (existing) {
            if (existing.status !== 'completed') {
              await slotRepo.update(existing.id, {
                scheduledStart: start,
                scheduledEnd: end,
                status: existing.status === 'open' ? 'open' : 'scheduled',
              });
              slotsUpdated++;
            }
            existingBySubject.delete(subjectCode);
          } else {
            await slotRepo.save(
              slotRepo.create({
                studentId: student.id,
                examSessionId,
                subjectCode,
                structureTemplateId: null,
                scheduledStart: start,
                scheduledEnd: end,
                status: 'scheduled',
              }),
            );
            slotsCreated++;
          }
        }

        for (const [, orphan] of existingBySubject) {
          if (orphan.status !== 'completed') {
            await slotRepo.delete(orphan.id);
            slotsRemoved++;
          }
        }
      }
    });

    return {
      students: { created: studentsCreated, updated: studentsUpdated },
      slots: { created: slotsCreated, updated: slotsUpdated, removed: slotsRemoved },
      sessionUpdated,
      errors: [],
    };
  }

  private buildConfigSheet(workbook: ExcelJS.Workbook, session: ExamSession) {
    const sheet = workbook.addWorksheet(CONFIG_SHEET);
    const rules = session.rules ?? this.defaultRules();
    const proctoring = rules.proctoring ?? { max_focus_violations: 3, autosave_interval_sec: 3 };
    const audio = rules.audio ?? { max_plays: 2, seek_disabled: true };

    const kv: Array<[string, string | number]> = [
      ['TenKyThi', session.name],
      ['CheDoDinhTuyen', session.routingMode],
      ['TrangThai', session.status],
      ['TenTruong', process.env.SCHOOL_NAME ?? 'THPT Demo VNU'],
      ['PhongThi', process.env.EDGE_ROOM_NAME ?? 'Phòng máy số 1'],
      ['SucChuaPhong', Number(process.env.EDGE_ROOM_CAPACITY ?? 30)],
      ['SoLanViPhamFocus', proctoring.max_focus_violations],
      ['AutosaveGiay', proctoring.autosave_interval_sec],
      ['AudioMaxPhat', audio.max_plays],
    ];

    kv.forEach(([key, val], i) => {
      sheet.getCell(i + 1, 1).value = key;
      sheet.getCell(i + 1, 2).value = val;
    });
    sheet.getColumn(1).width = 22;
    sheet.getColumn(2).width = 36;

    const headers = [
      'Mã môn',
      'Tên môn',
      'Ngày thi',
      'Giờ bắt đầu',
      'Giờ kết thúc',
      'Thời lượng phút',
      'Cấu trúc đề',
    ];
    const headerRow = sheet.getRow(SCHEDULE_HEADER_ROW);
    headers.forEach((h, i) => {
      headerRow.getCell(i + 1).value = h;
    });
    headerRow.font = { bold: true };

    const baseDate = session.startAt ?? new Date();
    TN_THPT_SUBJECTS.forEach((subj, idx) => {
      const row = sheet.getRow(SCHEDULE_HEADER_ROW + 1 + idx);
      const sessionSubj = rules.subjects?.find((s) => s.code === subj.code);
      const startH = 7 + Math.floor(idx * 2);
      const endH = startH + Math.ceil(subj.durationMin / 60);
      row.getCell(1).value = subj.code;
      row.getCell(2).value = subj.nameVi;
      row.getCell(3).value = this.formatDateOnly(baseDate);
      row.getCell(4).value = `${String(startH).padStart(2, '0')}:30`;
      row.getCell(5).value = `${String(endH).padStart(2, '0')}:00`;
      row.getCell(6).value = subj.durationMin;
      row.getCell(7).value = sessionSubj?.structureMode ?? 'default';
    });
  }

  private async buildStudentSheet(
    workbook: ExcelJS.Workbook,
    examSessionId: string,
    includeScores: boolean,
  ) {
    const sheet = workbook.addWorksheet(STUDENT_SHEET);
    const baseHeaders = [
      'Họ tên',
      'SBD',
      'Lớp',
      'Ngày sinh',
      'Giới tính',
      ...TN_THPT_SUBJECTS.map((s) => s.nameVi),
      'Ghi chú',
    ];
    const scoreHeaders = includeScores
      ? [
          ...TN_THPT_SUBJECTS.map((s) => `Điểm ${s.nameVi}`),
          'Tổng điểm',
          'Trạng thái',
        ]
      : [];
    const headers = [...baseHeaders, ...scoreHeaders];

    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
    headers.forEach((_, i) => {
      sheet.getColumn(i + 1).width = i < 3 ? 18 : 12;
    });

    const slots = await this.slotRepo.find({
      where: { examSessionId },
      relations: ['student', 'student.class'],
    });
    const studentIds = [...new Set(slots.map((s) => s.studentId))];
    const sessions = studentIds.length
      ? await this.studentSessionRepo.find({
          where: studentIds.map((sid) => ({ examSessionId, studentId: sid })) as never,
        })
      : [];
    const sbdByStudent = new Map(
      sessions.filter((s) => s.studentId).map((s) => [s.studentId!, s.sbd]),
    );

    const slotsByStudent = new Map<string, StudentSubjectSlot[]>();
    for (const slot of slots) {
      const list = slotsByStudent.get(slot.studentId) ?? [];
      list.push(slot);
      slotsByStudent.set(slot.studentId, list);
    }

    const students = studentIds.length
      ? await this.studentRepo.find({
          where: { id: In(studentIds) },
          relations: ['class'],
          order: { fullName: 'ASC' },
        })
      : [];

    for (const student of students) {
      const studentSlots = slotsByStudent.get(student.id) ?? [];
      const slotBySubject = new Map(studentSlots.map((s) => [s.subjectCode, s]));
      const row: (string | number)[] = [
        student.fullName,
        sbdByStudent.get(student.id) ?? '',
        student.class?.name ?? '',
        '',
        '',
      ];

      for (const subj of TN_THPT_SUBJECTS) {
        row.push(slotBySubject.has(subj.code) ? 'X' : '');
      }
      row.push('');

      if (includeScores) {
        let total = 0;
        let completedCount = 0;
        for (const subj of TN_THPT_SUBJECTS) {
          const slot = slotBySubject.get(subj.code);
          if (slot?.scoreResult && typeof slot.scoreResult.total === 'number') {
            row.push(slot.scoreResult.total);
            total += slot.scoreResult.total;
            completedCount++;
          } else {
            row.push('');
          }
        }
        row.push(completedCount > 0 ? Math.round(total * 100) / 100 : '');
        const allDone =
          studentSlots.length > 0 && studentSlots.every((s) => s.status === 'completed');
        row.push(allDone ? 'Hoàn thành' : completedCount > 0 ? 'Đang thi' : 'Chưa thi');
        void sbdByStudent.get(student.id);
      }

      sheet.addRow(row);
    }

    if (students.length === 0) {
      const sample: (string | number)[] = ['Nguyễn Văn A', '1001', '12A1', '15/03/2008', 'Nam'];
      for (const subj of TN_THPT_SUBJECTS) {
        sample.push(subj.mandatory ? 'X' : '');
      }
      sample.push('');
      sheet.addRow(sample);
    }
  }

  private async buildResultSheet(workbook: ExcelJS.Workbook, examSessionId: string) {
    const sheet = workbook.addWorksheet(RESULT_SHEET);
    const headers = [
      'SBD',
      'Mã HS',
      'Họ tên',
      'Mã môn',
      'Tên môn',
      'Điểm',
      'Chi tiết từng câu',
      'Nộp lúc',
      'Vi phạm',
    ];
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };

    const slots = await this.slotRepo.find({
      where: { examSessionId },
      relations: ['student'],
      order: { submittedAt: 'ASC' },
    });

    const studentIds = [...new Set(slots.map((s) => s.studentId))];
    const sessions = studentIds.length
      ? await this.studentSessionRepo
          .createQueryBuilder('ss')
          .where('ss.exam_session_id = :examSessionId', { examSessionId })
          .andWhere('ss.student_id IN (:...ids)', { ids: studentIds })
          .getMany()
      : [];
    const sbdByStudent = new Map(
      sessions.filter((s) => s.studentId).map((s) => [s.studentId!, s.sbd]),
    );

    for (const slot of slots) {
      if (!slot.scoreResult) continue;
      const student = slot.student;
      const total = typeof slot.scoreResult.total === 'number' ? slot.scoreResult.total : '';
      sheet.addRow([
        sbdByStudent.get(slot.studentId) ?? '',
        student?.studentCode ?? '',
        student?.fullName ?? '',
        slot.subjectCode,
        getSubjectNameVi(slot.subjectCode),
        total,
        JSON.stringify(slot.scoreResult.breakdown ?? []),
        slot.submittedAt ? slot.submittedAt.toISOString() : '',
        slot.violationCount ?? 0,
      ]);
    }
  }

  private buildGuideSheet(workbook: ExcelJS.Workbook) {
    const sheet = workbook.addWorksheet(GUIDE_SHEET);
    sheet.addRow(['HƯỚNG DẪN ĐIỀN FILE KỲ THI MASTER']);
    sheet.addRow([]);
    sheet.addRow(['1. Sheet CauHinhKyThi: cấu hình ca thi và lịch từng môn (11 môn TN THPT).']);
    sheet.addRow(['2. Sheet DanhSachThiSinh: Họ tên, SBD, Lớp, Ngày sinh, Giới tính + X ở cột môn.']);
    sheet.addRow(['3. Bắt buộc: mọi thí sinh phải có X ở Ngữ văn và Toán.']);
    sheet.addRow(['4. Giá trị đăng ký hợp lệ: X, x, 1, ✓']);
    sheet.addRow(['5. Sheet KetQua chỉ xuất hiện khi xuất file sau thi — không import.']);
    sheet.addRow([]);
    sheet.addRow(['11 MÔN TN THPT']);
    sheet.addRow(['Mã môn', 'Tên môn', 'Bắt buộc']);
    TN_THPT_SUBJECTS.forEach((s) => {
      sheet.addRow([s.code, s.nameVi, s.mandatory ? 'Có' : '']);
    });
    sheet.addRow([]);
    sheet.addRow(['36 TỔ HỢP THAM KHẢO (không dùng khi import)']);
    sheet.addRow(['Mã tổ hợp', 'Tên tổ hợp', 'Môn thi']);
    for (const combo of TNPT_36_COMBOS) {
      sheet.addRow([combo.comboCode, combo.comboName, combo.subjects.join(', ')]);
    }
    sheet.getColumn(1).width = 16;
    sheet.getColumn(2).width = 40;
    sheet.getColumn(3).width = 48;
  }

  private parseConfigSheet(sheet: ExcelJS.Worksheet) {
    const getVal = (key: string) => {
      for (let r = 1; r <= 15; r++) {
        const k = String(sheet.getRow(r).getCell(1).value ?? '').trim();
        if (k === key) return String(sheet.getRow(r).getCell(2).value ?? '').trim();
      }
      return '';
    };

    return {
      tenKyThi: getVal('TenKyThi') || undefined,
      cheDoDinhTuyen: getVal('CheDoDinhTuyen') || undefined,
      trangThai: getVal('TrangThai') || undefined,
      tenTruong: getVal('TenTruong') || undefined,
      phongThi: getVal('PhongThi') || undefined,
      sucChuaPhong: Number(getVal('SucChuaPhong')) || undefined,
      soLanViPhamFocus: Number(getVal('SoLanViPhamFocus')) || undefined,
      autosaveGiay: Number(getVal('AutosaveGiay')) || undefined,
      audioMaxPhat: Number(getVal('AudioMaxPhat')) || undefined,
    };
  }

  private parseScheduleTable(sheet: ExcelJS.Worksheet): Map<string, SubjectScheduleRow> {
    const map = new Map<string, SubjectScheduleRow>();
    for (let r = SCHEDULE_HEADER_ROW + 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const code = String(row.getCell(1).value ?? '').trim().toUpperCase();
      if (!code) continue;
      const meta = TN_THPT_SUBJECTS.find((s) => s.code === code);
      if (!meta) continue;

      const examDate = this.parseCellDate(row.getCell(3).value);
      const startTime = this.parseCellTime(row.getCell(4).value) ?? '07:30';
      const endTime = this.parseCellTime(row.getCell(5).value) ?? '09:00';
      const durationMin = Number(row.getCell(6).value) || meta.durationMin;
      const structureRaw = String(row.getCell(7).value ?? 'default').trim().toLowerCase();
      const structureMode: 'default' | 'custom' =
        structureRaw === 'custom' ? 'custom' : 'default';

      map.set(code, {
        subjectCode: code,
        examDate: examDate ?? new Date(),
        startTime,
        endTime,
        durationMin,
        structureMode,
      });
    }
    return map;
  }

  private mergeConfigIntoRules(
    rules: ExamRules,
    config: ReturnType<ExamMasterService['parseConfigSheet']>,
    schedule: Map<string, SubjectScheduleRow>,
  ): ExamRules {
    const merged: ExamRules = {
      ...rules,
      exam_type: ExamType.TN_THPT_2025,
      proctoring: { ...rules.proctoring },
      audio: { ...(rules.audio ?? { max_plays: 2, seek_disabled: true }) },
      subjects: [...(rules.subjects ?? [])],
    };

    if (config.soLanViPhamFocus) merged.proctoring.max_focus_violations = config.soLanViPhamFocus;
    if (config.autosaveGiay) merged.proctoring.autosave_interval_sec = config.autosaveGiay;
    if (config.audioMaxPhat) merged.audio!.max_plays = config.audioMaxPhat;

    if (schedule.size > 0) {
      merged.subjects = TN_THPT_SUBJECTS.map((meta) => {
        const sched = schedule.get(meta.code);
        const existing = rules.subjects?.find((s) => s.code === meta.code);
        return {
          code: meta.code,
          weight: existing?.weight ?? (meta.mandatory ? 2 : 1),
          structureMode: sched?.structureMode ?? existing?.structureMode ?? 'default',
          ui_mode: meta.uiMode,
          ...(sched?.durationMin ? { overrides: { durationMin: sched.durationMin } } : {}),
        };
      });
    }

    return merged;
  }

  private defaultScheduleForSession(session: ExamSession): Map<string, SubjectScheduleRow> {
    const base = session.startAt ?? new Date();
    const map = new Map<string, SubjectScheduleRow>();
    TN_THPT_SUBJECTS.forEach((meta, idx) => {
      const startH = 7 + idx * 2;
      map.set(meta.code, {
        subjectCode: meta.code,
        examDate: base,
        startTime: `${String(startH).padStart(2, '0')}:30`,
        endTime: `${String(startH + 2).padStart(2, '0')}:00`,
        durationMin: meta.durationMin,
        structureMode: 'default',
      });
    });
    return map;
  }

  private pickField(values: Record<string, string>, keys: string[]): string {
    for (const k of keys) {
      if (values[k] != null && values[k] !== '') return values[k];
    }
    return '';
  }

  private normalizeGender(raw?: string): string | undefined {
    const v = (raw ?? '').trim().toLowerCase();
    if (!v) return undefined;
    if (v === 'nam' || v === 'm' || v === 'male') return 'Nam';
    if (v === 'nữ' || v === 'nu' || v === 'n' || v === 'female' || v === 'f') return 'Nữ';
    return raw?.trim();
  }

  private formatDobForExport(raw?: string): string | undefined {
    const s = (raw ?? '').trim();
    if (!s) return undefined;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const dmY = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
    if (dmY) {
      return `${dmY[3]}-${dmY[2].padStart(2, '0')}-${dmY[1].padStart(2, '0')}`;
    }
    return s;
  }

  private resolveSubjectColumns(headerMap: Map<number, string>): Map<string, string> {
    const cols = new Map<string, string>();
    headerMap.forEach((header) => {
      const code = SUBJECT_BY_NAME.get(header);
      if (code) cols.set(header, code);
    });
    return cols;
  }

  private isMarkedX(val: string): boolean {
    const v = val.trim().toLowerCase();
    return v === 'x' || v === '1' || v === '✓' || v === '√' || v === 'yes' || v === 'có';
  }

  private defaultRules(): ExamRules {
    return {
      exam_type: ExamType.TN_THPT_2025,
      structure: { source: 'QD764', is_custom: false },
      cognitive_distribution: { nhan_biet: 0.4, thong_hieu: 0.3, van_dung: 0.3 },
      subjects: TN_THPT_SUBJECTS.map((s) => ({
        code: s.code,
        structureMode: 'default' as const,
        ui_mode: s.uiMode,
      })),
      scoring: {
        true_false_branch: { '1': 0.1, '2': 0.25, '3': 0.5, '4': 1.0 },
        short_answer_normalize: ['comma_to_dot', 'trim_whitespace'],
      },
      proctoring: { max_focus_violations: 3, autosave_interval_sec: 3 },
      audio: { max_plays: 2, seek_disabled: true },
    };
  }

  private async resolveSchool(): Promise<School> {
    let school = await this.schoolRepo.findOne({ where: {}, order: { createdAt: 'ASC' } });
    if (!school) {
      school = await this.schoolRepo.save(
        this.schoolRepo.create({ name: 'THPT Demo VNU', code: 'VNU001' }),
      );
    }
    return school;
  }

  private async findOrCreateClass(
    name: string,
    schoolId: string,
    classRepo: Repository<Class>,
  ): Promise<Class> {
    let cls = await classRepo.findOne({ where: { name, schoolId } });
    if (!cls) {
      const gradeMatch = name.match(/^(\d+)/);
      cls = await classRepo.save(
        classRepo.create({ name, schoolId, grade: gradeMatch?.[1] }),
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

  private rowToRecord(row: ExcelJS.Row, headerMap: Map<number, string>): Record<string, string> {
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

  private parseCellDate(value: ExcelJS.CellValue): Date | null {
    if (value instanceof Date) return value;
    if (typeof value === 'number') {
      const epoch = new Date(Date.UTC(1899, 11, 30));
      return new Date(epoch.getTime() + value * 86400000);
    }
    const s = String(value ?? '').trim();
    if (!s) return null;
    const iso = /^\d{4}-\d{2}-\d{2}/.exec(s);
    if (iso) return new Date(s);
    const dmY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
    if (dmY) return new Date(Number(dmY[3]), Number(dmY[2]) - 1, Number(dmY[1]));
    return new Date(s);
  }

  private parseCellTime(value: ExcelJS.CellValue): string | null {
    if (value instanceof Date) {
      return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
    }
    if (typeof value === 'number' && value < 1) {
      const totalMin = Math.round(value * 24 * 60);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    const s = String(value ?? '').trim();
    if (/^\d{1,2}:\d{2}/.test(s)) return s.slice(0, 5);
    return s || null;
  }

  private combineDateAndTime(date: Date, time: string): Date {
    const [h, m] = time.split(':').map(Number);
    const d = new Date(date);
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
  }

  private formatDateOnly(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

/** Exported for unit tests */
export function isMarkedXForTest(val: string): boolean {
  const v = val.trim().toLowerCase();
  return v === 'x' || v === '1' || v === '✓' || v === '√' || v === 'yes' || v === 'có';
}

export function resolveSubjectFromHeader(header: string): string | undefined {
  return SUBJECT_BY_NAME.get(header);
}

export { MANDATORY_SUBJECTS, TN_THPT_SUBJECTS, NAME_BY_CODE };
