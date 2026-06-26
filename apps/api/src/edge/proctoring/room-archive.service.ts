import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createHash } from 'crypto';
import { createWriteStream } from 'fs';
import archiver from 'archiver';
import { ExamSession } from '../../database/entities/exam-session.entity';
import { StudentSession } from '../../database/entities/student-session.entity';
import { StudentSubjectSlot } from '../../database/entities/student-subject-slot.entity';
import { ExamMasterService } from '../../core/exam-master/exam-master.service';
import { AuditService } from '../../shared/audit/audit.service';
import { RoomScoreSheetService } from './room-score-sheet.service';
import { PdfService } from '../../post-exam/pdf/pdf.service';
import { ProctoringGateway } from './proctoring.gateway';
import { StudentSessionStatus } from '@vnu/shared-types';

export interface RoomArchiveOptions {
  room?: string;
  proctor1Name?: string;
  proctor2Name?: string;
  signature1?: string;
  signature2?: string;
}

@Injectable()
export class RoomArchiveService {
  constructor(
    @InjectRepository(ExamSession)
    private readonly examSessionRepo: Repository<ExamSession>,
    @InjectRepository(StudentSession)
    private readonly studentSessionRepo: Repository<StudentSession>,
    @InjectRepository(StudentSubjectSlot)
    private readonly slotRepo: Repository<StudentSubjectSlot>,
    private readonly examMaster: ExamMasterService,
    private readonly auditService: AuditService,
    private readonly roomScoreSheet: RoomScoreSheetService,
    private readonly pdfService: PdfService,
    private readonly gateway: ProctoringGateway,
  ) {}

  async exportRoomArchive(examSessionId: string, opts: RoomArchiveOptions = {}): Promise<Buffer> {
    const session = await this.examSessionRepo.findOne({ where: { id: examSessionId } });
    if (!session) throw new NotFoundException('Ca thi không tồn tại');

    const roomName = opts.room?.trim() || process.env.EDGE_ROOM_NAME || 'Phòng máy số 1';
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vnu-room-archive-'));
    const files: Array<{ path: string; sha256: string }> = [];

    const addFile = (relPath: string, buf: Buffer) => {
      const full = path.join(workDir, relPath);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, buf);
      files.push({
        path: relPath.replace(/\\/g, '/'),
        sha256: createHash('sha256').update(buf).digest('hex'),
      });
    };

    const excel = await this.examMaster.exportMaster(examSessionId);
    addFile('ket-qua/kythi-master-ket-qua.xlsx', excel);

    const audit = await this.auditService.findBySession(examSessionId);
    const csv = [
      'eventType,detail,clientIp,createdAt',
      ...audit.map(
        (l) =>
          `${l.eventType},"${JSON.stringify(l.payload ?? {}).replace(/"/g, '""')}",${l.ip ?? ''},${l.createdAt.toISOString()}`,
      ),
    ].join('\n');
    addFile(`audit/audit-${examSessionId}.csv`, Buffer.from('\ufeff' + csv, 'utf8'));

    const subjectCodes = [
      ...new Set((await this.slotRepo.find({ where: { examSessionId } })).map((s) => s.subjectCode)),
    ];

    for (const subjectCode of subjectCodes) {
      try {
        const pdfResult = await this.roomScoreSheet.export(examSessionId, {
          subjectCode,
          room: roomName,
          format: 'pdf',
          proctor1Name: opts.proctor1Name,
          proctor2Name: opts.proctor2Name,
          signature1: opts.signature1,
          signature2: opts.signature2,
        });
        const ext = pdfResult.format === 'pdf' ? 'pdf' : 'xlsx';
        addFile(
          `bien-ban-diem/BienBanDiem_${subjectCode}_${roomName.replace(/\s+/g, '_')}.${ext}`,
          pdfResult.buffer,
        );
        if (pdfResult.format === 'pdf') {
          const xlsxResult = await this.roomScoreSheet.export(examSessionId, {
            subjectCode,
            room: roomName,
            format: 'xlsx',
            proctor1Name: opts.proctor1Name,
            proctor2Name: opts.proctor2Name,
            signature1: opts.signature1,
            signature2: opts.signature2,
          });
          addFile(
            `bien-ban-diem/BienBanDiem_${subjectCode}_${roomName.replace(/\s+/g, '_')}.xlsx`,
            xlsxResult.buffer,
          );
        }
      } catch {
        /* skip subject without submitted students */
      }
    }

    const submitted = await this.studentSessionRepo.find({
      where: { examSessionId, status: StudentSessionStatus.SUBMITTED },
      relations: ['student'],
    });
    for (const ss of submitted) {
      try {
        const pdf = await this.pdfService.exportExamPdf(ss.id);
        const sbd = ss.sbd || 'nosbd';
        const acct = ss.examAccount || ss.id.slice(0, 8);
        addFile(`bai-lam/${sbd}_${acct}.pdf`, pdf);
      } catch {
        /* skip broken pdf */
      }
    }

    const grid = await this.gateway.getGrid(examSessionId);
    const slots = await this.slotRepo.find({ where: { examSessionId } });
    const bySubject: Record<string, { submitted: number; open: number; locked: number }> = {};
    for (const slot of slots) {
      if (!bySubject[slot.subjectCode]) {
        bySubject[slot.subjectCode] = { submitted: 0, open: 0, locked: 0 };
      }
      if (slot.status === 'completed') bySubject[slot.subjectCode].submitted += 1;
      else if (slot.status === 'open') bySubject[slot.subjectCode].open += 1;
      else bySubject[slot.subjectCode].locked += 1;
    }
    const summary = {
      examSessionId,
      sessionName: session.name,
      packageId: session.packageId,
      room: roomName,
      exportedAt: new Date().toISOString(),
      totalStudents: grid.length,
      submitted: grid.filter((g) => g.submitted).length,
      inExam: grid.filter((g) => g.status === StudentSessionStatus.ACTIVE).length,
      violations: grid.reduce((s, g) => s + g.violations, 0),
      bySubject,
    };
    addFile('tom-tat.json', Buffer.from(JSON.stringify(summary, null, 2), 'utf8'));

    const manifest = {
      formatVersion: '1.0',
      examSessionId,
      exportedAt: summary.exportedAt,
      files,
    };
    addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));

    const zipPath = path.join(workDir, 'archive.zip');
    await this.zipDirectory(workDir, zipPath, ['archive.zip']);
    const zipBuf = fs.readFileSync(zipPath);
    fs.rmSync(workDir, { recursive: true, force: true });

    await this.examSessionRepo.update(examSessionId, {
      roomExportedAt: new Date(),
      status: 'closed',
    });

    return zipBuf;
  }

  exportFilename(examSessionId: string, subjectCode?: string): string {
    const date = new Date();
    const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const hm = `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;
    const subj = subjectCode?.trim() || 'room';
    return `room-archive-${subj}-${examSessionId.slice(0, 8)}-${ymd}-${hm}.zip`;
  }

  private zipDirectory(sourceDir: string, outPath: string, exclude: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(outPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      output.on('close', () => resolve());
      archive.on('error', reject);
      archive.pipe(output);
      for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
        if (exclude.includes(entry.name)) continue;
        const full = path.join(sourceDir, entry.name);
        if (entry.isDirectory()) archive.directory(full, entry.name);
        else archive.file(full, { name: entry.name });
      }
      archive.finalize();
    });
  }
}
