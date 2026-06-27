import { useEffect } from 'react';

import type { Socket } from 'socket.io-client';

import { createSocket } from '@shared/socket';

import { studentApi } from '../api';
import { useExamStore } from '../store';

let sharedSocket: Socket | null = null;

/** Socket thí sinh dùng chung (force_logout, heartbeat). */
export function getStudentSocket(): Socket | null {
  return sharedSocket;
}

export function useStudentSocket() {
  const token = useExamStore((s) => s.token);
  const sessionId = useExamStore((s) => s.sessionId);
  const logout = useExamStore((s) => s.logout);

  useEffect(() => {
    if (!token) {
      sharedSocket?.disconnect();
      sharedSocket = null;
      return;
    }

    const socket = createSocket('/proctoring', token);
    sharedSocket = socket;

    const join = () => {
      socket.emit('join_student', sessionId ? { sessionId } : {});
    };
    if (socket.connected) join();
    else socket.on('connect', join);

    const onForceLogout = () => {
      logout();
      socket.disconnect();
      if (sharedSocket === socket) sharedSocket = null;
    };

    socket.on('force_logout', onForceLogout);

    return () => {
      socket.off('connect', join);
      socket.off('force_logout', onForceLogout);
      socket.disconnect();
      if (sharedSocket === socket) sharedSocket = null;
    };
  }, [token, sessionId, logout]);

  useEffect(() => {
    if (!token || !sessionId) return;

    const pulse = () => {
      studentApi.heartbeat().catch(() => {});
      const socket = getStudentSocket();
      if (socket?.connected) {
        socket.emit('heartbeat', { sessionId });
      }
    };

    pulse();
    const interval = setInterval(pulse, 5000);
    return () => clearInterval(interval);
  }, [token, sessionId]);
}

/** @deprecated Use useStudentSocket */
export const useStudentForceLogout = useStudentSocket;
