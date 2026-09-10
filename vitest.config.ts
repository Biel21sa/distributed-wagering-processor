import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // The integration specs all share a single Postgres instance. Running
    // spec files in parallel makes their TRUNCATE-based cleanup deadlock and
    // clobber each other's data, so execute one file at a time.
    fileParallelism: false,
  },
});
