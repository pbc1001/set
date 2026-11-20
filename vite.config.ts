import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react({ jsxImportSource: '@emotion/react' })],
  build: { outDir: 'build/web' },
  server: {
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:8787', ws: true } },
  },
});
