import { useEffect } from 'react';

import type { Socket } from 'socket.io-client';

import { createSocket } from '@shared/socket';

import { useExamStore } from '../store';



let sharedSocket: Socket | null = null;



/** Socket thí sinh dùng chung (force_logout, heartbeat trên ExamPage). */

export function getStudentSocket(): Socket | null {

  return sharedSocket;

}



export function useStudentSocket() {

  const token = useExamStore((s) => s.token);

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

      socket.emit('join_student', {});

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

  }, [token, logout]);

}



/** @deprecated Use useStudentSocket */

export const useStudentForceLogout = useStudentSocket;

