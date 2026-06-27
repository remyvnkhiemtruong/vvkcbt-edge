import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { TN_THPT_SUBJECTS } from '@vnu/shared-types';
import {
  buildRoomScoreListPdfDefinition,
  type RoomScoreSheetRow,
} from '../../shared/admin-docs/room-score-sheet-doc';
import { renderPdfBuffer } from '../../shared/admin-docs/pdf-buffer';
import { ExamSession } from '../../database/entities/exam-session.entity';
import { StudentSubjectSlot } from '../../database/entities/student-subject-slot.entity';
import { StudentSession } from '../../database/entities/student-session.entity';

export type { RoomScoreSheetRow };

export interface RoomScoreSheetQuery {
  subjectCode: string;
  room: string;
  format: 'pdf' | 'xlsx';
}

interface SheetMeta {
  examName: string;
  subjectName: string;
  subjectCode: string;
  room: string;
  submittedCount: number;
  absentCount: number;
  exportedAt: Date;
}

@Injectable()
export class RoomScoreSheetService {
  constructor(
    @InjectRepository(ExamSession)
    private readonly examSessionRepo: Repository<ExamSession>,
    @InjectRepository(StudentSubjectSlot)
    private readonly slotRepo: Repository<StudentSubjectSlot>,
    @InjectRepository(StudentSession)
    private readonly sessionRepo: Repository<StudentSession>,
  ) {}

  async export(
    examSessionId: string,
    query: RoomScoreSheetQuery,
  ): Promise<{ buffer: Buffer; format: 'pdf' | 'xlsx'; pdfFallback?: boolean }> {
    const session = await this.examSessionRepo.findOne({ where: { id: examSessionId } });
    if (!session) throw new NotFoundException('Ca thi không tồn tại');

    const rows = await this.getRowsForRoom(examSessionId, query.subjectCode, query.room);
    if (!rows.length) {
      throw new BadRequestException('Không có thí sinh đã nộp bài trong phòng/môn đã chọn');
    }

    const subjectName =
      TN_THPT_SUBJECTS.find((s) => s.code === query.subjectCode)?.nameVi ?? query.subjectCode;
    const stats = await this.countRoomSlots(examSessionId, query.subjectCode, query.room);
    const meta = this.buildMeta(session.name, query, subjectName, stats);

    if (query.format === 'xlsx') {
      return { buffer: await this.buildExcel(rows, meta), format: 'xlsx' };
    }
    try {
      return { buffer: await this.buildPdf(rows, meta), format: 'pdf' };
    } catch (err) {
      console.warn('[RoomScoreSheet] PDF export failed, falling back to Excel:', err);
      return {
        buffer: await this.buildExcel(rows, meta),
        format: 'xlsx',
        pdfFallback: true,
      };
    }
  }

  async getRowsForRoom(
    examSessionId: string,
    subjectCode: string,
    room: string,
  ): Promise<RoomScoreSheetRow[]> {
    return this.buildRows(examSessionId, subjectCode, room);
  }

  exportFilename(subjectCode: string, room: string, format: 'pdf' | 'xlsx'): string {
    const date = new Date();
    const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const roomSlug = room.replace(/\s+/g, '_').replace(/[^\w-]/g, '');
    const ext = format === 'xlsx' ? 'xlsx' : 'pdf';
    return `DanhSachDiem_${subjectCode}_${roomSlug}_${ymd}.${ext}`;
  }

  buildMeta(
    examName: string,
    query: RoomScoreSheetQuery,
    subjectName: string,
    stats: { total: number; completed: number },
    exportedAt: Date = new Date(),
  ): SheetMeta {
    return {
      examName,
      subjectName,
      subjectCode: query.subjectCode,
      room: query.room,
      submittedCount: stats.completed,
      absentCount: Math.max(0, stats.total - stats.completed),
      exportedAt,
    };
  }

  private defaultRoom(): string {
    return process.env.EDGE_ROOM_NAME || 'Phòng máy số 1';
  }

  private matchesRoom(labRoom: string | null | undefined, room: string): boolean {
    const lab = labRoom?.trim();
    if (!lab) return room === this.defaultRoom();
    return lab === room;
  }

  private async countRoomSlots(examSessionId: string, subjectCode: string, room: string) {
    const slots = await this.slotRepo.find({
      where: { examSessionId, subjectCode },
      relations: ['student'],
    });
    const inRoom = slots.filter((s) => this.matchesRoom(s.student?.labRoom, room));
    const completed = inRoom.filter((s) => s.status === 'completed').length;
    return { total: inRoom.length, completed };
  }

  private async buildRows(
    examSessionId: string,
    subjectCode: string,
    room: string,
  ): Promise<RoomScoreSheetRow[]> {
    const slots = await this.slotRepo.find({
      where: { examSessionId, subjectCode, status: 'completed' },
      relations: ['student', 'student.class'],
      order: { scheduledStart: 'ASC' },
    });

    const sessions = await this.sessionRepo.find({ where: { examSessionId } });
    const sbdByStudent = new Map(
      sessions.filter((s) => s.studentId).map((s) => [s.studentId!, s.sbd]),
    );

    const filtered = slots.filter((slot) =>
      this.matchesRoom(slot.student?.labRoom, room),
    );

    filtered.sort((a, b) => {
      const sbdA = sbdByStudent.get(a.studentId) ?? '';
      const sbdB = sbdByStudent.get(b.studentId) ?? '';
      return sbdA.localeCompare(sbdB, 'vi', { numeric: true });
    });

    return filtered.map((slot, i) => {
      const score = (slot.scoreResult ?? {}) as Record<string, unknown>;
      const parts = (score.partScores ?? {}) as { part1?: number; part2?: number; part3?: number };
      const p1 = parts.part1;
      const p2 = parts.part2;
      const p3 = parts.part3;
      const hasP2 = p2 != null;
      const hasP3 = p3 != null;
      return {
        stt: i + 1,
        sbd: sbdByStudent.get(slot.studentId) ?? '',
        fullName: slot.student?.fullName ?? '',
        className: slot.student?.class?.name ?? '',
        part1: p1 != null ? p1 : hasP2 || hasP3 ? '' : (typeof score.total === 'number' ? score.total : ''),
        part2: hasP2 ? p2 : '',
        part3: hasP3 ? p3 : '',
        total: typeof score.total === 'number' ? score.total : '',
        note: '',
      };
    });
  }

  private async buildExcel(rows: RoomScoreSheetRow[], _meta: SheetMeta): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Diem');
    sheet.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true };

    const center = { horizontal: 'center' as const, vertical: 'middle' as const };
    const left = { horizontal: 'left' as const, vertical: 'middle' as const };
    const border = {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const },
    };

    const header = sheet.addRow(['STT', 'SBD', 'Họ và tên', 'Lớp', 'P.I', 'P.II', 'P.III', 'Tổng']);
    header.font = { name: 'Calibri', size: 11, bold: true };
    header.eachCell((c) => {
      c.border = border;
      c.alignment = center;
    });

    for (const r of rows) {
      const row = sheet.addRow([r.stt, r.sbd, r.fullName, r.className, r.part1, r.part2, r.part3, r.total]);
      row.font = { name: 'Calibri', size: 11 };
      row.eachCell((c, col) => {
        c.border = border;
        c.alignment = col === 3 ? left : center;
      });
      row.getCell(8).font = { name: 'Calibri', size: 11, bold: true };
    }

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  private async buildPdf(rows: RoomScoreSheetRow[], _meta: SheetMeta): Promise<Buffer> {
    const docDef = buildRoomScoreListPdfDefinition(rows);
    return renderPdfBuffer(docDef);
  }
}
