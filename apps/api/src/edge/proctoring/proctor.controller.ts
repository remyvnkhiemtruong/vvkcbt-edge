import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards, UploadedFile, UseInterceptors, BadRequestException, StreamableFile, Res } from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentSession } from '../../database/entities/student-session.entity';
import { ExamSession } from '../../database/entities/exam-session.entity';
import { StudentSubjectSlot } from '../../database/entities/student-subject-slot.entity';
import { ProctoringGateway } from './proctoring.gateway';
import { ProctorActionType, StudentSessionStatus } from '@vnu/shared-types';
import { StaffAuthGuard, StaffRoles } from '../../shared/guards/staff-auth.guard';
import { ExamPackageService } from '../../core/exam-package/exam-package.service';
import { SessionSchedulerService } from '../../core/scheduling/session-scheduler.service';
import { ExamMasterService } from '../../core/exam-master/exam-master.service';
import { SlotSchedulerService } from '../routing/slot-scheduler.service';
import { AuditService } from '../../shared/audit/audit.service';
import { ProctorScoreService } from './proctor-score.service';
import { RoomScoreSheetService } from './room-score-sheet.service';
import { SubjectRoomCompletionService } from './subject-room-completion.service';
import { AppealService } from './appeal.service';
import { RoomArchiveService } from './room-archive.service';

@Controller('proctor')
@UseGuards(StaffAuthGuard)
@StaffRoles('proctor')
export class ProctorController {
  constructor(
    @InjectRepository(StudentSession)
    private readonly sessionRepo: Repository<StudentSession>,
    @InjectRepository(ExamSession)
    private readonly examSessionRepo: Repository<ExamSession>,
    @InjectRepository(StudentSubjectSlot)
    private readonly slotRepo: Repository<StudentSubjectSlot>,
    private readonly gateway: ProctoringGateway,
    private readonly packageService: ExamPackageService,
    private readonly scheduler: SessionSchedulerService,
    private readonly examMaster: ExamMasterService,
    private readonly slotScheduler: SlotSchedulerService,
    private readonly auditService: AuditService,
    private readonly scoreService: ProctorScoreService,
    private readonly roomScoreSheetService: RoomScoreSheetService,
    private readonly subjectRoomCompletion: SubjectRoomCompletionService,
    private readonly appealService: AppealService,
    private readonly roomArchiveService: RoomArchiveService,
  ) {}
  @Get('grid/:examSessionId')
  async getGrid(
    @Param('examSessionId') examSessionId: string,
    @Query('subjectCode') subjectCode?: string,
    @Query('room') room?: string,
  ) {
    return this.gateway.getGrid(examSessionId, { subjectCode, room });
  }

  @Patch('slots/:slotId/score')
  async overrideScore(
    @Param('slotId') slotId: string,
    @Body()
    body: {
      part1?: number;
      part2?: number;
      part3?: number;
      total?: number;
      reason?: string;
      reviewedBy?: string;
    },
  ) {
    return this.scoreService.overrideSlotScore(slotId, {
      ...body,
      reviewedBy: body.reviewedBy ?? 'proctor',
    });
  }

  @Get('sessions/:examSessionId/room-score-sheet')
  async roomScoreSheet(
    @Param('examSessionId') examSessionId: string,
    @Res() res: Response,
    @Query('subjectCode') subjectCode?: string,
    @Query('room') room?: string,
    @Query('format') format?: 'pdf' | 'xlsx',
    @Query('proctor1Name') proctor1Name?: string,
    @Query('proctor2Name') proctor2Name?: string,
    @Query('signature1') signature1?: string,
    @Query('signature2') signature2?: string,
  ) {
    if (!subjectCode?.trim()) throw new BadRequestException('Thiếu subjectCode');
    const roomName = room?.trim() || process.env.EDGE_ROOM_NAME || 'Phòng máy số 1';
    const fmt = format === 'xlsx' ? 'xlsx' : 'pdf';
    const result = await this.roomScoreSheetService.export(examSessionId, {
      subjectCode: subjectCode.trim(),
      room: roomName,
      format: fmt,
      proctor1Name,
      proctor2Name,
      signature1,
      signature2,
    });
    if (result.pdfFallback) {
      res.setHeader('X-Pdf-Fallback', 'excel');
    }
    if (result.format === 'xlsx') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${this.roomScoreSheetService.exportFilename(subjectCode.trim(), roomName, 'xlsx')}"`,
      );
    } else {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${this.roomScoreSheetService.exportFilename(subjectCode.trim(), roomName, 'pdf')}"`,
      );
    }
    res.send(result.buffer);
  }

  @Get('sessions/:examSessionId/room-score-sheet/preview')
  async roomScoreSheetPreview(
    @Param('examSessionId') examSessionId: string,
    @Query('subjectCode') subjectCode?: string,
    @Query('room') room?: string,
  ) {
    if (!subjectCode?.trim()) throw new BadRequestException('Thiếu subjectCode');
    const roomName = room?.trim() || process.env.EDGE_ROOM_NAME || 'Phòng máy số 1';
    return this.subjectRoomCompletion.preview(examSessionId, subjectCode.trim(), roomName);
  }

  @Post('sessions/:examSessionId/end-subject-room')
  async endSubjectRoom(
    @Param('examSessionId') examSessionId: string,
    @Body() body: { subjectCode: string; room?: string },
  ) {
    if (!body.subjectCode?.trim()) throw new BadRequestException('Thiếu subjectCode');
    const roomName = body.room?.trim() || process.env.EDGE_ROOM_NAME || 'Phòng máy số 1';
    return this.subjectRoomCompletion.forceComplete(examSessionId, body.subjectCode.trim(), roomName);
  }

  @Post('action')
  async action(
    @Body()
    body: {
      examSessionId: string;
      studentSessionId: string;
      action: ProctorActionType;
      payload?: Record<string, unknown>;
    },
  ) {
    await this.gateway.proctorAction(null as never, body);
    return { ok: true };
  }

  @Get('sessions/current/import-status')
  async importStatus() {
    const status = await this.packageService.getPackageStatus();
    if (!status.examSessionId) {
      return { packageId: null, examSessionId: null, subjects: [], importedSubjects: [], pendingSubjects: [] };
    }
    return this.packageService.getImportStatus(status.examSessionId);
  }

  @Get('packages/status')
  getPackageStatus() {
    return this.packageService.getPackageStatus();
  }

  @Post('packages/import')
  @UseInterceptors(FileInterceptor('file'))
  async importPackage(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer) throw new BadRequestException('Thiếu file ZIP');
    return this.packageService.importZip(file.buffer);
  }

  @Post('packages/dry-run')
  @UseInterceptors(FileInterceptor('file'))
  async dryRunPackage(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer) throw new BadRequestException('Thiếu file ZIP');
    return this.packageService.dryRun(file.buffer);
  }

  @Get('packages/template')
  async downloadTemplate(): Promise<StreamableFile> {
    const buf = await this.packageService.buildTemplateZip();
    return new StreamableFile(buf, {
      type: 'application/zip',
      disposition: 'attachment; filename="exam-package-mau.zip"',
    });
  }

  @Post('sessions/:examSessionId/schedule')
  async scheduleSession(
    @Param('examSessionId') examSessionId: string,
    @Body() body: { studentIds?: string[] },
  ) {
    return this.scheduler.scheduleSession(examSessionId, body.studentIds);
  }

  @Get('sessions/:examSessionId/dashboard')
  async dashboard(@Param('examSessionId') examSessionId: string) {
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
    return {
      totalStudents: grid.length,
      submitted: grid.filter((g) => g.submitted).length,
      inExam: grid.filter((g) => g.status === StudentSessionStatus.ACTIVE).length,
      violations: grid.reduce((s, g) => s + g.violations, 0),
      offline: grid.filter((g) => g.status === StudentSessionStatus.OFFLINE).length,
      bySubject,
    };
  }

  @Get('sessions/:examSessionId/room-archive')
  async exportRoomArchive(
    @Param('examSessionId') examSessionId: string,
    @Res() res: Response,
    @Query('room') room?: string,
    @Query('proctor1Name') proctor1Name?: string,
    @Query('proctor2Name') proctor2Name?: string,
    @Query('signature1') signature1?: string,
    @Query('signature2') signature2?: string,
  ) {
    const slots = await this.slotRepo.find({ where: { examSessionId }, take: 1 });
    const subjectCode = slots[0]?.subjectCode;
    const zip = await this.roomArchiveService.exportRoomArchive(examSessionId, {
      room,
      proctor1Name,
      proctor2Name,
      signature1,
      signature2,
    });
    const filename = this.roomArchiveService.exportFilename(examSessionId, subjectCode);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(zip);
  }

  @Get('sessions/:examSessionId/report')
  async exportReport(@Param('examSessionId') examSessionId: string) {
    const excel = await this.examMaster.exportMaster(examSessionId);
    const audit = await this.auditService.findBySession(examSessionId);
    const csv = ['eventType,detail,clientIp,createdAt', ...audit.map((l) =>
      `${l.eventType},"${JSON.stringify(l.payload ?? {})}",${l.ip ?? ''},${l.createdAt.toISOString()}`,
    )].join('\n');
    return {
      excelBase64: excel.toString('base64'),
      auditCsv: csv,
      generatedAt: new Date().toISOString(),
    };
  }

  @Post('slots/:slotId/open-early')
  async openSlotEarly(@Param('slotId') slotId: string) {
    return this.slotScheduler.openEarly(slotId);
  }

  @Get('sessions/:examSessionId/subject-schedule')
  async subjectSchedule(@Param('examSessionId') examSessionId: string) {
    const slots = await this.slotRepo.find({
      where: { examSessionId },
      order: { scheduledStart: 'ASC' },
    });
    const bySubject = new Map<string, { subjectCode: string; scheduledStart: Date; scheduledEnd: Date; status: string; slotId: string; openCount: number; total: number }>();
    for (const slot of slots) {
      const key = slot.subjectCode;
      const cur = bySubject.get(key) ?? {
        subjectCode: key,
        scheduledStart: slot.scheduledStart,
        scheduledEnd: slot.scheduledEnd,
        status: slot.status,
        slotId: slot.id,
        openCount: 0,
        total: 0,
      };
      cur.total += 1;
      if (slot.status === 'open' || slot.status === 'completed') cur.openCount += 1;
      if (slot.scheduledStart < cur.scheduledStart) {
        cur.scheduledStart = slot.scheduledStart;
        cur.slotId = slot.id;
      }
      if (slot.scheduledEnd > cur.scheduledEnd) cur.scheduledEnd = slot.scheduledEnd;
      if (slot.status === 'open') cur.status = 'open';
      else if (slot.status === 'scheduled' && cur.status !== 'open') cur.status = 'scheduled';
      bySubject.set(key, cur);
    }
    return {
      serverTime: new Date().toISOString(),
      subjects: [...bySubject.values()],
    };
  }

  @Post('slots/:slotId/extend')
  async extendSlot(@Param('slotId') slotId: string, @Body() body: { minutes: number }) {
    return this.slotScheduler.extendSlot(slotId, body.minutes ?? 15);
  }

  @Put('sessions/:examSessionId/ui-mode')
  async updateUiMode(
    @Param('examSessionId') examSessionId: string,
    @Body() body: { subjects: Array<{ code: string; ui_mode: 'split_view' | 'vertical_focus' }> },
  ) {
    const session = await this.examSessionRepo.findOne({ where: { id: examSessionId } });
    if (!session) throw new BadRequestException('Ca thi không tồn tại');
    const rules = { ...session.rules, subjects: [...(session.rules?.subjects ?? [])] };
    for (const upd of body.subjects ?? []) {
      const idx = rules.subjects.findIndex((s) => s.code === upd.code);
      if (idx >= 0) {
        rules.subjects[idx] = { ...rules.subjects[idx], ui_mode: upd.ui_mode };
      } else {
        rules.subjects.push({ code: upd.code, ui_mode: upd.ui_mode, structureMode: 'default' });
      }
    }
    await this.examSessionRepo.update(examSessionId, { rules } as never);
    return { updated: true };
  }

  @Get('sessions/:examSessionId/appeals')
  listAppeals(@Param('examSessionId') examSessionId: string) {
    return this.appealService.list(examSessionId);
  }

  @Post('sessions/:examSessionId/appeals')
  createAppeal(
    @Param('examSessionId') examSessionId: string,
    @Body() body: { sbd: string; subjectCode: string; questionId?: string; reason: string },
  ) {
    if (!body.sbd?.trim() || !body.subjectCode?.trim() || !body.reason?.trim()) {
      throw new BadRequestException('Thiếu SBD, môn hoặc lý do');
    }
    return this.appealService.create({ examSessionId, ...body });
  }

  @Patch('appeals/:id/review')
  reviewAppeal(
    @Param('id') id: string,
    @Body()
    body: {
      status: 'reviewing' | 'accepted' | 'rejected';
      reviewedBy?: string;
      reviewNote?: string;
      scoreBefore?: number;
      scoreAfter?: number;
    },
  ) {
    return this.appealService.review(id, {
      ...body,
      reviewedBy: body.reviewedBy ?? 'proctor',
    });
  }

  @Get('sessions/:examSessionId/report/so-export')
  async exportSoReport(@Param('examSessionId') examSessionId: string) {
    const excel = await this.examMaster.exportMaster(examSessionId);
    return {
      excelBase64: excel.toString('base64'),
      filename: `bao-cao-so-${examSessionId.slice(0, 8)}.xlsx`,
      generatedAt: new Date().toISOString(),
      note: 'Mẫu tổng hợp Sở — đối chiếu với CV mẫu Sở GDĐT Cà Mau',
    };
  }
}
