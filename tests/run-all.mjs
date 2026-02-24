/**
 * Test orchestrator: runs all test files in sequence, reports results.
 *
 * Usage:
 *   node tests/run-all.mjs          # Run all tests headless
 *   HEADED=1 node tests/run-all.mjs # Run headed for debugging
 *
 * Prerequisites:
 *   npx vite --port 5204   (dev server must be running)
 */
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TEST_FILES = [
    'test-rendering.mjs',
    'test-panel.mjs',
    'test-controls.mjs',
    'test-text.mjs',
    'test-profiles.mjs',
    'test-history.mjs',
    'test-morph.mjs',
    'test-thumbnails.mjs',
    'test-export.mjs',
    'test-import.mjs',
];

const results = [];
let totalPassed = 0;
let totalFailed = 0;

console.log('=== Running All Tests ===\n');
console.log(`Test files: ${TEST_FILES.length}`);
console.log(`Headed: ${process.env.HEADED === '1' ? 'yes' : 'no'}\n`);

for (const file of TEST_FILES) {
    const filePath = join(__dirname, file);
    const label = file.replace('.mjs', '');

    try {
        const env = { ...process.env };
        const output = execSync(`node "${filePath}"`, {
            encoding: 'utf-8',
            timeout: 180000, // 3 minutes per test file
            env,
            stdio: 'pipe',
        });

        // Parse pass/fail counts from output
        const match = output.match(/(\d+) passed, (\d+) failed/);
        const passed = match ? parseInt(match[1]) : 0;
        const failed = match ? parseInt(match[2]) : 0;

        totalPassed += passed;
        totalFailed += failed;

        results.push({
            file: label,
            status: failed === 0 ? 'PASS' : 'FAIL',
            passed,
            failed,
        });

        // Print output
        console.log(output);
    } catch (err) {
        // execSync throws on non-zero exit code
        const output = (err.stdout || '') + (err.stderr || '');
        const match = output.match(/(\d+) passed, (\d+) failed/);
        const passed = match ? parseInt(match[1]) : 0;
        const failed = match ? parseInt(match[2]) : 1;

        totalPassed += passed;
        totalFailed += failed;

        results.push({
            file: label,
            status: 'FAIL',
            passed,
            failed,
            error: err.message?.split('\n')[0] || 'Unknown error',
        });

        console.log(output);
    }
}

// ── Summary ──
console.log('\n' + '='.repeat(50));
console.log('  TEST SUITE SUMMARY');
console.log('='.repeat(50) + '\n');

const maxLen = Math.max(...results.map(r => r.file.length));
for (const r of results) {
    const pad = ' '.repeat(maxLen - r.file.length);
    const icon = r.status === 'PASS' ? 'OK' : 'FAIL';
    console.log(`  ${icon}  ${r.file}${pad}  (${r.passed} passed, ${r.failed} failed)`);
}

console.log(`\n  Total: ${totalPassed} passed, ${totalFailed} failed`);
console.log('='.repeat(50) + '\n');

process.exit(totalFailed > 0 ? 1 : 0);
