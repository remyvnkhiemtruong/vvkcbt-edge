import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import * as puppeteer from 'puppeteer';
import { TN_THPT_SUBJECTS } from '@vnu/shared-types';
import { ExamSession } from '../../database/entities/exam-session.entity';
import { StudentSubjectSlot } from '../../database/entities/student-subject-slot.entity';
import { StudentSession } from '../../database/entities/student-session.entity';

export interface RoomScoreSheetQuery {
  subjectCode: string;
  room: string;
  proctor1Name?: string;
  proctor2Name?: string;
  signature1?: string;
  signature2?: string;
  format: 'pdf' | 'xlsx';
}

export interface RoomScoreSheetRow {
  stt: number;
  sbd: string;
  fullName: string;
  className: string;
  part1: string | number;
  part2: string | number;
  part3: string | number;
  total: string | number;
  note?: string;
  pendingManual?: boolean;
}

interface SheetMeta {
  examName: string;
  subjectName: string;
  subjectCode: string;
  room: string;
  schoolName: string;
  provinceName: string;
  dateLine: string;
  proctor1Name: string;
  proctor2Name: string;
  signature1?: string;
  signature2?: string;
  submittedCount: number;
  absentCount: number;
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
    } catch {
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
    return `BienBanDiem_${subjectCode}_${roomSlug}_${ymd}.${ext}`;
  }

  private buildMeta(
    examName: string,
    query: RoomScoreSheetQuery,
    subjectName: string,
    stats: { total: number; completed: number },
  ): SheetMeta {
    const now = new Date();
    const schoolName = process.env.VITE_SCHOOL_NAME || 'TRƯỜNG THPT VÕ VĂN KIỆT';
    const provinceName = process.env.VITE_PROVINCE_NAME || 'SỞ GDĐT CÀ MAU';
    return {
      examName,
      subjectName,
      subjectCode: query.subjectCode,
      room: query.room,
      schoolName,
      provinceName,
      dateLine: `Cà Mau, ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`,
      proctor1Name: query.proctor1Name ?? '',
      proctor2Name: query.proctor2Name ?? '',
      signature1: query.signature1,
      signature2: query.signature2,
      submittedCount: stats.completed,
      absentCount: Math.max(0, stats.total - stats.completed),
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
      const pendingManual = score.pendingManual === true;
      return {
        stt: i + 1,
        sbd: sbdByStudent.get(slot.studentId) ?? '',
        fullName: slot.student?.fullName ?? '',
        className: slot.student?.class?.name ?? '',
        part1: p1 != null ? p1 : hasP2 || hasP3 ? '' : (typeof score.total === 'number' ? score.total : ''),
        part2: hasP2 ? p2 : '',
        part3: hasP3 ? p3 : '',
        total: pendingManual ? '' : typeof score.total === 'number' ? score.total : '',
        note: pendingManual ? 'Chờ chấm tự luận' : '',
        pendingManual,
      };
    });
  }

  private async buildExcel(rows: RoomScoreSheetRow[], meta: SheetMeta): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('BienBanDiem');
    sheet.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true };

    sheet.mergeCells('A1:J1');
    sheet.getCell('A1').value = meta.provinceName;
    sheet.mergeCells('A2:J2');
    sheet.getCell('A2').value = meta.schoolName;
    sheet.mergeCells('A3:J3');
    sheet.getCell('A3').value = 'BIÊN BẢN XÁC NHẬN ĐIỂM THI';
    sheet.mergeCells('A4:J4');
    sheet.getCell('A4').value = `Môn: ${meta.subjectName} · Phòng: ${meta.room} · ${meta.examName}`;
    sheet.addRow([]);

    const header = sheet.addRow([
      'STT',
      'SBD',
      'Họ và tên',
      'Lớp',
      'Điểm P.I',
      'P.II',
      'P.III',
      'Tổng',
      'Ghi chú',
      'Ký TS',
    ]);
    header.font = { bold: true, name: 'Times New Roman', size: 13 };
    header.eachCell((c) => {
      c.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    sheet.views = [{ state: 'frozen', ySplit: 6 }];

    for (const r of rows) {
      const row = sheet.addRow([
        r.stt,
        r.sbd,
        r.fullName,
        r.className,
        r.part1,
        r.part2,
        r.part3,
        r.total,
        r.note ?? '',
        '',
      ]);
      row.font = { name: 'Times New Roman', size: 13 };
      row.eachCell((c) => {
        c.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    }

    sheet.addRow([]);
    const summary = sheet.addRow([
      `Đã nộp: ${meta.submittedCount} · Vắng/chưa nộp: ${meta.absentCount}`,
    ]);
    sheet.mergeCells(`A${summary.number}:J${summary.number}`);
    sheet.addRow([]);
    const sign = sheet.addRow([
      `Giám thị 1: ${meta.proctor1Name}`,
      '',
      '',
      '',
      `Giám thị 2: ${meta.proctor2Name}`,
    ]);
    sheet.mergeCells(`A${sign.number}:D${sign.number}`);
    sheet.mergeCells(`E${sign.number}:J${sign.number}`);
    sheet.addRow([meta.dateLine]);
    sheet.mergeCells(`A${sheet.lastRow!.number}:J${sheet.lastRow!.number}`);

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private async buildPdf(rows: RoomScoreSheetRow[], meta: SheetMeta): Promise<Buffer> {
    const tableRows = rows
      .map(
        (r) => `<tr>
          <td>${r.stt}</td><td>${this.esc(r.sbd)}</td><td style="text-align:left">${this.esc(r.fullName)}</td><td>${this.esc(r.className)}</td>
          <td>${r.part1}</td><td>${r.part2}</td><td>${r.part3}</td><td><strong>${r.total}</strong></td>
          <td style="font-size:11px">${this.esc(r.note ?? '')}</td>
          <td style="height:28px"></td>
        </tr>`,
      )
      .join('');

    const sig1 = meta.signature1
      ? `<img src="${meta.signature1}" alt="GT1" style="max-height:48px"/>`
      : '';
    const sig2 = meta.signature2
      ? `<img src="${meta.signature2}" alt="GT2" style="max-height:48px"/>`
      : '';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        body{font-family:"Times New Roman",Times,serif;font-size:13px;margin:0}
        .header{text-align:center;line-height:1.35}
        .header .province{font-weight:bold;text-transform:uppercase;font-size:13px}
        .header .school{font-weight:bold;text-transform:uppercase;font-size:14px;margin:4px 0}
        .header .title{font-weight:bold;font-size:14px;margin:8px 0 4px;text-decoration:underline}
        .meta{text-align:center;margin-bottom:10px;font-size:13px}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #000;padding:4px 6px;text-align:center;font-size:13px}
        th{background:#f5f5f5;font-weight:bold}
        .signatures{display:flex;justify-content:space-between;margin-top:20px}
        .sign-block{width:45%;text-align:center;font-size:13px}
        .sign-line{border-top:1px solid #000;margin-top:36px;padding-top:4px}
        .summary{margin-top:8px;font-size:13px}
        .date-line{text-align:right;margin-top:12px;font-style:italic}
      </style></head><body>
      <div class="header">
        <div class="province">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
        <div style="text-decoration:underline;font-size:13px">Độc lập - Tự do - Hạnh phúc</div>
        <div class="province" style="margin-top:10px">${this.esc(meta.provinceName)}</div>
        <div class="school">${this.esc(meta.schoolName)}</div>
        <div class="title">BIÊN BẢN XÁC NHẬN ĐIỂM THI</div>
      </div>
      <p class="meta">Kỳ thi: ${this.esc(meta.examName)} · Môn: ${this.esc(meta.subjectName)} · Phòng: ${this.esc(meta.room)}</p>
      <table>
        <thead><tr>
          <th>STT</th><th>SBD</th><th>Họ và tên</th><th>Lớp</th>
          <th>P.I</th><th>P.II</th><th>P.III</th><th>Tổng</th><th>Ghi chú</th><th>Ký TS</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
      <p class="summary">Tổng kết: Đã nộp <strong>${meta.submittedCount}</strong> · Vắng/chưa nộp <strong>${meta.absentCount}</strong></p>
      <div class="signatures">
        <div class="sign-block">
          <div>Giám thị 1: <strong>${this.esc(meta.proctor1Name)}</strong></div>
          ${sig1}
          <div class="sign-line">Ký và ghi rõ họ tên</div>
        </div>
        <div class="sign-block">
          <div>Giám thị 2: <strong>${this.esc(meta.proctor2Name)}</strong></div>
          ${sig2}
          <div class="sign-line">Ký và ghi rõ họ tên</div>
        </div>
      </div>
      <p class="date-line">${this.esc(meta.dateLine)}</p>
    </body></html>`;

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox'],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', landscape: true, printBackground: true });
    await browser.close();
    return Buffer.from(pdf);
  }
}
