import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html',
      output: {
        manualChunks: {
          'three-vendor': ['three'],
          'postprocessing-vendor': ['postprocessing'],
          'ui-vendor': ['tweakpane'],
        },
      },
    },
  },
  assetsInclude: ['**/*.glsl'],
});
