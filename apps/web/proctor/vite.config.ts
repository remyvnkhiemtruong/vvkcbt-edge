import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { resolveApiProxyTarget } from '../shared/vite-proxy';

const apiTarget = resolveApiProxyTarget();

function proctorDevRootRedirect(): Plugin {
  return {
    name: 'proctor-dev-root-redirect',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (url === '/' || url === '') {
          res.statusCode = 302;
          res.setHeader('Location', '/proctor/');
          res.end();
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), proctorDevRootRedirect()],
  base: '/proctor/',
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared/src'),
      '@vnu/shared-types': path.resolve(__dirname, '../../../packages/shared-types/src'),
    },
  },
  server: {
    port: 5174,
    open: '/proctor/',
    proxy: {
      '/api': apiTarget,
      '/uploads': apiTarget,
      '/socket.io': { target: apiTarget, ws: true },
      '/proctoring': { target: apiTarget, ws: true },
    },
  },
});
