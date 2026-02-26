import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({ include: ['lib/'], rollupTypes: true }),
  ],
  build: {
    lib: {
      entry: 'lib/index.ts',
      formats: ['es'],
      fileName: 'geometric-interior',
    },
    outDir: 'dist/lib',
    copyPublicDir: false,
    rollupOptions: {
      external: ['three', 'postprocessing'],
    },
  },
  assetsInclude: ['**/*.glsl'],
});
