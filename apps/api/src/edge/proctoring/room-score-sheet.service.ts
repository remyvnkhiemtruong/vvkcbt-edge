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

interface SheetRow {
  stt: number;
  sbd: string;
  fullName: string;
  className: string;
  part1: string | number;
  part2: string | number;
  part3: string | number;
  total: string | number;
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

  async export(examSessionId: string, query: RoomScoreSheetQuery): Promise<Buffer> {
    const session = await this.examSessionRepo.findOne({ where: { id: examSessionId } });
    if (!session) throw new NotFoundException('Ca thi không tồn tại');

    const rows = await this.buildRows(examSessionId, query.subjectCode, query.room);
    if (!rows.length) {
      throw new BadRequestException('Không có thí sinh đã nộp bài trong phòng/môn đã chọn');
    }

    const subjectName = TN_THPT_SUBJECTS.find((s) => s.code === query.subjectCode)?.nameVi ?? query.subjectCode;
    const schoolName = process.env.VITE_SCHOOL_NAME || 'TRƯỜNG THPT VÕ VĂN KIỆT';
    const meta = {
      examName: session.name,
      subjectName,
      room: query.room,
      schoolName,
      date: new Date().toLocaleDateString('vi-VN'),
      proctor1Name: query.proctor1Name ?? '',
      proctor2Name: query.proctor2Name ?? '',
      signature1: query.signature1,
      signature2: query.signature2,
    };

    if (query.format === 'xlsx') {
      return this.buildExcel(rows, meta);
    }
    return this.buildPdf(rows, meta);
  }

  private async buildRows(
    examSessionId: string,
    subjectCode: string,
    room: string,
  ): Promise<SheetRow[]> {
    const slots = await this.slotRepo.find({
      where: { examSessionId, subjectCode, status: 'completed' },
      relations: ['student', 'student.class'],
      order: { scheduledStart: 'ASC' },
    });

    const sessions = await this.sessionRepo.find({ where: { examSessionId } });
    const sbdByStudent = new Map(
      sessions.filter((s) => s.studentId).map((s) => [s.studentId!, s.sbd]),
    );

    const filtered = slots.filter((slot) => {
      const lab = slot.student?.labRoom?.trim();
      if (!lab) return room === (process.env.EDGE_ROOM_NAME || 'Phòng máy số 1');
      return lab === room;
    });

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
      };
    });
  }

  private async buildExcel(
    rows: SheetRow[],
    meta: {
      examName: string;
      subjectName: string;
      room: string;
      schoolName: string;
      date: string;
      proctor1Name: string;
      proctor2Name: string;
    },
  ): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('BienBanPhong');
    sheet.addRow([meta.schoolName]);
    sheet.addRow([`Kỳ thi: ${meta.examName} | Môn: ${meta.subjectName} | Phòng: ${meta.room} | Ngày: ${meta.date}`]);
    sheet.addRow([]);
    sheet.addRow(['STT', 'SBD', 'Họ và tên', 'Lớp', 'Điểm P.I', 'P.II', 'P.III', 'Tổng', 'Ký TS']);
    for (const r of rows) {
      sheet.addRow([r.stt, r.sbd, r.fullName, r.className, r.part1, r.part2, r.part3, r.total, '']);
    }
    sheet.addRow([]);
    sheet.addRow([`Giám thị 1: ${meta.proctor1Name}`, '', '', `Giám thị 2: ${meta.proctor2Name}`]);
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private async buildPdf(
    rows: SheetRow[],
    meta: {
      examName: string;
      subjectName: string;
      room: string;
      schoolName: string;
      date: string;
      proctor1Name: string;
      proctor2Name: string;
      signature1?: string;
      signature2?: string;
    },
  ): Promise<Buffer> {
    const tableRows = rows
      .map(
        (r) => `<tr>
          <td>${r.stt}</td><td>${this.esc(r.sbd)}</td><td>${this.esc(r.fullName)}</td><td>${this.esc(r.className)}</td>
          <td>${r.part1}</td><td>${r.part2}</td><td>${r.part3}</td><td><strong>${r.total}</strong></td>
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
        body{font-family:system-ui,sans-serif;font-size:11px;margin:16px}
        h1{font-size:14px;text-align:center;margin:0 0 4px}
        .meta{text-align:center;margin-bottom:12px}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #333;padding:4px 6px;text-align:center}
        th{background:#f1f5f9}
        .signatures{display:flex;justify-content:space-between;margin-top:24px}
        .sign-block{width:45%;text-align:center}
        .sign-line{border-top:1px solid #333;margin-top:40px;padding-top:4px}
      </style></head><body>
      <h1>${this.esc(meta.schoolName)}</h1>
      <p class="meta">Kỳ thi: ${this.esc(meta.examName)} · Môn: ${this.esc(meta.subjectName)} · Phòng: ${this.esc(meta.room)} · ${this.esc(meta.date)}</p>
      <table>
        <thead><tr>
          <th>STT</th><th>SBD</th><th>Họ và tên</th><th>Lớp</th>
          <th>P.I</th><th>P.II</th><th>P.III</th><th>Tổng</th><th>Ký TS</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
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
