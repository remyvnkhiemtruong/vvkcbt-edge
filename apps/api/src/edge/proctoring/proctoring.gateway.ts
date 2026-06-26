import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { StudentSession } from '../../database/entities/student-session.entity';
import { StudentSubjectSlot } from '../../database/entities/student-subject-slot.entity';
import { ProctorAction } from '../../database/entities/proctor-action.entity';
import { StudentSessionStatus, ProctorActionType, AuditEventType, TN_THPT_SUBJECTS } from '@vnu/shared-types';
import { AuditService } from '../../shared/audit/audit.service';
import { StaffRole } from '../../shared/guards/staff-auth.guard';

function parseWsCorsOrigins(): string[] | boolean {
  const raw = process.env.EDGE_ORIGINS?.trim();
  if (!raw) return process.env.NODE_ENV === 'production' ? false : true;
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

export interface ProctorGridOptions {
  subjectCode?: string;
  room?: string;
}

const SUBJECT_VI = Object.fromEntries(TN_THPT_SUBJECTS.map((s) => [s.code, s.nameVi]));

@WebSocketGateway({
  namespace: '/proctoring',
  cors: {
    origin: parseWsCorsOrigins(),
    credentials: true,
  },
})
@Injectable()
export class ProctoringGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ProctoringGateway.name);
  private studentSockets = new Map<string, string>();
  private proctorRooms = new Map<string, Set<string>>();

  constructor(
    @InjectRepository(StudentSession)
    private readonly sessionRepo: Repository<StudentSession>,
    @InjectRepository(StudentSubjectSlot)
    private readonly slotRepo: Repository<StudentSubjectSlot>,
    @InjectRepository(ProctorAction)
    private readonly proctorActionRepo: Repository<ProctorAction>,
    private readonly auditService: AuditService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async afterInit() {
    try {
      const host = this.configService.get<string>('REDIS_HOST') || 'localhost';
      const port = parseInt(this.configService.get<string>('REDIS_PORT') || '6379', 10);
      const pubClient = new Redis({ host, port, maxRetriesPerRequest: 1, lazyConnect: true });
      const subClient = pubClient.duplicate();
      await pubClient.connect();
      await subClient.connect();
      this.server.adapter(createAdapter(pubClient, subClient));
      this.logger.log('Socket.IO Redis adapter enabled');
    } catch (err) {
      this.logger.warn(
        `Redis adapter unavailable — single-node WebSocket mode (${err instanceof Error ? err.message : 'unknown'})`,
      );
    }
  }

  private verifySocketToken(
    client: Socket,
    allowedRoles: Array<StaffRole | 'student'>,
  ): { sub: string; role: string; sessionId?: string } {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) throw new WsException('Missing token');

    try {
      const payload = this.jwtService.verify<{
        sub: string;
        role: string;
        sessionId?: string;
      }>(token);
      if (!payload.role || !allowedRoles.includes(payload.role as StaffRole | 'student')) {
        throw new WsException('Insufficient role');
      }
      return payload;
    } catch (err) {
      if (err instanceof WsException) throw err;
      throw new WsException('Invalid token');
    }
  }

  handleConnection(client: Socket) {
    client.emit('connected', { id: client.id });
  }

  handleDisconnect(client: Socket) {
    for (const [sessionId, socketId] of this.studentSockets.entries()) {
      if (socketId === client.id) {
        this.studentSockets.delete(sessionId);
        break;
      }
    }
  }

  @SubscribeMessage('join_proctor')
  async joinProctor(client: Socket, data: { examSessionId: string }) {
    this.verifySocketToken(client, ['proctor', 'admin']);
    const room = `session:${data.examSessionId}`;
    client.join(room);
    if (!this.proctorRooms.has(room)) this.proctorRooms.set(room, new Set());
    this.proctorRooms.get(room)!.add(client.id);
    const grid = await this.getGrid(data.examSessionId);
    client.emit('grid_update', grid);
  }

  @SubscribeMessage('join_student')
  async joinStudent(client: Socket, _data: { sessionId?: string }) {
    const payload = this.verifySocketToken(client, ['student']);
    const sessionId = payload.sessionId;
    if (!sessionId) throw new WsException('Missing sessionId in token');
    this.studentSockets.set(sessionId, client.id);
    client.join(`student:${sessionId}`);
  }

  @SubscribeMessage('heartbeat')
  async heartbeat(client: Socket, data: { sessionId: string }) {
    await this.sessionRepo.update(data.sessionId, {
      lastHeartbeat: new Date(),
      status: StudentSessionStatus.ACTIVE,
    });
  }

  @SubscribeMessage('help_request')
  async helpRequest(client: Socket, data: { sessionId: string; reason?: string }) {
    const session = await this.sessionRepo.findOne({
      where: { id: data.sessionId },
      relations: ['examSession'],
    });
    if (!session) return;

    await this.auditService.log({
      eventType: AuditEventType.HELP_REQUEST,
      examSessionId: session.examSessionId,
      studentSessionId: session.id,
      payload: { reason: data.reason ?? 'student_help', sbd: session.sbd },
    });

    this.server.to(`session:${session.examSessionId}`).emit('help_alert', {
      sessionId: session.id,
      sbd: session.sbd,
      reason: data.reason ?? 'Yêu cầu hỗ trợ / đổi máy',
    });
  }

  @SubscribeMessage('focus_violation')
  async focusViolation(client: Socket, data: { sessionId: string; reason?: string }) {
    const session = await this.sessionRepo.findOne({
      where: { id: data.sessionId },
      relations: ['examSession'],
    });
    if (!session) return;

    const violations = session.violations || { count: 0, events: [] };
    violations.count += 1;
    session.violations = violations;

    const max = session.examSession?.rules?.proctoring?.max_focus_violations ?? 3;
    if (violations.count >= max) {
      session.status = StudentSessionStatus.CHEATING;
      this.server.to(`session:${session.examSessionId}`).emit('cheating_alert', {
        sessionId: session.id,
        sbd: session.sbd,
        violations: violations.count,
      });
    }
    await this.sessionRepo.save(session);
    await this.broadcastGrid(session.examSessionId);
  }

  @SubscribeMessage('proctor_action')
  async proctorAction(
    client: Socket,
    data: {
      examSessionId: string;
      studentSessionId: string;
      action: ProctorActionType;
      payload?: Record<string, unknown>;
    },
  ) {
    const session = await this.sessionRepo.findOne({ where: { id: data.studentSessionId } });
    if (!session) return;

    await this.proctorActionRepo.save(
      this.proctorActionRepo.create({
        examSessionId: data.examSessionId,
        studentSessionId: data.studentSessionId,
        actionType: data.action,
        payload: data.payload ?? {},
      }),
    );

    switch (data.action) {
      case ProctorActionType.LOCK_EXAM:
        session.locked = true;
        session.status = StudentSessionStatus.LOCKED;
        this.emitToStudent(data.studentSessionId, 'force_lock', {});
        break;
      case ProctorActionType.EXTEND_TIME:
        session.timeExtensionMin += Number(data.payload?.minutes ?? 5);
        this.emitToStudent(data.studentSessionId, 'time_extend', { minutes: data.payload?.minutes });
        break;
      case ProctorActionType.FORCE_SUBMIT:
        this.emitToStudent(data.studentSessionId, 'force_submit', {});
        break;
      case ProctorActionType.RESET_SESSION:
        session.answers = {};
        session.violations = { count: 0, events: [] };
        session.status = StudentSessionStatus.ACTIVE;
        session.locked = false;
        session.submittedAt = undefined;
        session.scoreResult = undefined;
        this.emitToStudent(data.studentSessionId, 'reset_session', {});
        break;
    }

    await this.sessionRepo.save(session);
    await this.auditService.log({
      eventType: AuditEventType.PROCTOR_ACTION,
      examSessionId: data.examSessionId,
      studentSessionId: data.studentSessionId,
      payload: { action: data.action, ...data.payload },
    });
    await this.broadcastGrid(data.examSessionId);
  }

  private emitToStudent(sessionId: string, event: string, payload: unknown) {
    this.server.to(`student:${sessionId}`).emit(event, payload);
  }

  async getGrid(examSessionId: string, options: ProctorGridOptions = {}) {
    const sessions = await this.sessionRepo.find({
      where: { examSessionId },
      relations: ['examPaper', 'student', 'student.class'],
      order: { sbd: 'ASC' },
    });

    const slots = await this.slotRepo.find({ where: { examSessionId } });
    const slotByStudentSubject = new Map<string, StudentSubjectSlot>();
    for (const slot of slots) {
      slotByStudentSubject.set(`${slot.studentId}:${slot.subjectCode}`, slot);
    }

    let filtered = sessions;
    if (options.subjectCode) {
      filtered = filtered.filter((s) => s.subjectCode === options.subjectCode);
    }
    if (options.room) {
      filtered = filtered.filter((s) => {
        const lab = s.student?.labRoom?.trim();
        if (!lab) return options.room === (process.env.EDGE_ROOM_NAME || 'Phòng máy số 1');
        return lab === options.room;
      });
    }

    const now = Date.now();
    return filtered.map((s) => {
      let status = s.status;
      if (
        status === StudentSessionStatus.ACTIVE &&
        s.lastHeartbeat &&
        now - new Date(s.lastHeartbeat).getTime() > 10000
      ) {
        status = StudentSessionStatus.OFFLINE;
      }
      const answers = s.answers ?? {};
      const answeredCount = Object.keys(answers).filter((k) => {
        const v = answers[k];
        return v !== undefined && v !== null && v !== '';
      }).length;
      const questionCount = Array.isArray(s.examPaper?.questions)
        ? (s.examPaper!.questions as unknown[]).length
        : 0;

      const subjectCode = s.subjectCode ?? '';
      const slot =
        s.studentId && subjectCode
          ? slotByStudentSubject.get(`${s.studentId}:${subjectCode}`)
          : undefined;
      const scoreResult = (slot?.scoreResult ?? s.scoreResult) as Record<string, unknown> | undefined;
      const partScores = scoreResult?.partScores as
        | { part1?: number; part2?: number; part3?: number }
        | undefined;
      const submitted = slot?.status === 'completed' || !!s.submittedAt;

      return {
        id: s.id,
        sbd: s.sbd,
        examAccount: s.examAccount ?? '',
        status,
        violations: s.violations?.count ?? 0,
        locked: s.locked,
        submitted,
        lastHeartbeat: s.lastHeartbeat,
        answeredCount,
        questionCount,
        fullName: s.student?.fullName ?? '',
        className: s.student?.class?.name ?? '',
        labRoom: s.student?.labRoom ?? '',
        subjectCode,
        subjectNameVi: SUBJECT_VI[subjectCode] ?? subjectCode,
        slotId: slot?.id,
        slotStatus: slot?.status,
        scoreTotal: typeof scoreResult?.total === 'number' ? scoreResult.total : undefined,
        partScores,
        pendingManual: scoreResult?.pendingManual === true,
        submittedAt: slot?.submittedAt ?? s.submittedAt,
        manualOverride: scoreResult?.manualOverride === true,
      };
    });
  }

  emitScoreUpdate(
    examSessionId: string,
    payload: {
      slotId?: string;
      sbd: string;
      subjectCode?: string;
      scoreTotal?: number;
      partScores?: { part1?: number; part2?: number; part3?: number };
      manualOverride?: boolean;
    },
  ) {
    this.server.to(`session:${examSessionId}`).emit('score_update', payload);
  }

  emitSubjectRoomComplete(payload: {
    examSessionId: string;
    subjectCode: string;
    subjectNameVi: string;
    room: string;
    stats: { total: number; completed: number; isComplete: boolean };
    rows: Array<{
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
    }>;
    forced?: boolean;
  }) {
    this.server.to(`session:${payload.examSessionId}`).emit('subject_room_complete', payload);
  }

  async broadcastGrid(examSessionId: string, options?: ProctorGridOptions) {
    const grid = await this.getGrid(examSessionId, options);
    this.server.to(`session:${examSessionId}`).emit('grid_update', grid);
  }

  @Cron('*/5 * * * * *')
  async checkOfflineStudents() {
    const threshold = new Date(Date.now() - 10000);
    const sessions = await this.sessionRepo.find({
      where: {
        status: StudentSessionStatus.ACTIVE,
        lastHeartbeat: LessThan(threshold),
      },
    });

    for (const s of sessions) {
      s.status = StudentSessionStatus.OFFLINE;
      await this.sessionRepo.save(s);
      await this.broadcastGrid(s.examSessionId);
    }
  }
}
