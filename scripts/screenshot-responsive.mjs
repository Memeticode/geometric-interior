/**
 * Responsive screenshot script.
 * Spawns its own Vite dev server(s), captures full-page screenshots of app
 * pages at every breakpoint width, then shuts everything down.
 *
 * Usage:
 *   node scripts/screenshot-responsive.mjs [options]
 *
 * Options:
 *   --app=vite|svg|both   Which app to screenshot (default: both)
 *   --size=xs|sm|md|lg|xl Capture one breakpoint only
 *   --page=<substring>    Only pages whose name contains this string
 *   --dpr=2               Device pixel ratio (default: 1)
 *   --wait=<ms>           Extra settle time per page (default: 1500)
 *   HEADED=1              Show browser window (env var)
 *
 * Output:  output/screenshots/responsive-{timestamp}/
 *          e.g. image-gallery--sm-480x900.png, svg-browser--lg-1024x768.png
 *
 * Breakpoints match vite-app/css/components/responsive.css:
 *   xs: 375px (iPhone SE), sm: 480px, md: 768px, lg: 1024px, xl: 1440px
 *   Plus 320px edge-case for narrow Android devices.
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { createServer } from 'net';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Breakpoints ────────────────────────────────────────────────────
const VIEWPORTS = {
  xs:  { width: 375,  height: 812,  label: 'xs  375×812  (iPhone SE)' },
  sm:  { width: 480,  height: 854,  label: 'sm  480×854  (large phone)' },
  md:  { width: 768,  height: 1024, label: 'md  768×1024 (tablet)' },
  lg:  { width: 1024, height: 768,  label: 'lg  1024×768 (desktop)' },
  xl:  { width: 1440, height: 900,  label: 'xl  1440×900 (large desktop)' },
};

// ── Page definitions ───────────────────────────────────────────────
// Routes must match vite-app middleware rewrites (/images, /animations → index.html)
// and the client-side router in gallery-main.js (parseRoute).
const VITE_PAGES = [
  { name: 'gallery',            path: '/images' },
  { name: 'portrait',           path: '/images/portraits/prism' },
  { name: 'editor',             path: '/images/editor' },
  { name: 'animation-gallery',  path: '/animations' },
  { name: 'animation-editor',   path: '/animations/editor' },
];

const SVG_PAGES = [
  { name: 'svg-index',          path: '/' },
  { name: 'svg-browser',        path: '/pages/browser.html' },
  { name: 'svg-matrix',         path: '/pages/matrix.html' },
  { name: 'svg-buttons',        path: '/pages/custom-buttons.html' },
];

// ── CLI args ───────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { app: 'both', size: null, page: null, dpr: 1, wait: 1500 };
  for (const arg of args) {
    if (arg.startsWith('--app='))  opts.app  = arg.split('=')[1];
    if (arg.startsWith('--size=')) opts.size = arg.split('=')[1];
    if (arg.startsWith('--page=')) opts.page = arg.split('=')[1];
    if (arg.startsWith('--dpr='))  opts.dpr  = Number(arg.split('=')[1]);
    if (arg.startsWith('--wait=')) opts.wait = Number(arg.split('=')[1]);
  }
  return opts;
}

// ── Helpers ────────────────────────────────────────────────────────

/** Find a free port by briefly binding to port 0. */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

/** Strip ANSI escape sequences from a string. */
function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

/** Spawn a Vite dev server and wait until it's serving HTTP. */
async function startVite(cwd, port) {
  const cmd = `npx vite --port ${port} --strictPort`;
  const child = spawn(cmd, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Vite did not start within 30s')), 30000);
    let output = '';

    function onData(chunk) {
      output += chunk.toString();
      const plain = stripAnsi(output);
      if (plain.includes('Local:') || plain.includes(`localhost:${port}`)) {
        clearTimeout(timeout);
        resolve();
      }
    }

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Vite exited with code ${code} before ready.\n${stripAnsi(output)}`));
    });
  });

  return child;
}

// ── Main ───────────────────────────────────────────────────────────
async function run() {
  const opts = parseArgs();

  // Resolve viewports
  const sizes = opts.size ? { [opts.size]: VIEWPORTS[opts.size] } : VIEWPORTS;
  if (opts.size && !VIEWPORTS[opts.size]) {
    console.error(`Unknown size "${opts.size}". Valid: ${Object.keys(VIEWPORTS).join(', ')}`);
    process.exit(1);
  }

  // Build app list
  const apps = [];
  if (opts.app === 'both' || opts.app === 'vite') {
    apps.push({ label: 'vite-app', cwd: resolve(ROOT, 'vite-app'), pages: VITE_PAGES });
  }
  if (opts.app === 'both' || opts.app === 'svg') {
    apps.push({ label: 'svg-app', cwd: resolve(ROOT, 'svg-app'), pages: SVG_PAGES });
  }

  // Apply page filter
  if (opts.page) {
    for (const app of apps) {
      app.pages = app.pages.filter(p => p.name.includes(opts.page));
    }
  }

  // Count work
  const totalExpected = apps.reduce((n, a) => n + a.pages.length * Object.keys(sizes).length, 0);
  if (totalExpected === 0) {
    console.log('No pages match the given filters.');
    process.exit(0);
  }

  // Start dev servers
  const servers = [];
  for (const app of apps) {
    if (app.pages.length === 0) continue;
    const port = await findFreePort();
    console.log(`Starting ${app.label} dev server on port ${port}...`);
    const child = await startVite(app.cwd, port);
    app.port = port;
    servers.push(child);
    console.log(`${app.label} ready.`);
  }

  // Output directory
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir = resolve(ROOT, 'output', 'screenshots', `responsive-${stamp}`);
  mkdirSync(outDir, { recursive: true });

  const headed = process.env.HEADED === '1';
  const browser = await chromium.launch({
    headless: !headed,
    args: ['--use-gl=angle', '--disable-dev-shm-usage'],
  });

  console.log(`\nCapturing ${totalExpected} screenshots → ${outDir}\n`);

  let total = 0;
  let errors = 0;

  for (const app of apps) {
    if (app.pages.length === 0) continue;
    const base = `http://localhost:${app.port}`;
    console.log(`── ${app.label} (${base}) ──`);

    for (const { name, path } of app.pages) {
      for (const [sizeKey, vp] of Object.entries(sizes)) {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: opts.dpr,
        });
        const page = await context.newPage();
        await page.routeWebSocket('**', () => {});

        const url = `${base}${path}`;
        const filename = `${name}--${sizeKey}-${vp.width}x${vp.height}.png`;
        const filepath = resolve(outDir, filename);

        try {
          await page.goto(url, { waitUntil: 'load', timeout: 30000 });
          await page.waitForTimeout(opts.wait);
          await page.screenshot({ path: filepath, fullPage: true });
          console.log(`  ✓ ${filename}`);
          total++;
        } catch (err) {
          console.error(`  ✗ ${filename} — ${err.message}`);
          errors++;
        }

        await page.close();
        await context.close();
      }
    }
  }

  await browser.close();

  // Kill dev servers
  for (const child of servers) {
    child.kill('SIGTERM');
  }

  console.log(`\nDone — ${total} screenshots saved to ${outDir}`);
  if (errors) console.log(`${errors} failed.`);
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
