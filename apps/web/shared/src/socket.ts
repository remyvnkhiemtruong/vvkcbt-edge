import { io, Socket } from 'socket.io-client';

export function createSocket(namespace = '/proctoring', token?: string): Socket {
  const base = import.meta.env.VITE_API_URL || '';
  return io(`${base}${namespace}`, {
    transports: ['websocket', 'polling'],
    auth: token ? { token } : undefined,
  });
}