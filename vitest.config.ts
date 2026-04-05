import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    'process.env.NODE_ENV': '"test"',
    'import.meta.env.VITE_API_TOKEN': '"test-token"',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./src/test-setup.ts'],
    environmentMatchGlobs: [
      ['src/client/**/*.test.tsx', 'jsdom'],
      ['src/client/hooks/**/*.test.ts', 'jsdom'],
    ],
    coverage: {
      provider: 'v8',
      include: [
        'src/server/**/*.ts',
        'src/shared/**/*.ts',
      ],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/test-setup.ts',
        'src/server/index.ts',
      ],
      thresholds: {
        lines: 80,
        branches: 75,
        functions: 80,
        statements: 80,
      },
      reporter: ['text', 'html'],
    },
  },
});
