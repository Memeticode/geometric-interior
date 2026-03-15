import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        matrix: resolve(__dirname, 'pages/matrix.html'),
        browser: resolve(__dirname, 'pages/browser.html'),
        'custom-buttons': resolve(__dirname, 'pages/custom-buttons.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@svg-icons': resolve(__dirname, '../svg-icons/src'),
    },
  },
});
