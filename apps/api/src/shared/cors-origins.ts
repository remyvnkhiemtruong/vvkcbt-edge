const DEV_VITE_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5176',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5176',
];

/** CORS origins for HTTP + Socket.IO (EDGE_ORIGINS + Vite dev ports in development). */
export function parseEdgeCorsOrigins(): string[] | boolean {
  const raw = process.env.EDGE_ORIGINS?.trim();
  if (!raw) {
    return process.env.NODE_ENV === 'production' ? false : true;
  }

  const origins = raw.split(',').map((o) => o.trim()).filter(Boolean);
  if (process.env.NODE_ENV === 'production') {
    return origins;
  }

  return [...new Set([...origins, ...DEV_VITE_ORIGINS])];
}
