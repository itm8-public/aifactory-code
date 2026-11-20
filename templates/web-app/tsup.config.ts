import { defineConfig } from 'tsup';

// Bundles the server (and the migration command) into dist/. Dependencies stay external and are
// installed in the image. Runs before `vite build`, which writes dist/public.
export default defineConfig({
  entry: {
    server: 'src/server/server.ts',
// @if db
    migrate: 'src/server/db/migrate.ts',
// @endif
  },
  format: 'esm',
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
});
