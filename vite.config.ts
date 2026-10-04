import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'public',
  build: {
    target: ['es2020', 'safari15'],
    assetsInlineLimit: 0,
  },
  server: {
    host: true,
  },
});
