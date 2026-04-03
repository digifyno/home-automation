import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: 'src/client',
  build: { outDir: '../../dist/public', emptyOutDir: true },
  server: { proxy: { '/api': 'http://localhost:4018' } }
});
