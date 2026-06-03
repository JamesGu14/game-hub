import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so built assets resolve from any subfolder
  // (the game hub serves this from games/snake/dist/).
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
