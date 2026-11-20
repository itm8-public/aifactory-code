import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The front end lives in src/web and is built into dist/public, which the server serves from
// the same origin. In development Vite serves it on :5173 and forwards /api to the server.
export default defineConfig({
  root: 'src/web',
  plugins: [react()],
  build: {
    outDir: '../../dist/public',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
      '/healthz': 'http://localhost:8080',
    },
  },
});
