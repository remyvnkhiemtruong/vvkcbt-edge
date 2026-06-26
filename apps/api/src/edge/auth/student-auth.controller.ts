import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Req,
  UseGuards,
  BadRequestException,
  UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';
import { StudentAuthService } from './student-auth.service';
import { StudentLoginDto, AutosaveDto, FocusViolationDto } from './student-auth.dto';
import { StudentAuthGuard } from '../../shared/guards/student-auth.guard';
import { StudentSession } from '../../database/entities/student-session.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentSessionStatus, AuditEventType } from '@vnu/shared-types';
import { AuditService } from '../../shared/audit/audit.service';
import { IdempotencyInterceptor } from '../../shared/idempotency/idempotency.interceptor';
import { getClientIpFromRequest } from '../../shared/utils/client-ip';

interface AuthRequest extends Request {
  studentSession: StudentSession;
}

@Controller('edge')
export class StudentAuthController {
  constructor(
    private readonly authService: StudentAuthService,
    private readonly auditService: AuditService,
    @InjectRepository(StudentSession)
    private readonly sessionRepo: Repository<StudentSession>,
  ) {}

  private getClientIp(req: Request): string {
    return getClientIpFromRequest(req);
  }

  @Get('room-context')
  async roomContext() {
    return this.authService.getRoomContext();
  }

  @Post('login')
  async login(@Body() dto: StudentLoginDto, @Req() req: Request) {
    const account = (dto.examAccount ?? dto.sbd ?? '').trim();
    if (!account) throw new BadRequestException('Thiếu tài khoản thi');
    return this.authService.login(account, dto.pin, dto.examSessionId, this.getClientIp(req));
  }

  @Get('exam')
  @UseGuards(StudentAuthGuard)
  async getExam(@Req() req: AuthRequest) {
    return this.authService.getExam(req.studentSession);
  }

  @Patch('answers')
  @UseGuards(StudentAuthGuard)
  @UseInterceptors(IdempotencyInterceptor)
  async autosave(@Req() req: AuthRequest, @Body() dto: AutosaveDto) {
    return this.authService.autosave(req.studentSession, dto.answers, this.getClientIp(req));
  }

  @Post('submit')
  @UseGuards(StudentAuthGuard)
  async submit(@Req() req: AuthRequest) {
    return this.authService.submit(req.studentSession, this.getClientIp(req));
  }

  @Post('submit-retry')
  @UseGuards(StudentAuthGuard)
  async submitRetry(@Req() req: AuthRequest) {
    await this.authService.queueSubmitRetry(req.studentSession.id);
    return { queued: true };
  }

  @Post('focus-violation')
  @UseGuards(StudentAuthGuard)
  async focusViolation(@Req() req: AuthRequest, @Body() dto: FocusViolationDto) {
    const session = req.studentSession;
    const violations = session.violations || { count: 0, events: [] };
    violations.count += 1;
    violations.events.push({ at: new Date().toISOString(), reason: dto.reason });
    session.violations = violations;

    const maxViolations = session.examSession?.rules?.proctoring?.max_focus_violations ?? 3;
    if (violations.count >= maxViolations) {
      session.status = StudentSessionStatus.CHEATING;
      session.locked = true;
    }

    await this.sessionRepo.save(session);
    await this.auditService.log({
      eventType: AuditEventType.FOCUS_VIOLATION,
      examSessionId: session.examSessionId,
      studentSessionId: session.id,
      ip: this.getClientIp(req),
      payload: { count: violations.count },
    });

    return { violations: violations.count, status: session.status };
  }

  @Post('violations/batch')
  @UseGuards(StudentAuthGuard)
  async violationsBatch(
    @Req() req: AuthRequest,
    @Body() body: { events: Array<{ reason?: string; at?: string }> },
  ) {
    const session = req.studentSession;
    const violations = session.violations || { count: 0, events: [] };
    for (const ev of body.events ?? []) {
      violations.count += 1;
      violations.events.push({ at: ev.at ?? new Date().toISOString(), reason: ev.reason });
    }
    session.violations = violations;
    const maxViolations = session.examSession?.rules?.proctoring?.max_focus_violations ?? 3;
    if (violations.count >= maxViolations) {
      session.status = StudentSessionStatus.CHEATING;
      session.locked = true;
    }
    await this.sessionRepo.save(session);
    return { violations: violations.count, status: session.status, synced: body.events?.length ?? 0 };
  }

  @Post('heartbeat')
  @UseGuards(StudentAuthGuard)
  async heartbeat(@Req() req: AuthRequest) {
    const session = req.studentSession;
    session.lastHeartbeat = new Date();
    if (session.status === StudentSessionStatus.OFFLINE) {
      session.status = StudentSessionStatus.ACTIVE;
    }
    await this.sessionRepo.save(session);
    return { ok: true };
  }

  @Post('audit/click')
  @UseGuards(StudentAuthGuard)
  async auditClick(@Req() req: AuthRequest, @Body() body: { target?: string }) {
    await this.auditService.log({
      eventType: AuditEventType.CLICK,
      examSessionId: req.studentSession.examSessionId,
      studentSessionId: req.studentSession.id,
      ip: this.getClientIp(req),
      payload: body,
    });
    return { ok: true };
  }
}
