import { useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { createSocket } from '@shared/index';
import { proctorFetch, SESSION_EXPIRED_MSG } from '../api';
import type { GridItemExtended } from './post-exam/StudentDetailPanel';
import type { SubjectRoomCompleteData } from './post-exam/ScoreboardOverlay';

type GridItem = GridItemExtended;

interface UseProctorSocketOptions {
  token: string;
  examSessionId: string;
  monitorSubject?: string;
  onGridUpdate: (grid: GridItem[]) => void;
  onScoreUpdate: (data: {
    sbd: string;
    scoreTotal?: number;
    partScores?: GridItem['partScores'];
  }) => void;
  onSubjectRoomComplete?: (data: SubjectRoomCompleteData) => void;
  onCheatingAlert?: (data: { sbd: string; violations: number }) => void;
  onHelpAlert?: (data: { sbd: string; reason?: string }) => void;
  onConnectedChange?: (connected: boolean) => void;
  onSessionExpired?: () => void;
}

export function useProctorSocket({
  token,
  examSessionId,
  monitorSubject,
  onGridUpdate,
  onScoreUpdate,
  onSubjectRoomComplete,
  onCheatingAlert,
  onHelpAlert,
  onConnectedChange,
  onSessionExpired,
}: UseProctorSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const callbacksRef = useRef({
    onGridUpdate,
    onScoreUpdate,
    onSubjectRoomComplete,
    onCheatingAlert,
    onHelpAlert,
    onConnectedChange,
    onSessionExpired,
  });
  callbacksRef.current = {
    onGridUpdate,
    onScoreUpdate,
    onSubjectRoomComplete,
    onCheatingAlert,
    onHelpAlert,
    onConnectedChange,
    onSessionExpired,
  };

  useEffect(() => {
    if (!token || !examSessionId) return;

    const socket = createSocket('/proctoring', token);
    socketRef.current = socket;

    socket.on('connect', () => {
      callbacksRef.current.onConnectedChange?.(true);
      socket.emit('join_proctor', { examSessionId });
    });
    socket.on('disconnect', () => callbacksRef.current.onConnectedChange?.(false));
    socket.on('grid_update', (data: GridItem[]) => callbacksRef.current.onGridUpdate(data));
    socket.on('score_update', (data: { sbd: string; scoreTotal?: number; partScores?: GridItem['partScores'] }) => {
      callbacksRef.current.onScoreUpdate(data);
    });
    socket.on('subject_room_complete', (data: SubjectRoomCompleteData) => {
      callbacksRef.current.onSubjectRoomComplete?.(data);
    });
    socket.on('cheating_alert', (data: { sbd: string; violations: number }) => {
      callbacksRef.current.onCheatingAlert?.(data);
    });
    socket.on('help_alert', (data: { sbd: string; reason?: string }) => {
      callbacksRef.current.onHelpAlert?.(data);
    });

    const gridQs = monitorSubject ? `?subjectCode=${encodeURIComponent(monitorSubject)}` : '';
    proctorFetch(`/proctor/grid/${examSessionId}${gridQs}`, token)
      .then((r) => r.json())
      .then((grid) => callbacksRef.current.onGridUpdate(grid))
      .catch((err) => {
        if (err instanceof Error && err.message === SESSION_EXPIRED_MSG) {
          callbacksRef.current.onSessionExpired?.();
        }
      });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, examSessionId, monitorSubject]);
}
