import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      include: ['src/'],
    }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'geometric-interior',
    },
    outDir: 'dist',
    copyPublicDir: false,
    rollupOptions: {
      external: ['three', 'postprocessing'],
    },
  },
  assetsInclude: ['**/*.glsl'],
});
