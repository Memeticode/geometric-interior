/**
 * Group runner: Animation tests (morph + history + morph-smoothness).
 * Launches ONE browser, runs sub-suites sequentially with page reset between them.
 * Morph and smoothness tests run with animation enabled.
 * History tests run with animation disabled for speed (they test navigation, not animation).
 */
import { createTestContext, resetPage } from './helpers/browser.mjs';

const SUITES = [
    { mod: './test-morph.mjs',            label: 'Morph',            animation: true },
    { mod: './test-history.mjs',          label: 'History',          animation: false },
    { mod: './test-morph-smoothness.mjs', label: 'Morph Smoothness', animation: true },
];

let totalPassed = 0, totalFailed = 0;
const results = [];

console.log('\n=== Group: Animation ===\n');

const { page, errors, cleanup } = await createTestContext();

try {
    for (let i = 0; i < SUITES.length; i++) {
        const suite = SUITES[i];

        if (i > 0) {
            await resetPage(page, errors, { animation: suite.animation });
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

console.log('\n--- Group Animation Summary ---');
for (const r of results) {
    console.log(`  ${r.label}: ${r.passed} passed, ${r.failed} failed`);
}
console.log(`\nGroup Animation: ${totalPassed} passed, ${totalFailed} failed\n`);
process.exit(totalFailed > 0 ? 1 : 0);
