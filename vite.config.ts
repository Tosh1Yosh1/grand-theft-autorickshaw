import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the same build works on itch.io (sub-path) and Vercel.
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 5500, // Rapier ships its wasm inline; it's chunky, like Pappu.
  },
});
