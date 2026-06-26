import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import * as puppeteer from 'puppeteer';
import { Student } from '../../database/entities/student.entity';
import { StudentSession } from '../../database/entities/student-session.entity';
import { ExamSession } from '../../database/entities/exam-session.entity';
import { TnptComboCatalog } from '../../database/entities/tnpt-combo-catalog.entity';
import { DEFAULT_SCHOOL_NAME } from '@vnu/shared-types';

export interface ScheduleRow {
  id: string;
  sbd: string;
  pin?: string;
  studentId: string;
  fullName?: string;
  comboCode?: string;
  labRoom?: string;
}

@Injectable()
export class SessionSchedulerService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(StudentSession)
    private readonly sessionRepo: Repository<StudentSession>,
    @InjectRepository(ExamSession)
    private readonly examSessionRepo: Repository<ExamSession>,
    @InjectRepository(TnptComboCatalog)
    private readonly comboRepo: Repository<TnptComboCatalog>,
  ) {}

  private roomBase(): string {
    return process.env.EDGE_ROOM_NAME || 'Phòng máy số 1';
  }

  private roomCapacity(): number {
    return parseInt(process.env.EDGE_ROOM_CAPACITY || '30', 10);
  }

  private assignLabRoom(index: number): string {
    const base = this.roomBase();
    const cap = this.roomCapacity();
    const roomNum = Math.floor(index / cap) + 1;
    return roomNum === 1 ? base : `${base} — máy ${roomNum}`;
  }

  private schoolName(): string {
    return process.env.SCHOOL_NAME || process.env.VITE_SCHOOL_NAME || DEFAULT_SCHOOL_NAME;
  }

  async scheduleSession(examSessionId: string, studentIds?: string[]): Promise<ScheduleRow[]> {
    const examSession = await this.examSessionRepo.findOne({ where: { id: examSessionId } });
    if (!examSession) throw new Error('Exam session not found');

    let students: Student[];
    if (studentIds?.length) {
      students = await this.studentRepo.find({ where: { id: In(studentIds) } });
    } else {
      students = await this.studentRepo.find();
    }

    students.sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));

    const groups = new Map<string, Student[]>();
    for (const s of students) {
      const key = s.comboCode || s.subjectGroup || 'default';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }

    const sessions: Array<StudentSession & { pin?: string; labRoom?: string }> = [];
    let sbdCounter = 1000;
    let seatIndex = 0;

    for (const [, groupStudents] of groups) {
      for (const student of groupStudents) {
        const sbd = String(sbdCounter++);
        const pin = this.generatePin();
        const pinHash = await bcrypt.hash(pin, 10);
        const labRoom = this.assignLabRoom(seatIndex++);

        const existing = await this.sessionRepo.findOne({
          where: { studentId: student.id, examSessionId },
        });
        if (existing) {
          sessions.push({ ...existing, labRoom });
          continue;
        }

        const session = this.sessionRepo.create({
          sbd,
          pinHash,
          studentId: student.id,
          examSessionId,
          status: 'NOT_LOGGED_IN' as never,
        });

        const saved = await this.sessionRepo.save(session);
        sessions.push({ ...saved, pin, labRoom });
      }
    }

    return sessions.map((s) => ({
      id: s.id,
      sbd: s.sbd,
      pin: s.pin,
      studentId: s.studentId,
      fullName: students.find((st) => st.id === s.studentId)?.fullName,
      comboCode: students.find((st) => st.id === s.studentId)?.comboCode,
      labRoom: s.labRoom,
    }));
  }

  async listCredentials(examSessionId: string) {
    const sessions = await this.sessionRepo.find({
      where: { examSessionId },
      relations: ['student'],
      order: { sbd: 'ASC' },
    });
    return sessions.map((s, i) => ({
      sbd: s.sbd,
      fullName: s.student?.fullName,
      comboCode: s.student?.comboCode,
      labRoom: this.assignLabRoom(i),
    }));
  }

  async regenerateCredentials(examSessionId: string, confirm?: boolean) {
    if (!confirm) {
      throw new BadRequestException('Yêu cầu xác nhận: body { "confirm": true }');
    }
    const examSession = await this.examSessionRepo.findOne({ where: { id: examSessionId } });
    if (!examSession) throw new BadRequestException('Exam session not found');

    const sessions = await this.sessionRepo.find({
      where: { examSessionId },
      relations: ['student'],
      order: { sbd: 'ASC' },
    });

    const rows: Array<{ sbd: string; pin: string; fullName?: string; comboCode?: string; labRoom: string }> = [];
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      const pin = this.generatePin();
      s.pinHash = await bcrypt.hash(pin, 10);
      await this.sessionRepo.save(s);
      rows.push({
        sbd: s.sbd,
        pin,
        fullName: s.student?.fullName,
        comboCode: s.student?.comboCode,
        labRoom: this.assignLabRoom(i),
      });
    }
    return rows;
  }

  buildCredentialPrintHtml(
    examSessionName: string,
    rows: Array<{ sbd: string; pin?: string; fullName?: string; comboCode?: string; labRoom?: string }>,
    layout: 'slip' | 'table',
  ): string {
    const school = this.schoolName();
    if (layout === 'table') {
      const tr = rows
        .map(
          (r) =>
            `<tr><td>${r.sbd}</td><td>${r.fullName ?? ''}</td><td>${r.comboCode ?? ''}</td><td>${r.labRoom ?? ''}</td><td><strong>${r.pin ?? '—'}</strong></td></tr>`,
        )
        .join('');
      return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body{font-family:Arial,sans-serif;padding:24px}
        table{border-collapse:collapse;width:100%}
        th,td{border:1px solid #333;padding:8px;text-align:left}
        th{background:#eee}
      </style></head><body>
        <h1>${school}</h1>
        <h2>Danh sách tài khoản thi — ${examSessionName}</h2>
        <table><thead><tr><th>SBD</th><th>Họ tên</th><th>Tổ hợp</th><th>Phòng</th><th>PIN</th></tr></thead>
        <tbody>${tr}</tbody></table>
        <p style="margin-top:1rem;font-size:12px">In lúc: ${new Date().toLocaleString('vi-VN')}</p>
      </body></html>`;
    }

    const slips = rows
      .map(
        (r) => `
      <div class="slip">
        <h2>${school}</h2>
        <p><strong>Ca thi:</strong> ${examSessionName}</p>
        <p><strong>Họ tên:</strong> ${r.fullName ?? '—'}</p>
        <p><strong>SBD:</strong> ${r.sbd}</p>
        <p><strong>Mã PIN:</strong> <span class="pin">${r.pin ?? '—'}</span></p>
        <p><strong>Phòng:</strong> ${r.labRoom ?? this.roomBase()}</p>
        <p class="warn">Không chia sẻ mã PIN</p>
      </div>`,
      )
      .join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      @page { size: A4; margin: 12mm; }
      body{font-family:Arial,sans-serif}
      .slip{border:2px solid #1e40af;border-radius:8px;padding:16px;margin-bottom:16px;width:45%;display:inline-block;vertical-align:top;box-sizing:border-box}
      .pin{font-size:1.4rem;color:#dc2626;font-weight:bold}
      .warn{font-size:11px;color:#666;margin-top:8px}
      @media print { .slip { page-break-inside: avoid; } }
    </style></head><body>${slips}</body></html>`;
  }

  async exportSchedulePdf(examSessionId: string): Promise<{ path: string; count: number }> {
    const examSession = await this.examSessionRepo.findOne({ where: { id: examSessionId } });
    if (!examSession) throw new Error('Exam session not found');

    const sessions = await this.sessionRepo.find({
      where: { examSessionId },
      relations: ['student'],
      order: { sbd: 'ASC' },
    });

    const rows = sessions.map((s, i) => ({
      sbd: s.sbd,
      fullName: s.student?.fullName ?? '',
      comboCode: s.student?.comboCode ?? '',
      labRoom: this.assignLabRoom(i),
      pin: undefined,
    }));

    const html = this.buildCredentialPrintHtml(examSession.name, rows, 'table');
    const outDir = process.env.UPLOAD_DIR || './uploads';
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const pdfPath = path.join(outDir, `schedule-${examSessionId}.pdf`);

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();
    fs.writeFileSync(pdfPath, pdf);

    return { path: pdfPath, count: sessions.length };
  }

  private generatePin(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }
}
