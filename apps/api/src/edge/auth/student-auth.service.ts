import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, Optional, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { StudentSession } from '../../database/entities/student-session.entity';
import { ExamSession } from '../../database/entities/exam-session.entity';
import { StudentSessionStatus, AuditEventType, aggregatePartScores, getDefaultStructure, enrichQuestionsWithPart, orderQuestionsByPart, DEFAULT_SCHOOL_NAME } from '@vnu/shared-types';
import { QuestionCluster } from '../../database/entities/question-cluster.entity';
import { In } from 'typeorm';
import { AuditService } from '../../shared/audit/audit.service';
import { ExamRouterService } from '../routing/exam-router.service';
import { ScoringService } from '../../shared/scoring/scoring.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ProctoringGateway } from '../proctoring/proctoring.gateway';
import { SubjectRoomCompletionService } from '../proctoring/subject-room-completion.service';
import { isIpBindingDisabled, normalizeClientIp } from '../../shared/utils/client-ip';

@Injectable()
export class StudentAuthService {
  private readonly logger = new Logger(StudentAuthService.name);

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
    private readonly proctoringGateway: ProctoringGateway,
    private readonly subjectRoomCompletion: SubjectRoomCompletionService,
  ) {}

  async getRoomContext() {
    const envSessionId = this.configService.get<string>('EDGE_ACTIVE_SESSION_ID');
    const roomName = this.configService.get<string>('EDGE_ROOM_NAME') || 'Phòng máy số 1';
    const capacity = parseInt(this.configService.get<string>('EDGE_ROOM_CAPACITY') || '30', 10);
    const schoolName = this.configService.get<string>('VITE_SCHOOL_NAME') || DEFAULT_SCHOOL_NAME;

    let examSessionId = envSessionId?.trim() || '';
    let sessionName = '';

    if (examSessionId) {
      const session = await this.examSessionRepo.findOne({ where: { id: examSessionId } });
      if (!session) throw new NotFoundException('Không tìm thấy ca thi đã cấu hình');
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
        if (!latest) throw new NotFoundException('Chưa có ca thi khả dụng');
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

  async login(account: string, pin: string, examSessionId: string | undefined, clientIp: string) {
    const normalizedIp = normalizeClientIp(clientIp);
    const trimmed = account.trim();
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

    if (!session) throw new UnauthorizedException('Sai tài khoản hoặc mã PIN');
    const valid = await bcrypt.compare(pin, session.pinHash);
    if (!valid) throw new UnauthorizedException('Sai tài khoản hoặc mã PIN');

    if (!isIpBindingDisabled()) {
      if (session.boundIp && normalizeClientIp(session.boundIp) !== normalizedIp) {
        throw new UnauthorizedException('Máy không khớp phòng thi đã gán');
      }
    }

    if (!session.boundIp) {
      session.boundIp = normalizedIp;
    }

    if (!session.examPaperId) {
      if (!session.subjectCode) {
        throw new BadRequestException('Chưa phân môn thi cho thí sinh');
      }
      const paper = await this.examRouter.resolvePaperBySubject(
        resolvedSessionId,
        session.subjectCode,
      );
      session.examPaperId = paper.id;
    }

    const singleActive = session.examSession?.rules?.proctoring?.single_active_session !== false;
    if (singleActive) {
      session.sessionVersion = (session.sessionVersion ?? 1) + 1;
    }

    if (process.env.NODE_ENV !== 'production') {
      session.locked = false;
      session.violations = { count: 0, events: [] };
    }

    session.status = StudentSessionStatus.ACTIVE;
    session.lastHeartbeat = new Date();

    await this.sessionRepo.save(session);

    const token = this.jwtService.sign({
      sub: session.id,
      sessionId: session.id,
      ip: normalizedIp,
      role: 'student',
      sessionVersion: session.sessionVersion,
    });

    await this.auditService.log({
      eventType: AuditEventType.LOGIN,
      examSessionId: resolvedSessionId,
      studentSessionId: session.id,
      ip: normalizedIp,
      payload: { sbd: session.sbd, examAccount: session.examAccount },
    });

    return {
      token,
      sessionId: session.id,
      examType: session.examSession?.rules?.exam_type,
      subjectCode: session.subjectCode,
      sbd: session.sbd,
      examAccount: session.examAccount,
    };
  }

  private async ensureSubjectSlotStarted(session: StudentSession) {
    if (!session.studentId || !session.subjectCode) return;
    const active = await this.examRouter.findActiveSlotForSession(session.id);
    if (active) return;

    const slots = await this.examRouter.listSubjectSlots(session.studentId, session.examSessionId);
    const slot = slots.find(
      (s) => s.subjectCode === session.subjectCode && s.status !== 'completed' && s.status !== 'locked',
    );
    if (!slot) return;

    try {
      await this.examRouter.startSubjectSlot(
        slot.id,
        session.studentId,
        session.examSessionId,
        session.id,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ca thi chưa mở';
      throw new BadRequestException(msg);
    }
  }

  async getExam(session: StudentSession) {
    const sessionWithPaper = await this.sessionRepo.findOne({
      where: { id: session.id },
      relations: ['examPaper', 'examSession', 'student'],
    });
    if (!sessionWithPaper?.examPaper) throw new BadRequestException('Chưa được phân đề thi');

    await this.ensureSubjectSlotStarted(sessionWithPaper);

    const paper = sessionWithPaper.examPaper;
    const examSession = sessionWithPaper.examSession;
    const rules = examSession.rules;
    const template = await this.examRouter.getStructureTemplateForSession(examSession, paper.subject);
    const uiMode =
      template?.uiMode ??
      rules?.subjects?.find((s) => s.code === paper.subject)?.ui_mode ??
      'vertical_focus';

    const rawQuestions = paper.questions as Array<Record<string, unknown>>;
    const structure = template ?? getDefaultStructure(paper.subject);
    const partOrder = structure ? Object.keys(structure.parts) : [];
    const normalizedRaw = enrichQuestionsWithPart(
      rawQuestions as Array<{ id: string; type?: string; part?: string; partKey?: string }>,
      structure ?? undefined,
    ) as Array<Record<string, unknown> & { id: string }>;
    const shuffleWithinPart = structure?.shuffleWithinPart ?? true;
    const orderedRaw: Array<Record<string, unknown> & { id: string }> =
      partOrder.length > 0
        ? (orderQuestionsByPart(normalizedRaw, partOrder, session.id, { shuffleWithinPart }) as Array<
            Record<string, unknown> & { id: string }
          >)
        : normalizedRaw;
    const clusterIds = [
      ...new Set(orderedRaw.map((q) => q.clusterId as string).filter(Boolean)),
    ];
    const clusters =
      clusterIds.length > 0
        ? await this.clusterRepo.find({ where: { id: In(clusterIds) } })
        : [];
    const clusterMap = new Map(clusters.map((c) => [c.id, c]));

    const questions = orderedRaw.map((q) => {
      const stripped = this.scoringService.stripCorrectKey(q);
      const cluster = q.clusterId ? clusterMap.get(String(q.clusterId)) : undefined;
      if (cluster) {
        const passageText =
          (cluster.passage as { text?: string })?.text ??
          (cluster.passage as { body?: string })?.body ??
          '';
        return {
          ...stripped,
          clusterSubtype: cluster.clusterSubtype,
          passage: cluster.passage,
          part: (q.part as string | undefined) ?? (stripped.part as string | undefined),
          content: {
            ...(stripped.content as Record<string, unknown>),
            subtype: cluster.clusterSubtype,
            passage: passageText,
          },
        };
      }
      return stripped;
    });

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
      sessionName: examSession.name,
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
      relations: ['examPaper', 'examSession', 'student'],
    });
    if (!sessionFull?.examPaper) throw new BadRequestException('Chưa được phân đề thi');

    const examSession = sessionFull.examSession;
    const activeSlot = await this.examRouter.findActiveSlotForSession(session.id);

    if (sessionFull.submittedAt) {
      const prior = sessionFull.examPaper;
      return {
        total: (sessionFull.scoreResult as { total?: number })?.total,
        breakdown: (sessionFull.scoreResult as { breakdown?: unknown[] })?.breakdown,
        partScores: (sessionFull.scoreResult as { partScores?: Record<string, number> })?.partScores,
        subject: prior.subject,
        sbd: sessionFull.sbd,
        examAccount: sessionFull.examAccount,
        serverNow: new Date().toISOString(),
      };
    }

    const paper = sessionFull.examPaper;
    const questionList = Array.isArray(paper.questions) ? paper.questions : [];
    const questions = (questionList as Array<{
      id: string;
      type: 'mcq' | 'true_false' | 'short_answer' | 'essay' | 'cluster_mcq';
      correctKey: unknown;
      maxScore?: number;
      bankQuestionId?: string;
      part?: string;
      partKey?: string;
    }>).map((q) => ({
      ...q,
      part: q.part ?? q.partKey,
    }));

    const examRules = examSession?.rules ?? {};
    const answers = sessionFull.answers ?? {};
    let result;
    try {
      result = this.scoringService.scoreExam(
        questions,
        answers,
        examRules,
        sessionFull.id,
        paper.subject,
      );
    } catch (err) {
      this.logger.error(`scoreExam failed for session ${sessionFull.id}`, err instanceof Error ? err.stack : err);
      throw err;
    }

    const partScores = aggregatePartScores(questions, result.breakdown);

    try {
      await this.scoringService.createGradingFlags(sessionFull.id, result.breakdown, answers);
      await this.scoringService.updateDifficultyStats(questions, answers);
    } catch (err) {
      this.logger.warn(
        `createGradingFlags/updateDifficultyStats failed for session ${sessionFull.id}: ${err instanceof Error ? err.message : err}`,
      );
    }

    const scorePayload = {
      ...(result as unknown as Record<string, unknown>),
      partScores,
      subject: paper.subject,
      informaticsBranchInvalid:
        (result as { informaticsBranchInvalid?: boolean }).informaticsBranchInvalid === true
          ? true
          : undefined,
    };

    if (activeSlot) {
      await this.examRouter.completeSubjectSlot(
        activeSlot.id,
        scorePayload,
        sessionFull.violations?.count ?? 0,
      );
    }

    sessionFull.submittedAt = new Date();
    sessionFull.status = StudentSessionStatus.SUBMITTED;
    sessionFull.scoreResult = scorePayload;
    await this.sessionRepo.save(sessionFull);

    await this.proctoringGateway.broadcastGrid(sessionFull.examSessionId).catch((err) => {
      this.logger.warn(`broadcastGrid after submit: ${err instanceof Error ? err.message : err}`);
    });
    try {
      this.proctoringGateway.emitScoreUpdate(sessionFull.examSessionId, {
        slotId: activeSlot?.id,
        sbd: sessionFull.sbd,
        subjectCode: paper.subject,
        scoreTotal: result.total,
        partScores,
      });
    } catch (err) {
      this.logger.warn(`emitScoreUpdate after submit: ${err instanceof Error ? err.message : err}`);
    }

    const labRoom =
      sessionFull.student?.labRoom?.trim() ||
      this.configService.get<string>('EDGE_ROOM_NAME') ||
      'Phòng máy số 1';
    try {
      await this.subjectRoomCompletion.checkAfterSubmit(
        sessionFull.examSessionId,
        paper.subject,
        labRoom,
      );
    } catch (err) {
      this.logger.warn(`checkAfterSubmit: ${err instanceof Error ? err.message : err}`);
    }

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
    }).catch((err) => {
      this.logger.warn(`audit log after submit: ${err instanceof Error ? err.message : err}`);
    });

    return {
      total: result.total,
      breakdown: result.breakdown,
      partScores,
      subject: paper.subject,
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
    try {
      await this.submit(session, session.boundIp || 'retry-inline');
    } catch (err) {
      this.logger.error(`inline submit-retry failed for ${sessionId}`, err instanceof Error ? err.stack : err);
      throw err;
    }
  }
}
