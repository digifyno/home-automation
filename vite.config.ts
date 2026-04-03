import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: 'src/client',
  build: { outDir: '../../dist', emptyOutDir: true },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4018',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Authorization', `Bearer ${process.env.VITE_API_TOKEN}`);
          });
        },
      },
    },
  }
});
