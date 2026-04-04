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
    ],
  },
});
