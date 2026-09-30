import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Integration tests boot the real Nest application against a real MariaDB
// database (see `test/setup-integration.ts`). They run sequentially because
// they share one database.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.integration-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup-integration.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
