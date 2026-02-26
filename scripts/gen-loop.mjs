/**
 * CLI script to generate a 30-second looping morph animation as MP4.
 *
 * Renders frames in Playwright, captures as PNG, stitches with ffmpeg.
 *
 * Usage:
 *   node scripts/gen-loop.mjs                     # saves to output/loop.mp4
 *   node scripts/gen-loop.mjs -o my-video.mp4     # custom output path
 *   HEADED=1 node scripts/gen-loop.mjs            # watch it render
 *
 * Prerequisites:
 *   npx vite --port 5204  (dev server must be running)
 *   ffmpeg must be on PATH
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { dirname, resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = 5204;
const URL = `http://localhost:${PORT}/scripts/gen-loop.html`;
const DEFAULT_OUTPUT = resolve(__dirname, '..', 'output', 'loop.mp4');
const FPS = 60;

function parseArgs() {
    const args = process.argv.slice(2);
    let output = DEFAULT_OUTPUT;
    for (let i = 0; i < args.length; i++) {
        if ((args[i] === '-o' || args[i] === '--output') && args[i + 1]) {
            output = resolve(args[++i]);
        }
    }
    return { output };
}

async function main() {
    const { output } = parseArgs();
    const headed = process.env.HEADED === '1';

    // Verify ffmpeg is available
    try {
        execSync('ffmpeg -version', { stdio: 'pipe' });
    } catch {
        console.error('Error: ffmpeg not found on PATH. Install ffmpeg first.');
        process.exit(1);
    }

    // Ensure output directory exists
    const outDir = dirname(output);
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

    // Create temp directory for PNG frames
    const tmpDir = resolve(__dirname, '..', 'output', '_frames');
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
    mkdirSync(tmpDir, { recursive: true });

    console.log('='.repeat(60));
    console.log('  Loop Animation Generator (ffmpeg pipeline)');
    console.log('='.repeat(60));
    console.log(`  Output:   ${output}`);
    console.log(`  Frames:   ${tmpDir}`);
    console.log(`  Headed:   ${headed}`);
    console.log(`  Dev URL:  ${URL}`);
    console.log('');

    // Launch browser
    const browser = await chromium.launch({
        headless: !headed,
        args: ['--use-gl=angle', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage({
        viewport: { width: 1000, height: 800 },
        deviceScaleFactor: 1,
    });

    // Collect console messages
    page.on('console', msg => {
        if (msg.type() === 'log') console.log(`  [browser] ${msg.text()}`);
    });

    page.on('pageerror', err => {
        console.error(`  [browser error] ${err.message}`);
    });

    page.on('crash', () => {
        console.error('  [browser CRASH] Page crashed!');
    });

    // Navigate
    console.log('Navigating to gen-loop.html...');
    try {
        await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (err) {
        console.error(`Failed to load ${URL}`);
        console.error('Is the Vite dev server running?  npx vite --port 5204');
        await browser.close();
        process.exit(1);
    }

    // Wait for page script to load
    await page.waitForFunction(() => typeof (window).createLoopAPI === 'function', { timeout: 30000 });
    console.log('Page ready.\n');

    // Initialize the loop API
    const info = await page.evaluate(() => {
        (window).__loopAPI = (window).createLoopAPI();
        return (window).__loopAPI.init();
    });

    const { totalTransitions, framesPerTransition, totalFrames } = info;
    console.log(`  ${totalTransitions} transitions, ${totalFrames} frames`);

    const t0 = Date.now();
    let globalFrame = 0;

    // Render all frames
    for (let ti = 0; ti < totalTransitions; ti++) {
        const prepT = Date.now();
        await page.evaluate((ti) => {
            (window).__loopAPI.prepareTransition(ti);
        }, ti);
        console.log(`  Transition ${ti + 1}/${totalTransitions} prepared (${Date.now() - prepT}ms)`);

        for (let f = 0; f < framesPerTransition; f++) {
            // Render frame and get data URL
            const dataUrl = await page.evaluate((f) => {
                return (window).__loopAPI.renderFrame(f);
            }, f);

            // Save PNG
            const base64 = dataUrl.split(',')[1];
            const buf = Buffer.from(base64, 'base64');
            const framePath = join(tmpDir, `frame_${String(globalFrame).padStart(5, '0')}.png`);
            writeFileSync(framePath, buf);

            globalFrame++;

            // Progress every 30 frames
            if (globalFrame % 30 === 0 || globalFrame === totalFrames) {
                const pct = (globalFrame / totalFrames * 100).toFixed(1);
                const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
                process.stdout.write(`\r  Frames: ${globalFrame}/${totalFrames} (${pct}%) [${elapsed}s]`);
            }
        }

        await page.evaluate(() => {
            (window).__loopAPI.endTransition();
        });
    }

    console.log('');  // newline after progress

    // Clean up browser
    await page.evaluate(() => {
        (window).__loopAPI.dispose();
    });
    await browser.close();

    const renderTime = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n  Rendering complete: ${totalFrames} frames in ${renderTime}s`);

    // Stitch with ffmpeg
    console.log('  Encoding with ffmpeg...');
    const ffmpegCmd = [
        'ffmpeg', '-y',
        '-framerate', String(FPS),
        '-i', join(tmpDir, 'frame_%05d.png'),
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '18',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        output,
    ].join(' ');

    try {
        execSync(ffmpegCmd, { stdio: 'pipe' });
    } catch (err) {
        console.error('ffmpeg encoding failed:');
        console.error(err.stderr?.toString() || err.message);
        process.exit(1);
    }

    // Clean up temp frames
    rmSync(tmpDir, { recursive: true });

    // Report final size
    const { statSync } = await import('fs');
    const stat = statSync(output);
    const sizeMB = (stat.size / (1024 * 1024)).toFixed(1);
    const totalTime = ((Date.now() - t0) / 1000).toFixed(1);

    console.log(`\n  Output: ${output}`);
    console.log(`  Size:   ${sizeMB} MB`);
    console.log(`  Time:   ${totalTime}s total`);
    console.log('\nDone.');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
