/**
 * Group runner: Visual tests (rendering + text).
 * Launches ONE browser, runs sub-suites sequentially with page reset between them.
 */
import { createTestContext, resetPage } from './helpers/browser.mjs';

const SUITES = [
    { mod: './test-rendering.mjs', label: 'Rendering' },
    { mod: './test-text.mjs',      label: 'Text' },
];

let totalPassed = 0, totalFailed = 0;
const results = [];

console.log('\n=== Group: Visual ===\n');

const { page, errors, cleanup } = await createTestContext();

try {
    for (let i = 0; i < SUITES.length; i++) {
        const suite = SUITES[i];

        if (i > 0) {
            await resetPage(page, errors);
        }

        const { runTests } = await import(suite.mod);
        const r = await runTests(page, errors);

        totalPassed += r.passed;
        totalFailed += r.failed;
        results.push({ label: suite.label, ...r });
    }
} finally {
    await cleanup();
}

console.log('\n--- Group Visual Summary ---');
for (const r of results) {
    console.log(`  ${r.label}: ${r.passed} passed, ${r.failed} failed`);
}
console.log(`\nGroup Visual: ${totalPassed} passed, ${totalFailed} failed\n`);
process.exit(totalFailed > 0 ? 1 : 0);
