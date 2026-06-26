import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/proctor/',
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared/src'),
      '@vnu/shared-types': path.resolve(__dirname, '../../../packages/shared-types/src'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
      '/proctoring': { target: 'http://localhost:3000', ws: true },
    },
  },
});
