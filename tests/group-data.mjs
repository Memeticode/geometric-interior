/**
 * Group runner: Data tests (thumbnails + profiles + import + url-state).
 * Launches ONE browser, runs sub-suites sequentially with page reset between them.
 * Animation is disabled for faster test execution (morphs are instant).
 */
import { createTestContext, resetPage } from './helpers/browser.mjs';

const SUITES = [
    { mod: './test-thumbnails.mjs', label: 'Thumbnails' },
    { mod: './test-profiles.mjs',   label: 'Profiles' },
    { mod: './test-import.mjs',     label: 'Import' },
    { mod: './test-url-state.mjs', label: 'URL State' },
];

let totalPassed = 0, totalFailed = 0;
const results = [];

console.log('\n=== Group: Data ===\n');

const { page, errors, cleanup } = await createTestContext({ animation: false });

try {
    for (let i = 0; i < SUITES.length; i++) {
        const suite = SUITES[i];

        if (i > 0) {
            await resetPage(page, errors, { animation: false });
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

console.log('\n--- Group Data Summary ---');
for (const r of results) {
    console.log(`  ${r.label}: ${r.passed} passed, ${r.failed} failed`);
}
console.log(`\nGroup Data: ${totalPassed} passed, ${totalFailed} failed\n`);
process.exit(totalFailed > 0 ? 1 : 0);
