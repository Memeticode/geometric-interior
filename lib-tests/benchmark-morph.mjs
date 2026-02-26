/**
 * Benchmark: morphPrepare + morphUpdate timing across different
 * frame counts and profile combinations.
 *
 * Usage: node lib-tests/benchmark-morph.mjs
 * Requires: Vite dev server running on port 5204
 */

import { chromium } from 'playwright';

const PORT = 5204;
const URL = `http://localhost:${PORT}/lib-test.html`;

// Profile pairs to test (diverse density/fracture combos)
const PAIRS = [
    ['Verdant Stream', 'Prismatic Abyss'],
    ['Rose Quartz', 'Dark Ruby'],
    ['Sapphire Lattice', 'Citrine Whisper'],
    ['Spectral Drift', 'Coral Breath'],
    ['Violet Sanctum', 'Teal Meridian'],
];

const FPS = 24;
const DURATIONS = [1, 2, 3]; // seconds

async function main() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: 'networkidle' });

    // Wait for testLib
    await page.waitForFunction(() => typeof window.testLib !== 'undefined');

    // Load profiles
    const profileNames = await page.evaluate(() => {
        const selEl = document.getElementById('baseProfile');
        return Array.from(selEl.options).map(o => o.value);
    });

    console.log(`Available profiles: ${profileNames.join(', ')}\n`);

    // Get profile data
    const profiles = await page.evaluate((names) => {
        const STORAGE_KEY = 'geo_self_portrait_profiles_v3';
        const starterProfiles = {};

        // Rebuild profile map from the select options + starter data
        // We'll use the testLib API with the profiles already loaded
        const selBase = document.getElementById('baseProfile');
        return names;
    }, profileNames);

    // Benchmark function
    async function benchmarkPair(baseName, targetName) {
        const results = {};

        for (const dur of DURATIONS) {
            const frameCount = Math.round(FPS * dur);

            const timing = await page.evaluate(async ({ baseName, targetName, frameCount }) => {
                const lib = window.testLib;

                // Find profiles from the loaded data
                const selBase = document.getElementById('baseProfile');
                const selTarget = document.getElementById('targetProfile');

                // Get profile entries from the internal map
                // We need to use the select to trigger profile loading
                selBase.value = baseName;
                selTarget.value = targetName;

                // Access profiles through the viewer's internal profileMap
                // Since we can't access it directly, we'll use the starter profiles
                const starterProfiles = await fetch('./src/core/starter-profiles.json').then(r => r.json());
                const baseP = starterProfiles[baseName];
                const targetP = starterProfiles[targetName];

                if (!baseP || !targetP) return null;

                const baseTweaks = baseP.paletteTweaks ? { custom: baseP.paletteTweaks } : undefined;
                const targetTweaks = targetP.paletteTweaks ? { custom: targetP.paletteTweaks } : undefined;

                // Time morphPrepare
                const t0 = performance.now();
                lib.morphPrepare(
                    baseP.seed, baseP.controls,
                    targetP.seed, targetP.controls,
                    baseTweaks, targetTweaks,
                );
                const prepMs = performance.now() - t0;

                // Time all morphUpdate frames
                const frameTimes = [];
                for (let i = 0; i < frameCount; i++) {
                    const t = frameCount <= 1 ? 0 : i / (frameCount - 1);
                    const ft0 = performance.now();
                    lib.morphStep(t);
                    frameTimes.push(performance.now() - ft0);
                }

                const totalFrameMs = frameTimes.reduce((s, v) => s + v, 0);
                const avgFrameMs = totalFrameMs / frameTimes.length;
                const maxFrameMs = Math.max(...frameTimes);
                const minFrameMs = Math.min(...frameTimes);

                lib.morphEnd();

                return {
                    prepMs: Math.round(prepMs * 10) / 10,
                    totalFrameMs: Math.round(totalFrameMs * 10) / 10,
                    avgFrameMs: Math.round(avgFrameMs * 100) / 100,
                    minFrameMs: Math.round(minFrameMs * 100) / 100,
                    maxFrameMs: Math.round(maxFrameMs * 100) / 100,
                    frameCount,
                };
            }, { baseName, targetName, frameCount });

            results[`${dur}s`] = timing;
        }

        return results;
    }

    // Run benchmarks
    console.log('='.repeat(80));
    console.log('MORPH TRANSITION BENCHMARK');
    console.log(`FPS: ${FPS} | Durations: ${DURATIONS.map(d => d + 's').join(', ')}`);
    console.log('='.repeat(80));

    const allResults = [];

    for (const [base, target] of PAIRS) {
        console.log(`\n${base} → ${target}`);
        console.log('-'.repeat(60));

        const results = await benchmarkPair(base, target);

        for (const [dur, r] of Object.entries(results)) {
            if (!r) {
                console.log(`  ${dur}: SKIPPED (profile not found)`);
                continue;
            }
            const totalMs = r.prepMs + r.totalFrameMs;
            console.log(
                `  ${dur} (${r.frameCount} frames): ` +
                `prep ${r.prepMs}ms + frames ${r.totalFrameMs}ms = ${totalMs.toFixed(1)}ms total | ` +
                `avg ${r.avgFrameMs}ms/frame (min ${r.minFrameMs}, max ${r.maxFrameMs})`
            );
        }

        allResults.push({ pair: `${base} → ${target}`, results });
    }

    // Summary table
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY TABLE');
    console.log('='.repeat(80));

    const header = ['Pair', ...DURATIONS.map(d => `${d}s (${Math.round(FPS * d)}f) prep`, ), ...DURATIONS.map(d => `${d}s total`)];
    console.log('\n%-35s  %12s  %12s  %12s  %12s  %12s  %12s', ...header);

    for (const { pair, results } of allResults) {
        const preps = DURATIONS.map(d => {
            const r = results[`${d}s`];
            return r ? `${r.prepMs}ms` : 'N/A';
        });
        const totals = DURATIONS.map(d => {
            const r = results[`${d}s`];
            return r ? `${(r.prepMs + r.totalFrameMs).toFixed(0)}ms` : 'N/A';
        });
        console.log(`  ${pair.padEnd(33)}  ${preps.map(p => p.padStart(10)).join('  ')}  ${totals.map(t => t.padStart(10)).join('  ')}`);
    }

    // Consistency analysis
    console.log('\n' + '='.repeat(80));
    console.log('CONSISTENCY ANALYSIS');
    console.log('='.repeat(80));

    for (const dur of DURATIONS) {
        const preps = allResults.map(r => r.results[`${dur}s`]?.prepMs).filter(Boolean);
        const avgs = allResults.map(r => r.results[`${dur}s`]?.avgFrameMs).filter(Boolean);
        if (preps.length > 0) {
            const prepMin = Math.min(...preps);
            const prepMax = Math.max(...preps);
            const prepAvg = (preps.reduce((s, v) => s + v, 0) / preps.length).toFixed(1);
            const avgMin = Math.min(...avgs).toFixed(2);
            const avgMax = Math.max(...avgs).toFixed(2);
            console.log(
                `  ${dur}s: prep range ${prepMin}-${prepMax}ms (avg ${prepAvg}ms) | ` +
                `frame avg range ${avgMin}-${avgMax}ms`
            );
        }
    }

    await browser.close();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
