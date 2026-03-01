/**
 * Pure function test orchestrator.
 * Runs all Node.js tests that don't require a browser.
 *
 * Prerequisite: npm run build:lib (dist/lib/geometric-interior.js must exist)
 */
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const libPath = join(root, 'dist', 'lib', 'geometric-interior.js');

if (!existsSync(libPath)) {
    console.log('Library not built. Running build:lib...');
    execSync('npm run build:lib', { cwd: root, stdio: 'inherit' });
}

const SUITES = [
    'test-prng.mjs',
    'test-interpolation.mjs',
    'test-params.mjs',
    'test-schema.mjs',
    'test-text.mjs',
    'test-palettes.mjs',
    'test-seed-tags.mjs',
    'test-timeline.mjs',
];

let totalPassed = 0, totalFailed = 0;
const results = [];

console.log('\n=== Pure Function Tests ===');

for (const file of SUITES) {
    const mod = await import(`./${file}`);
    totalPassed += mod.passed;
    totalFailed += mod.failed;
    results.push({ file, passed: mod.passed, failed: mod.failed });
}

console.log('\n--- Pure Tests Summary ---');
for (const r of results) {
    console.log(`  ${r.file}: ${r.passed} passed, ${r.failed} failed`);
}
console.log(`\nPure Tests: ${totalPassed} passed, ${totalFailed} failed\n`);

if (totalFailed > 0) process.exit(1);

export { totalPassed as passed, totalFailed as failed };
