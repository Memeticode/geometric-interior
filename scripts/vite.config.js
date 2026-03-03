import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

export default defineConfig({
  root: projectRoot,
  server: {
    fs: {
      allow: [projectRoot],
    },
  },
  assetsInclude: ['**/*.glsl'],
});
