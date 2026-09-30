import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC is used instead of esbuild because NestJS relies on
// `emitDecoratorMetadata`, which esbuild does not support.
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
    include: ['src/**/*.spec.ts'],
    setupFiles: ['./test/setup-unit.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/generated/**', 'src/main.ts', 'src/**/*.spec.ts'],
    },
  },
});
