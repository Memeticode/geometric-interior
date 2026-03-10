/**
 * Responsive screenshot script.
 * Spawns its own Vite dev server, captures full-page screenshots of all app
 * pages at every breakpoint width, then shuts everything down.
 *
 * Usage:
 *   node scripts/screenshot-responsive.mjs
 *   HEADED=1 node scripts/screenshot-responsive.mjs
 *
 * Output:  screenshots/responsive-{timestamp}/
 *          e.g. index--320.png, image--768.png, animation--1024.png
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { createServer } from 'net';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VITE_ROOT = resolve(__dirname, '..', 'vite-app');

/** Pages to screenshot. */
const PAGES = [
    { name: 'index',     path: '/' },
    { name: 'image',     path: '/image.html' },
    { name: 'animation', path: '/animation.html' },
];

/** Breakpoint widths matching responsive.css + edge cases. */
const WIDTHS = [320, 375, 480, 640, 768, 1024, 1440];

/** Viewport height (fixed for consistency). */
const HEIGHT = 900;

/** Delay (ms) after navigation to let transitions/animations settle. */
const SETTLE_MS = 1500;

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

/** Spawn Vite dev server and wait until it's serving HTTP. */
async function startVite(port) {
    // Use a single shell command string to avoid the DEP0190 deprecation
    // warning about passing args with shell: true.
    const cmd = `npx vite --port ${port} --strictPort`;
    const child = spawn(cmd, {
        cwd: VITE_ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
    });

    // Wait for Vite to print its "Local:" URL, meaning it's ready.
    // Vite output contains ANSI color codes, so we strip them before matching.
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

async function run() {
    const port = await findFreePort();
    const base = `http://localhost:${port}`;

    console.log(`\nStarting Vite dev server on port ${port}...`);
    const vite = await startVite(port);
    console.log('Vite is ready.\n');

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outDir = resolve(__dirname, '..', 'output', 'screenshots', `responsive-${stamp}`);
    mkdirSync(outDir, { recursive: true });

    const headed = process.env.HEADED === '1';
    const browser = await chromium.launch({
        headless: !headed,
        args: ['--use-gl=angle', '--disable-dev-shm-usage'],
    });

    console.log(`Screenshotting ${PAGES.length} pages × ${WIDTHS.length} widths → ${outDir}\n`);

    let total = 0;

    for (const { name, path } of PAGES) {
        for (const width of WIDTHS) {
            const page = await browser.newPage({
                viewport: { width, height: HEIGHT },
            });

            // Block Vite HMR WebSocket to prevent mid-screenshot reloads.
            await page.routeWebSocket('**', () => {});

            const url = `${base}${path}`;
            try {
                await page.goto(url, { waitUntil: 'load', timeout: 30000 });
            } catch (err) {
                console.error(`  SKIP ${name} @ ${width}px — navigation failed: ${err.message}`);
                await page.close();
                continue;
            }

            // Let CSS transitions, canvas rendering, and animations settle.
            await page.waitForTimeout(SETTLE_MS);

            const filename = `${name}--${width}.png`;
            await page.screenshot({
                path: resolve(outDir, filename),
                fullPage: true,
            });

            console.log(`  ✓ ${filename}`);
            total++;
            await page.close();
        }
    }

    await browser.close();

    // Kill the Vite dev server.
    vite.kill('SIGTERM');

    console.log(`\nDone — ${total} screenshots saved to ${outDir}\n`);
}

run().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
