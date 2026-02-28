import { defineConfig } from 'vite';
import { resolve } from 'path';

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
