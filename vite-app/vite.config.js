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
      '@svg-icons': resolve(__dirname, '../svg-icons/src'),
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
        // Rewrite SPA sub-routes to index.html
        if (req.url.startsWith('/images') || req.url.startsWith('/animations')) {
          req.url = '/index.html';
        }
        next();
      });
    },
  }],
});
