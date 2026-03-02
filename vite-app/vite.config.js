import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        image: resolve(__dirname, 'image.html'),
        animation: resolve(__dirname, 'animation.html'),
      },
      output: {
        manualChunks: {
          'three-vendor': ['three'],
          'postprocessing-vendor': ['postprocessing'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@geometric-interior': resolve(__dirname, '../geometric-interior/src'),
    },
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
  assetsInclude: ['**/*.glsl'],
  plugins: [{
    name: 'gallery-routes',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Rewrite gallery sub-routes to index.html
        if (req.url.startsWith('/gallery/') || req.url.startsWith('/generate/')) {
          req.url = '/index.html';
        }
        next();
      });
    },
  }],
});
