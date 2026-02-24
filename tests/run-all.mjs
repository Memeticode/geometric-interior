/**
 * Test orchestrator: runs 4 group runners in parallel, reports combined results.
 *
 * Usage:
 *   node tests/run-all.mjs          # Run all tests headless
 *   HEADED=1 node tests/run-all.mjs # Run headed for debugging
 *
 * Prerequisites:
 *   npx vite --port 5204   (dev server must be running)
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const GROUPS = [
    { file: 'group-visual.mjs',    label: 'Visual (rendering, text)' },
    { file: 'group-ui.mjs',        label: 'UI (panel, controls, export)' },
    { file: 'group-data.mjs',      label: 'Data (thumbnails, profiles, import)' },
    { file: 'group-animation.mjs', label: 'Animation (morph, history, smoothness)' },
];

console.log('=== Running All Tests (Parallel Groups) ===\n');
console.log(`Groups: ${GROUPS.length}`);
console.log(`Headed: ${process.env.HEADED === '1' ? 'yes' : 'no'}\n`);

function runGroup(group) {
    return new Promise((resolve) => {
        const filePath = join(__dirname, group.file);
        const child = spawn('node', [filePath], {
            env: { ...process.env },
            stdio: 'pipe',
        });

        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => {
            child.kill();
            resolve({
                label: group.label,
                status: 'FAIL',
                passed: 0,
                failed: 1,
                output: stdout + stderr + '\n[TIMEOUT after 10 minutes]',
                code: 1,
            });
        }, 600000); // 10 minute timeout per group (morphs are slow in headless)

        child.stdout.on('data', (data) => { stdout += data.toString(); });
        child.stderr.on('data', (data) => { stderr += data.toString(); });

        child.on('close', (code) => {
            clearTimeout(timer);
            const output = stdout + stderr;
            // Parse the LAST "X passed, Y failed" line (the group summary)
            const matches = output.match(/(\d+) passed, (\d+) failed/g);
            const lastMatch = matches ? matches[matches.length - 1] : null;
            const parsed = lastMatch ? lastMatch.match(/(\d+) passed, (\d+) failed/) : null;
            const passed = parsed ? parseInt(parsed[1]) : 0;
            const failed = parsed ? parseInt(parsed[2]) : (code !== 0 ? 1 : 0);

            resolve({
                label: group.label,
                status: code === 0 ? 'PASS' : 'FAIL',
                passed,
                failed,
                output,
                code,
            });
        });

        child.on('error', (err) => {
            clearTimeout(timer);
            resolve({
                label: group.label,
                status: 'FAIL',
                passed: 0,
                failed: 1,
                output: err.message,
                code: 1,
            });
        });
    });
}

const STAGGER_MS = 5000; // Stagger group starts to avoid overwhelming the dev server

const startTime = Date.now();
const results = await Promise.all(GROUPS.map((group, i) =>
    new Promise(resolve => setTimeout(resolve, i * STAGGER_MS))
        .then(() => {
            console.log(`  Starting: ${group.label}...`);
            return runGroup(group);
        })
));
const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

// Print all group outputs
for (const r of results) {
    console.log(r.output);
}

// Summary
let totalPassed = 0, totalFailed = 0;
console.log('\n' + '='.repeat(60));
console.log('  TEST SUITE SUMMARY');
console.log('='.repeat(60) + '\n');

const maxLen = Math.max(...results.map(r => r.label.length));
for (const r of results) {
    totalPassed += r.passed;
    totalFailed += r.failed;
    const pad = ' '.repeat(maxLen - r.label.length);
    const icon = r.status === 'PASS' ? 'OK' : 'FAIL';
    console.log(`  ${icon}  ${r.label}${pad}  (${r.passed} passed, ${r.failed} failed)`);
}

console.log(`\n  Total: ${totalPassed} passed, ${totalFailed} failed`);
console.log(`  Time:  ${elapsed}s (parallel)`);
console.log('='.repeat(60) + '\n');

process.exit(totalFailed > 0 ? 1 : 0);
