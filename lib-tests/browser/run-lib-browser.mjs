/**
 * Browser test orchestrator for library tests.
 * Launches one browser, runs suites sequentially against lib-test.html.
 */
import { createLibTestContext } from './helpers/lib-context.mjs';

const SUITES = [
    { mod: './test-still-determinism.mjs', label: 'Still Determinism' },
    { mod: './test-palette-variations.mjs', label: 'Palette Variations' },
    { mod: './test-control-ranges.mjs', label: 'Control Ranges' },
    { mod: './test-canvas-integrity.mjs', label: 'Canvas Integrity' },
    { mod: './test-morph-sequence.mjs', label: 'Morph Sequence' },
];

let totalPassed = 0, totalFailed = 0;
const results = [];

console.log('\n=== Library Browser Tests ===\n');

const { page, errors, cleanup } = await createLibTestContext();

try {
    for (const suite of SUITES) {
        errors.length = 0; // reset error collector between suites
        const { runTests } = await import(suite.mod);
        const r = await runTests(page, errors);
        totalPassed += r.passed;
        totalFailed += r.failed;
        results.push({ label: suite.label, ...r });
    }
} finally {
    await cleanup();
}

console.log('\n--- Library Browser Summary ---');
for (const r of results) {
    console.log(`  ${r.label}: ${r.passed} passed, ${r.failed} failed`);
}
console.log(`\nLibrary Browser: ${totalPassed} passed, ${totalFailed} failed\n`);

if (totalFailed > 0) process.exit(1);

export { totalPassed as passed, totalFailed as failed };
