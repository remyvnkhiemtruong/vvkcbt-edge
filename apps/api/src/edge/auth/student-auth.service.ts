import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, HttpException, HttpStatus, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { StudentSession } from '../../database/entities/student-session.entity';
import { ExamSession } from '../../database/entities/exam-session.entity';
import { StudentSessionStatus, AuditEventType, aggregatePartScores } from '@vnu/shared-types';
import { QuestionCluster } from '../../database/entities/question-cluster.entity';
import { In } from 'typeorm';
import { AuditService } from '../../shared/audit/audit.service';
import { ExamRouterService } from '../routing/exam-router.service';
import { ScoringService } from '../../shared/scoring/scoring.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RateLimitService } from '../../shared/rate-limit/rate-limit.service';
import { ProctoringGateway } from '../proctoring/proctoring.gateway';

@Injectable()
export class StudentAuthService {
  constructor(
    @InjectRepository(StudentSession)
    private readonly sessionRepo: Repository<StudentSession>,
    @InjectRepository(ExamSession)
    private readonly examSessionRepo: Repository<ExamSession>,
    @InjectRepository(QuestionCluster)
    private readonly clusterRepo: Repository<QuestionCluster>,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    private readonly examRouter: ExamRouterService,
    private readonly scoringService: ScoringService,
    @Optional() @InjectQueue('submit-retry') private readonly submitQueue: Queue | undefined,
    private readonly configService: ConfigService,
    private readonly rateLimit: RateLimitService,
    private readonly proctoringGateway: ProctoringGateway,
  ) {}

  async getRoomContext() {
    const envSessionId = this.configService.get<string>('EDGE_ACTIVE_SESSION_ID');
    const roomName = this.configService.get<string>('EDGE_ROOM_NAME') || 'Phòng máy số 1';
    const capacity = parseInt(this.configService.get<string>('EDGE_ROOM_CAPACITY') || '30', 10);
    const schoolName = this.configService.get<string>('VITE_SCHOOL_NAME') || 'THPT Võ Văn Kiệt - Cà Mau';

    let examSessionId = envSessionId?.trim() || '';
    let sessionName = '';

    if (examSessionId) {
      const session = await this.examSessionRepo.findOne({ where: { id: examSessionId } });
      if (!session) throw new NotFoundException('Configured exam session not found');
      sessionName = session.name;
    } else {
      const sessions = await this.examSessionRepo.find({
        where: { status: 'active' },
        order: { startAt: 'DESC' },
      });
      const tnSession = sessions.find((s) => s.rules?.exam_type === 'TN_THPT_2025');
      const active = tnSession ?? sessions[0];
      if (!active) {
        const latest = await this.examSessionRepo.findOne({ order: { createdAt: 'DESC' } });
        if (!latest) throw new NotFoundException('No exam session available');
        examSessionId = latest.id;
        sessionName = latest.name;
      } else {
        examSessionId = active.id;
        sessionName = active.name;
      }
    }

    return { examSessionId, roomName, capacity, schoolName, sessionName };
  }

  private async resolveExamSessionId(examSessionId?: string): Promise<string> {
    if (examSessionId?.trim()) return examSessionId.trim();
    const ctx = await this.getRoomContext();
    return ctx.examSessionId;
  }

  private async checkRateLimit(sbd: string) {
    try {
      await this.rateLimit.check(`student:${sbd}`, 5, 60);
    } catch {
      throw new HttpException('Quá nhiều lần đăng nhập. Vui lòng thử lại sau.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  async login(account: string, pin: string, examSessionId: string | undefined, clientIp: string) {
    const trimmed = account.trim();
    await this.checkRateLimit(trimmed);
    const resolvedSessionId = await this.resolveExamSessionId(examSessionId);

    let session = await this.sessionRepo.findOne({
      where: { examAccount: trimmed, examSessionId: resolvedSessionId },
      relations: ['student', 'examSession'],
    });
    if (!session) {
      session = await this.sessionRepo.findOne({
        where: { sbd: trimmed, examSessionId: resolvedSessionId },
        relations: ['student', 'examSession'],
      });
    }

    if (!session) throw new UnauthorizedException('Invalid account or PIN');
    const valid = await bcrypt.compare(pin, session.pinHash);
    if (!valid) throw new UnauthorizedException('Invalid account or PIN');

    if (session.boundIp && session.boundIp !== clientIp) {
      throw new UnauthorizedException('IP binding mismatch');
    }

    if (!session.boundIp) {
      session.boundIp = clientIp;
    }

    if (!session.examPaperId) {
      if (session.subjectCode) {
        const paper = await this.examRouter.resolvePaperBySubject(
          resolvedSessionId,
          session.subjectCode,
        );
        session.examPaperId = paper.id;
      } else {
        const paper = await this.examRouter.resolvePaper(
          resolvedSessionId,
          session.studentId,
          session.student?.comboCode,
          session.student?.subjectGroup,
        );
        session.examPaperId = paper.id;
      }
    }

    const singleActive = session.examSession?.rules?.proctoring?.single_active_session !== false;
    if (singleActive) {
      session.sessionVersion = (session.sessionVersion ?? 1) + 1;
    }

    session.status = StudentSessionStatus.ACTIVE;
    session.lastHeartbeat = new Date();
    await this.sessionRepo.save(session);

    const token = this.jwtService.sign({
      sub: session.id,
      sessionId: session.id,
      ip: clientIp,
      role: 'student',
      sessionVersion: session.sessionVersion,
    });

    await this.auditService.log({
      eventType: AuditEventType.LOGIN,
      examSessionId: resolvedSessionId,
      studentSessionId: session.id,
      ip: clientIp,
      payload: { sbd: session.sbd, examAccount: session.examAccount },
    });

    const hasPersonalSlots =
      this.examRouter.isTnptPersonalized(session.examSession) || !!session.subjectCode;

    return {
      token,
      sessionId: session.id,
      examType: session.examSession?.rules?.exam_type,
      hasPersonalSlots,
      subjectCode: session.subjectCode,
      sbd: session.sbd,
      examAccount: session.examAccount,
    };
  }

  async listSlots(session: StudentSession) {
    if (!session.studentId) throw new BadRequestException('No student linked');
    const slots = await this.examRouter.listSubjectSlots(session.studentId, session.examSessionId);
    if (session.subjectCode) {
      return slots.filter((s) => s.subjectCode === session.subjectCode);
    }
    return slots;
  }

  async startSlot(session: StudentSession, slotId: string) {
    if (!session.studentId) throw new BadRequestException('No student linked');
    const started = await this.examRouter.startSubjectSlot(
      slotId,
      session.studentId,
      session.examSessionId,
      session.id,
    );
    session.examPaperId = started.paperId;
    session.answers = {};
    session.submittedAt = undefined;
    session.scoreResult = undefined;
    session.status = StudentSessionStatus.ACTIVE;
    session.locked = false;
    await this.sessionRepo.save(session);
    return started;
  }

  async prefetchSlot(session: StudentSession, slotId: string) {
    if (!session.studentId) throw new BadRequestException('No student linked');
    try {
      const { slot, paper } = await this.examRouter.prefetchSlotPaper(
        session.studentId,
        session.examSessionId,
        slotId,
      );
      const questions = (paper.questions as Record<string, unknown>[]).map((q) =>
        this.scoringService.stripCorrectKey(q),
      );
      return {
        slotId: slot.id,
        subject: slot.subjectCode,
        scheduledStart: slot.scheduledStart,
        scheduledEnd: slot.scheduledEnd,
        paper: { id: paper.id, title: paper.title, questions },
      };
    } catch {
      throw new NotFoundException('Không tải được đề cho ca thi');
    }
  }

  async getExam(session: StudentSession) {
    const sessionWithPaper = await this.sessionRepo.findOne({
      where: { id: session.id },
      relations: ['examPaper', 'examSession'],
    });
    if (!sessionWithPaper?.examPaper) throw new BadRequestException('No exam paper assigned');

    const paper = sessionWithPaper.examPaper;
    const rawQuestions = paper.questions as Array<Record<string, unknown>>;
    const clusterIds = [
      ...new Set(rawQuestions.map((q) => q.clusterId as string).filter(Boolean)),
    ];
    const clusters =
      clusterIds.length > 0
        ? await this.clusterRepo.find({ where: { id: In(clusterIds) } })
        : [];
    const clusterMap = new Map(clusters.map((c) => [c.id, c]));

    const questions = rawQuestions.map((q) => {
      const stripped = this.scoringService.stripCorrectKey(q);
      const cluster = q.clusterId ? clusterMap.get(q.clusterId as string) : undefined;
      if (cluster) {
        const passageText =
          (cluster.passage as { text?: string })?.text ??
          (cluster.passage as { body?: string })?.body ??
          '';
        return {
          ...stripped,
          clusterSubtype: cluster.clusterSubtype,
          passage: cluster.passage,
          part: q.part ?? stripped.part,
          content: {
            ...(stripped.content as Record<string, unknown>),
            subtype: cluster.clusterSubtype,
            passage: passageText,
          },
        };
      }
      return stripped;
    });

    const examSession = sessionWithPaper.examSession;
    const rules = examSession.rules;
    const template = await this.examRouter.getStructureTemplateForSession(examSession, paper.subject);
    const uiMode =
      template?.uiMode ??
      rules?.subjects?.find((s) => s.code === paper.subject)?.ui_mode ??
      'vertical_focus';

    const now = new Date();
    let endsAt: string | undefined;
    if (sessionWithPaper.studentId) {
      const activeSlot = await this.examRouter.findActiveSlotForSession(session.id);
      if (activeSlot?.scheduledEnd) {
        endsAt = new Date(activeSlot.scheduledEnd).toISOString();
      } else if (sessionWithPaper.subjectCode) {
        const slots = await this.examRouter.listSubjectSlots(
          sessionWithPaper.studentId,
          sessionWithPaper.examSessionId,
        );
        const slot = slots.find((s) => s.subjectCode === sessionWithPaper.subjectCode);
        if (slot?.scheduledEnd) endsAt = new Date(slot.scheduledEnd).toISOString();
      }
    }
    if (!endsAt && examSession.startAt) {
      const durationMin = (template?.durationMin ?? examSession.durationMin) + session.timeExtensionMin;
      const end = new Date(examSession.startAt);
      end.setMinutes(end.getMinutes() + durationMin);
      endsAt = end.toISOString();
    }

    return {
      sessionId: session.id,
      paperId: paper.id,
      title: paper.title,
      subject: paper.subject,
      questions,
      serverNow: now.toISOString(),
      endsAt,
      sbd: session.sbd,
      examAccount: session.examAccount,
      rules: {
        durationMin: (template?.durationMin ?? examSession.durationMin) + session.timeExtensionMin,
        startAt: examSession.startAt,
        uiMode,
        proctoring: rules.proctoring,
        audio: rules.audio,
        structureTemplate: template ? { code: template.code, parts: template.parts } : null,
      },
      answers: session.answers,
      locked: session.locked,
    };
  }

  async autosave(session: StudentSession, answers: Record<string, unknown>, ip: string) {
    session.answers = { ...session.answers, ...answers };
    session.lastHeartbeat = new Date();
    if (session.status === StudentSessionStatus.OFFLINE) {
      session.status = StudentSessionStatus.ACTIVE;
    }
    await this.sessionRepo.save(session);

    await this.auditService.log({
      eventType: AuditEventType.AUTOSAVE,
      examSessionId: session.examSessionId,
      studentSessionId: session.id,
      ip,
    });

    return { saved: true, timestamp: new Date().toISOString() };
  }

  async submit(session: StudentSession, ip: string) {
    const sessionFull = await this.sessionRepo.findOne({
      where: { id: session.id },
      relations: ['examPaper', 'examSession'],
    });
    if (!sessionFull?.examPaper) throw new BadRequestException('No exam paper assigned');

    const isMultiSubject = this.examRouter.isTnptPersonalized(sessionFull.examSession);
    const activeSlot = isMultiSubject
      ? await this.examRouter.findActiveSlotForSession(session.id)
      : null;

    if (!isMultiSubject && sessionFull.submittedAt) {
      return sessionFull.scoreResult;
    }

    const paper = sessionFull.examPaper;
    const questions = paper.questions as Array<{
      id: string;
      type: 'mcq' | 'true_false' | 'short_answer' | 'essay' | 'cluster_mcq';
      correctKey: unknown;
      maxScore?: number;
      bankQuestionId?: string;
      part?: string;
    }>;

    const result = this.scoringService.scoreExam(
      questions,
      sessionFull.answers,
      sessionFull.examSession.rules,
      sessionFull.id,
    );

    const partScores = aggregatePartScores(questions, result.breakdown);
    const pendingManual = paper.subject === 'LITERATURE';

    await this.scoringService.createGradingFlags(sessionFull.id, result.breakdown, sessionFull.answers);
    await this.scoringService.updateDifficultyStats(questions, sessionFull.answers);

    const scorePayload = {
      ...(result as unknown as Record<string, unknown>),
      partScores,
      pendingManual,
      subject: paper.subject,
    };

    let hasMoreSlots = false;
    if (isMultiSubject && activeSlot) {
      await this.examRouter.completeSubjectSlot(
        activeSlot.id,
        scorePayload,
        sessionFull.violations?.count ?? 0,
      );
      const pending = await this.examRouter.countPendingSlots(
        sessionFull.id,
        sessionFull.studentId,
        sessionFull.examSessionId,
      );
      hasMoreSlots = pending > 0;
      sessionFull.answers = {};
      sessionFull.submittedAt = undefined;
      sessionFull.scoreResult = undefined;
      sessionFull.status = StudentSessionStatus.ACTIVE;
      await this.sessionRepo.save(sessionFull);
    } else {
      sessionFull.submittedAt = new Date();
      sessionFull.status = StudentSessionStatus.SUBMITTED;
      sessionFull.scoreResult = scorePayload;
      await this.sessionRepo.save(sessionFull);
    }

    await this.proctoringGateway.broadcastGrid(sessionFull.examSessionId);
    this.proctoringGateway.emitScoreUpdate(sessionFull.examSessionId, {
      slotId: activeSlot?.id,
      sbd: sessionFull.sbd,
      subjectCode: paper.subject,
      scoreTotal: result.total,
      partScores,
    });

    await this.auditService.log({
      eventType: AuditEventType.SUBMIT,
      examSessionId: sessionFull.examSessionId,
      studentSessionId: sessionFull.id,
      ip,
      payload: {
        total: result.total,
        subject: paper.subject,
        slotId: activeSlot?.id,
      },
    });

    return {
      total: result.total,
      breakdown: result.breakdown,
      partScores,
      pendingManual,
      subject: paper.subject,
      hasMoreSlots,
      sbd: sessionFull.sbd,
      examAccount: sessionFull.examAccount,
      serverNow: new Date().toISOString(),
    };
  }

  async queueSubmitRetry(sessionId: string) {
    if (this.submitQueue) {
      await this.submitQueue.add('retry-submit', { sessionId }, { attempts: 10, backoff: { type: 'exponential', delay: 3000 } });
      return;
    }
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['examSession', 'examPaper', 'student'],
    });
    if (!session || session.submittedAt) return;
    await this.submit(session, session.boundIp || 'retry-inline');
  }
}
