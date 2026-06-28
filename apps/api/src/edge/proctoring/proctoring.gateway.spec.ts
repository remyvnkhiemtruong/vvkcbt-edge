import { WsException } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ProctorActionType } from '@vnu/shared-types';
import { ProctoringGateway } from './proctoring.gateway';

function makeClient(token?: string) {
  return {
    id: 'socket-1',
    handshake: { auth: token !== undefined ? { token } : {} },
    join: jest.fn(),
    emit: jest.fn(),
  } as never;
}

describe('ProctoringGateway auth', () => {
  const jwtVerify = jest.fn();
  const sessionFindOne = jest.fn();
  const sessionSave = jest.fn();
  const sessionUpdate = jest.fn();
  const auditLog = jest.fn();
  const proctorActionSave = jest.fn();
  const proctorActionCreate = jest.fn((x) => x);

  let gateway: ProctoringGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    sessionSave.mockResolvedValue(undefined);
    sessionUpdate.mockResolvedValue(undefined);
    auditLog.mockResolvedValue(undefined);
    proctorActionSave.mockResolvedValue(undefined);

    gateway = new ProctoringGateway(
      { findOne: sessionFindOne, save: sessionSave, update: sessionUpdate } as never,
      {} as never,
      {
        save: proctorActionSave,
        create: proctorActionCreate,
      } as never,
      { log: auditLog } as never,
      { verify: jwtVerify } as unknown as JwtService,
      { get: jest.fn() } as unknown as ConfigService,
    );
    gateway.server = {
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    } as never;
    (gateway as unknown as { broadcastGrid: jest.Mock }).broadcastGrid = jest
      .fn()
      .mockResolvedValue(undefined);
  });

  describe('proctorAction', () => {
    it('throws WsException when token is missing', async () => {
      await expect(
        gateway.proctorAction(makeClient(), {
          examSessionId: 'exam-1',
          studentSessionId: 'student-1',
          action: ProctorActionType.LOCK_EXAM,
        }),
      ).rejects.toThrow(WsException);
    });

    it('throws WsException when role is student', async () => {
      jwtVerify.mockReturnValue({ sub: 'student-1', role: 'student', sessionId: 'student-1' });
      await expect(
        gateway.proctorAction(makeClient('token'), {
          examSessionId: 'exam-1',
          studentSessionId: 'student-1',
          action: ProctorActionType.LOCK_EXAM,
        }),
      ).rejects.toThrow(WsException);
    });
  });

  describe('focusViolation', () => {
    it('throws WsException when token is missing', async () => {
      await expect(
        gateway.focusViolation(makeClient(), { sessionId: 'other-session' }),
      ).rejects.toThrow(WsException);
    });

    it('uses JWT sessionId for student, ignoring client data.sessionId', async () => {
      const ownSessionId = 'my-session-id';
      const otherSessionId = 'other-session-id';
      jwtVerify.mockReturnValue({
        sub: ownSessionId,
        role: 'student',
        sessionId: ownSessionId,
      });
      sessionFindOne.mockResolvedValue({
        id: ownSessionId,
        violations: { count: 0, events: [] },
        examSession: { rules: { proctoring: { max_focus_violations: 3 } } },
        examSessionId: 'exam-1',
      });

      await gateway.focusViolation(makeClient('token'), { sessionId: otherSessionId });

      expect(sessionFindOne).toHaveBeenCalledWith({
        where: { id: ownSessionId },
        relations: ['examSession'],
      });
      expect(sessionFindOne).not.toHaveBeenCalledWith({
        where: { id: otherSessionId },
        relations: ['examSession'],
      });
    });
  });

  describe('helpRequest', () => {
    it('throws WsException when token is missing', async () => {
      await expect(
        gateway.helpRequest(makeClient(), { sessionId: 'session-1' }),
      ).rejects.toThrow(WsException);
    });

    it('throws WsException when role is proctor', async () => {
      jwtVerify.mockReturnValue({ sub: 'proctor', role: 'proctor' });
      await expect(
        gateway.helpRequest(makeClient('token'), { sessionId: 'session-1' }),
      ).rejects.toThrow(WsException);
    });

    it('uses JWT sessionId for student help request', async () => {
      const ownSessionId = 'my-session-id';
      jwtVerify.mockReturnValue({
        sub: ownSessionId,
        role: 'student',
        sessionId: ownSessionId,
      });
      sessionFindOne.mockResolvedValue({
        id: ownSessionId,
        examSessionId: 'exam-1',
        sbd: '120001',
      });

      await gateway.helpRequest(makeClient('token'), { sessionId: 'spoofed-id' });

      expect(sessionFindOne).toHaveBeenCalledWith({
        where: { id: ownSessionId },
        relations: ['examSession'],
      });
    });
  });
});
