import { io, Socket } from 'socket.io-client';

export function createSocket(namespace = '/proctoring', token?: string): Socket {
  const base =
    import.meta.env.VITE_API_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  return io(`${base}${namespace}`, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    auth: token ? { token } : undefined,
  });
}