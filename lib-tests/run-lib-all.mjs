/**
 * Top-level library test orchestrator.
 * Runs pure function tests (Node.js) then browser tests (Playwright).
 *
 * Usage:
 *   node lib-tests/run-lib-all.mjs          # headless
 *   HEADED=1 node lib-tests/run-lib-all.mjs # headed for debugging
 *
 * Prerequisites:
 *   npx vite --port 5204  (dev server must be running for browser tests)
 */
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const libPath = join(root, 'dist', 'lib', 'geometric-interior.js');

// Ensure library is built for pure tests
if (!existsSync(libPath)) {
    console.log('Library not built. Running build:lib...');
    execSync('npm run build:lib', { cwd: root, stdio: 'inherit' });
}

console.log('=== Library Tests ===\n');

// Run pure tests
console.log('--- Running Pure Function Tests ---');
const pure = await import('./pure/run-pure.mjs');

// Run browser tests
console.log('\n--- Running Browser Tests ---');
const browser = await import('./browser/run-lib-browser.mjs');

// Combined summary
const totalPassed = pure.passed + browser.passed;
const totalFailed = pure.failed + browser.failed;

console.log('\n' + '='.repeat(50));
console.log('  LIBRARY TEST SUMMARY');
console.log('='.repeat(50));
console.log(`  Pure:    ${pure.passed} passed, ${pure.failed} failed`);
console.log(`  Browser: ${browser.passed} passed, ${browser.failed} failed`);
console.log(`  Total:   ${totalPassed} passed, ${totalFailed} failed`);
console.log('='.repeat(50) + '\n');

console.log(`${totalPassed} passed, ${totalFailed} failed`);

if (totalFailed > 0) process.exit(1);
