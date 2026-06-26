import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { PROCTOR_DEV_PORT, resolveApiProxyTarget } from '../shared/vite-proxy';

const apiTarget = resolveApiProxyTarget();

/** Dev: /proctor/* trên cổng Student → chuyển sang app Proctor (LAN-aware). */
function proctorDevRedirect(): Plugin {
  return {
    name: 'proctor-dev-redirect',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (url === '/proctor' || url.startsWith('/proctor/')) {
          const host = req.headers.host?.split(':')[0] || '127.0.0.1';
          res.statusCode = 302;
          res.setHeader('Location', `http://${host}:${PROCTOR_DEV_PORT}/proctor/`);
          res.end();
          return;
        }
        if (url === '/' || url === '') {
          res.statusCode = 302;
          res.setHeader('Location', '/student/');
          res.end();
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), proctorDevRedirect()],
  base: '/student/',
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared/src'),
      '@vnu/shared-types': path.resolve(__dirname, '../../../packages/shared-types/src'),
    },
  },
  server: {
    port: 5173,
    open: '/student/',
    proxy: {
      '/api': apiTarget,
      '/uploads': apiTarget,
      '/socket.io': { target: apiTarget, ws: true },
      '/proctoring': { target: apiTarget, ws: true },
    },
  },
});
