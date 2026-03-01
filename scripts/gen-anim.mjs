/**
 * CLI script to generate a parameter sweep animation as MP4.
 *
 * Renders frames in Playwright, captures as JPEG, stitches with ffmpeg.
 * Supports pause (Ctrl+C), resume (re-run same command), and cancel.
 * Auto-restarts browser on crash/context destruction.
 *
 * Usage:
 *   node scripts/gen-anim.mjs                     # saves to output/anim-sweep.mp4
 *   node scripts/gen-anim.mjs -o my-video.mp4     # custom output path
 *   node scripts/gen-anim.mjs --stitch-only       # skip rendering, just encode existing frames
 *   HEADED=1 node scripts/gen-anim.mjs            # watch it render
 *
 * Pause/Resume:
 *   Press Ctrl+C during rendering to pause. Re-run the same command to resume
 *   from where you left off (existing frames are detected and skipped).
 *
 * Prerequisites:
 *   npx vite --port 5204  (dev server must be running)
 *   ffmpeg must be on PATH
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync, rmSync, readdirSync, statSync } from 'fs';
import { dirname, resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = 5204;
const PAGE_URL = `http://localhost:${PORT}/scripts/gen-anim.html`;
const DEFAULT_OUTPUT = resolve(__dirname, '..', 'output', 'anim-sweep.mp4');
const FPS = 60;
const MAX_RESTARTS = 10;

function parseArgs() {
    const args = process.argv.slice(2);
    let output = DEFAULT_OUTPUT;
    let stitchOnly = false;
    let clean = false;
    for (let i = 0; i < args.length; i++) {
        if ((args[i] === '-o' || args[i] === '--output') && args[i + 1]) {
            output = resolve(args[++i]);
        } else if (args[i] === '--stitch-only') {
            stitchOnly = true;
        } else if (args[i] === '--clean') {
            clean = true;
        }
    }
    return { output, stitchOnly, clean };
}

/**
 * Count existing frames in the temp directory to support resume.
 * Returns the index of the first missing frame (= number of completed frames).
 */
function countExistingFrames(tmpDir) {
    if (!existsSync(tmpDir)) return 0;
    const files = readdirSync(tmpDir).filter(f => f.startsWith('frame_') && f.endsWith('.jpg'));
    if (files.length === 0) return 0;

    // Find the first gap in the sequence
    files.sort();
    for (let i = 0; i < files.length; i++) {
        const expected = `frame_${String(i).padStart(5, '0')}.jpg`;
        if (files[i] !== expected) return i;
    }
    return files.length;
}

/**
 * Launch browser, navigate to page, initialize the animation API.
 * Returns { browser, page, info } or throws on failure.
 */
async function launchSession(headed) {
    const browser = await chromium.launch({
        headless: !headed,
        channel: 'chrome',
        args: [
            '--use-gl=angle',
            '--disable-dev-shm-usage',
            '--disable-gpu-sandbox',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
        ],
    });

    const page = await browser.newPage({
        viewport: { width: 1000, height: 800 },
        deviceScaleFactor: 1,
    });

    // Increase default timeout for long-running evaluates
    page.setDefaultTimeout(120000);

    page.on('console', msg => {
        if (msg.type() === 'log') console.log(`  [browser] ${msg.text()}`);
    });
    page.on('pageerror', err => {
        console.error(`  [browser error] ${err.message}`);
    });

    // Navigate — use 'load' (not 'domcontentloaded') to prevent context destruction
    try {
        await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 30000 });
    } catch (err) {
        await browser.close();
        throw new Error(`Failed to load ${PAGE_URL}. Is Vite running?  npx vite --port 5204`);
    }

    // Stabilization delay — prevents context destruction from late module loads
    await new Promise(r => setTimeout(r, 2000));

    await page.waitForFunction(() => typeof (window).createAnimAPI === 'function', { timeout: 30000 });

    // Initialize the animation API
    const info = await page.evaluate(() => {
        (window).__animAPI = (window).createAnimAPI();
        return (window).__animAPI.init();
    });

    return { browser, page, info };
}

async function main() {
    const { output, stitchOnly, clean } = parseArgs();
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

    const tmpDir = resolve(__dirname, '..', 'output', '_anim_frames');

    // --clean: remove existing frames and start fresh
    if (clean && existsSync(tmpDir)) {
        rmSync(tmpDir, { recursive: true });
        console.log('Cleaned existing frames.');
    }

    mkdirSync(tmpDir, { recursive: true });

    // --stitch-only: skip rendering, go straight to ffmpeg
    if (stitchOnly) {
        const frameCount = countExistingFrames(tmpDir);
        if (frameCount === 0) {
            console.error('No frames found to stitch. Run without --stitch-only first.');
            process.exit(1);
        }
        console.log(`Stitching ${frameCount} existing frames...`);
        stitch(tmpDir, output, frameCount);
        return;
    }

    console.log('='.repeat(60));
    console.log('  Animation Generator (parameter sweep → MP4)');
    console.log('='.repeat(60));
    console.log(`  Output:   ${output}`);
    console.log(`  Frames:   ${tmpDir}`);
    console.log(`  Headed:   ${headed}`);
    console.log(`  Dev URL:  ${PAGE_URL}`);
    console.log('  Pause:    Press Ctrl+C to pause. Re-run to resume.');
    console.log('  Auto-restart on crash: up to ' + MAX_RESTARTS + ' restarts');
    console.log('');

    let cancelled = false;

    // Graceful shutdown on Ctrl+C
    const onSigint = () => {
        cancelled = true;
        console.log('\n\n  Ctrl+C received. Finishing current frame then pausing...\n');
    };
    process.on('SIGINT', onSigint);

    const t0 = Date.now();
    let restartCount = 0;
    let totalFrames = 0;
    let framesPerSegment = 0;
    let totalSegments = 0;

    // Outer loop: restart browser on crash
    while (!cancelled && restartCount <= MAX_RESTARTS) {
        const globalFrame = countExistingFrames(tmpDir);

        if (restartCount === 0) {
            console.log(globalFrame > 0
                ? `  Resuming from frame ${globalFrame}`
                : '  Starting fresh render');
        } else {
            console.log(`\n  Auto-restart #${restartCount}: resuming from frame ${globalFrame}`);
        }

        let browser, page, info;
        try {
            console.log('  Launching browser...');
            ({ browser, page, info } = await launchSession(headed));
        } catch (err) {
            console.error(`  Failed to launch: ${err.message}`);
            if (++restartCount > MAX_RESTARTS) break;
            console.log('  Retrying in 3s...');
            await new Promise(r => setTimeout(r, 3000));
            continue;
        }

        totalSegments = info.totalSegments;
        framesPerSegment = info.framesPerSegment;
        totalFrames = info.totalFrames;

        if (restartCount === 0) {
            console.log(`  ${totalSegments} segments × ${framesPerSegment} frames = ${totalFrames} total`);
            console.log(`  Resolution: ${info.width}×${info.height}`);
            console.log(`  Duration: ${totalFrames / FPS}s @ ${FPS}fps\n`);
        }

        // Track crash state
        let crashed = false;
        page.on('crash', () => {
            console.error('\n  [browser CRASH] Page crashed!');
            crashed = true;
        });

        let currentFrame = globalFrame;

        // Calculate which segment to start from
        const startSegment = Math.floor(currentFrame / framesPerSegment);
        const startFrameInSegment = currentFrame % framesPerSegment;

        // Inner render loop
        try {
            for (let si = startSegment; si < totalSegments && !cancelled && !crashed; si++) {
                const prepT = Date.now();
                await page.evaluate((si) => {
                    (window).__animAPI.prepareSegment(si);
                }, si);
                console.log(`\n  Segment ${si + 1}/${totalSegments} prepared (${Date.now() - prepT}ms)`);

                const frameStart = (si === startSegment) ? startFrameInSegment : 0;

                for (let f = frameStart; f < framesPerSegment && !cancelled && !crashed; f++) {
                    if (currentFrame >= totalFrames) break;

                    // Render frame and get data URL
                    const dataUrl = await page.evaluate((f) => {
                        return (window).__animAPI.renderFrame(f);
                    }, f);

                    // Save JPEG
                    const base64 = dataUrl.split(',')[1];
                    const buf = Buffer.from(base64, 'base64');
                    const framePath = join(tmpDir, `frame_${String(currentFrame).padStart(5, '0')}.jpg`);
                    writeFileSync(framePath, buf);

                    currentFrame++;

                    // Progress every 10 frames
                    if (currentFrame % 10 === 0 || currentFrame === totalFrames) {
                        const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
                        const pct = (currentFrame / totalFrames * 100).toFixed(1);
                        const fps = currentFrame > 0 ? (currentFrame / ((Date.now() - t0) / 1000)).toFixed(2) : '—';
                        const eta = currentFrame > 0
                            ? ((totalFrames - currentFrame) / (currentFrame / ((Date.now() - t0) / 1000)) / 60).toFixed(1)
                            : '?';
                        process.stdout.write(`\r  Frames: ${currentFrame}/${totalFrames} (${pct}%) [${elapsed}s, ${fps} fps, ETA: ${eta}min]`);
                    }
                }

                if (!cancelled && !crashed) {
                    await page.evaluate(() => {
                        (window).__animAPI.endSegment();
                    });
                }
            }
        } catch (err) {
            const msg = err.message || '';
            if (msg.includes('context') || msg.includes('destroyed') || msg.includes('Target closed') || msg.includes('crash')) {
                console.error(`\n  Browser context lost at frame ${currentFrame}: ${msg}`);
                crashed = true;
            } else {
                // Unknown error — rethrow
                try { await browser.close(); } catch {}
                throw err;
            }
        }

        // Clean up browser
        try {
            if (!crashed) {
                await page.evaluate(() => { (window).__animAPI.dispose(); });
            }
        } catch { /* ignore */ }
        try { await browser.close(); } catch { /* ignore */ }

        // Check completion
        if (currentFrame >= totalFrames) {
            console.log('');
            break;  // Done!
        }

        if (cancelled) {
            console.log(`\n  ${currentFrame}/${totalFrames} frames saved. Re-run to resume.`);
            process.exit(0);
        }

        if (crashed) {
            restartCount++;
            if (restartCount > MAX_RESTARTS) {
                console.error(`\n  Max restarts (${MAX_RESTARTS}) exceeded. ${currentFrame}/${totalFrames} frames saved.`);
                console.log('  Re-run to resume from last saved frame.');
                process.exit(1);
            }
            console.log('  Restarting browser in 2s...');
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    process.off('SIGINT', onSigint);

    const finalFrameCount = countExistingFrames(tmpDir);
    if (finalFrameCount < totalFrames) {
        console.error(`  Only ${finalFrameCount}/${totalFrames} frames rendered. Cannot stitch.`);
        process.exit(1);
    }

    const renderTime = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n  Rendering complete: ${totalFrames} frames in ${renderTime}s (${restartCount} restarts)`);

    // Stitch with ffmpeg
    stitch(tmpDir, output, totalFrames);

    // Clean up temp frames
    rmSync(tmpDir, { recursive: true });
}

function stitch(tmpDir, output, totalFrames) {
    console.log('  Encoding with ffmpeg...');
    const ffmpegCmd = [
        'ffmpeg', '-y',
        '-framerate', String(FPS),
        '-i', join(tmpDir, 'frame_%05d.jpg'),
        '-vf', 'scale=3840:2160:flags=lanczos',
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

    const stat = statSync(output);
    const sizeMB = (stat.size / (1024 * 1024)).toFixed(1);

    console.log(`\n  Output: ${output}`);
    console.log(`  Size:   ${sizeMB} MB`);
    console.log('\nDone.');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
