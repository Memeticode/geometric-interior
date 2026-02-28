/**
 * CLI script to generate a parameter sweep animation as MP4.
 *
 * Renders frames in Playwright, captures as PNG, stitches with ffmpeg.
 *
 * Usage:
 *   node scripts/gen-anim.mjs                     # saves to output/anim-sweep.mp4
 *   node scripts/gen-anim.mjs -o my-video.mp4     # custom output path
 *   HEADED=1 node scripts/gen-anim.mjs            # watch it render
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
const URL = `http://localhost:${PORT}/scripts/gen-anim.html`;
const DEFAULT_OUTPUT = resolve(__dirname, '..', 'output', 'anim-sweep.mp4');
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
    const tmpDir = resolve(__dirname, '..', 'output', '_anim_frames');
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
    mkdirSync(tmpDir, { recursive: true });

    console.log('='.repeat(60));
    console.log('  Animation Generator (parameter sweep → MP4)');
    console.log('='.repeat(60));
    console.log(`  Output:   ${output}`);
    console.log(`  Frames:   ${tmpDir}`);
    console.log(`  Headed:   ${headed}`);
    console.log(`  Dev URL:  ${URL}`);
    console.log('');

    // Launch browser (use installed Chrome for reliable GPU support)
    const browser = await chromium.launch({
        headless: !headed,
        channel: 'chrome',
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
    console.log('Navigating to gen-anim.html...');
    try {
        await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (err) {
        console.error(`Failed to load ${URL}`);
        console.error('Is the Vite dev server running?  npx vite --port 5204');
        await browser.close();
        process.exit(1);
    }

    // Wait for page script to load
    await page.waitForFunction(() => typeof (window).createAnimAPI === 'function', { timeout: 30000 });
    console.log('Page ready.\n');

    // Initialize the animation API
    const info = await page.evaluate(() => {
        (window).__animAPI = (window).createAnimAPI();
        return (window).__animAPI.init();
    });

    const { totalSegments, framesPerSegment, totalFrames } = info;
    console.log(`  ${totalSegments} segments × ${framesPerSegment} frames = ${totalFrames} total`);
    console.log(`  Resolution: ${info.width}×${info.height}`);
    console.log(`  Duration: ${totalFrames / FPS}s @ ${FPS}fps\n`);

    const t0 = Date.now();
    let globalFrame = 0;

    // Render all frames
    for (let si = 0; si < totalSegments; si++) {
        const prepT = Date.now();
        await page.evaluate((si) => {
            (window).__animAPI.prepareSegment(si);
        }, si);
        console.log(`  Segment ${si + 1}/${totalSegments} prepared (${Date.now() - prepT}ms)`);

        for (let f = 0; f < framesPerSegment; f++) {
            if (globalFrame >= totalFrames) break;

            // Render frame and get data URL
            const dataUrl = await page.evaluate((f) => {
                return (window).__animAPI.renderFrame(f);
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
                const fps = (globalFrame / ((Date.now() - t0) / 1000)).toFixed(1);
                process.stdout.write(`\r  Frames: ${globalFrame}/${totalFrames} (${pct}%) [${elapsed}s, ${fps} fps]`);
            }
        }

        await page.evaluate(() => {
            (window).__animAPI.endSegment();
        });
    }

    console.log('');  // newline after progress

    // Clean up browser
    await page.evaluate(() => {
        (window).__animAPI.dispose();
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
        '-tune', 'animation',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        output,
    ].join(' ');

    try {
        execSync(ffmpegCmd, { stdio: 'pipe', timeout: 600000 });
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
