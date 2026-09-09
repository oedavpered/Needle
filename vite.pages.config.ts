import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'pages',
  base: '/Needle/',
  publicDir: '../public',
  plugins: [react()],
  build: {
    outDir: '../dist-pages',
    emptyOutDir: true,
  },
});
