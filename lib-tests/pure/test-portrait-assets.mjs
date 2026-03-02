/**
 * Tests that every starter portrait has pre-rendered images
 * at each resolution tier in public/static/images/portraits/.
 */
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');

let passed = 0, failed = 0;

function test(name, fn) {
    try { fn(); passed++; console.log(`  PASS: ${name}`); }
    catch (e) { failed++; console.error(`  FAIL: ${name}\n    ${e.message}`); }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9-]+/g, '_').replace(/^_|_$/g, '');
}

const RESOLUTIONS = ['sd', 'hd', 'fhd', 'qhd', '4k'];
const portraitsDir = join(root, 'public', 'static', 'images', 'portraits');
const profilesPath = join(root, 'src', 'core', 'starter-profiles.json');

const profiles = JSON.parse(readFileSync(profilesPath, 'utf-8'));
const names = profiles.order;

console.log('\n=== Portrait Asset Tests ===\n');

test('portraits directory exists', () => {
    assert(existsSync(portraitsDir), `Missing directory: public/static/images/portraits/`);
});

for (const name of names) {
    const slug = slugify(name);
    for (const res of RESOLUTIONS) {
        const file = `${slug}-${res}.png`;
        test(`${name} has ${res.toUpperCase()} image (${file})`, () => {
            const full = join(portraitsDir, file);
            assert(existsSync(full), `Missing: public/static/images/portraits/${file}`);
        });
    }
}

test('all portrait names are in profiles.order', () => {
    assert(Array.isArray(names) && names.length > 0, 'profiles.order is empty');
    for (const name of names) {
        assert(typeof profiles[name] === 'object', `Profile "${name}" listed in order but missing data`);
    }
});

export { passed, failed };
