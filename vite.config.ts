import { defineConfig } from 'vite';

export default defineConfig({
  // relative Pfade, damit es auch unter github.io/<repo>/ läuft
  base: './',
  server: { port: 5173, open: false },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
});
