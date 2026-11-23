import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the same build works on itch.io (sub-path) and Vercel.
  base: './',
  build: {
    target: 'es2022',
    // Rapier ships its WASM inline (~2 MB); it gets its own chunk so it loads in parallel.
    chunkSizeWarningLimit: 4500,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('@dimforge')) return 'rapier';
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules')) return 'vendor';
          return undefined;
        },
      },
    },
  },
});
