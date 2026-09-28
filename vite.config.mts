import angular from '@analogjs/vite-plugin-angular';
import path from 'node:path';
import { defineConfig } from 'vite';

// isolate: false shares one module registry across spec files: much faster, at the cost of
// vi.mock(), which nothing here needs.
export default defineConfig({
  plugins: [ angular({ tsconfig: path.resolve(import.meta.dirname, 'tsconfig.spec.json') }) ],
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [ 'src/test-setup.ts' ],
    include: [ 'src/**/*.spec.ts', 'tools/**/*.spec.ts' ],
    pool: 'forks',
    maxWorkers: 4,
    isolate: false,
    coverage: {
      provider: 'v8',
      reporter: [ 'text', 'lcov' ],
      reportsDirectory: './coverage',
      include: [ 'src/**/*.ts' ],
      exclude: [ '**/*.spec.ts', 'src/test-setup.ts', 'src/main.ts' ],
    },
  },
});
