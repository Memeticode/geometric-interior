/**
 * Render queue — manages sequential generation job processing.
 * Jobs are processed one at a time through the gallery worker bridge.
 * Queue state is in-memory only (not persisted across page reloads).
 */

import { generateAssetId, putAsset, generateAnimAssetId, putAnimAsset } from '../ui/asset-store.js';
import { generateTitle, generateAltText } from '../../lib/core/text.js';
import { seedToString } from '../../lib/core/seed-tags.js';
import { xmur3, mulberry32 } from '../../lib/core/prng.js';
import { getResolution } from '../ui/resolution.js';
import { exportFromBuffer } from '../export/animation.js';

const FRAME_COUNT = 30;

/**
 * Create a render queue.
 * @param {Object} opts
 * @param {Object} opts.workerBridge — gallery worker bridge instance
 * @param {Function} opts.onUpdate — called on every job status change
 * @param {string} opts.locale — current locale
 * @returns {{ enqueue, cancel, getJobs }}
 */
export function createRenderQueue({ workerBridge, onUpdate, locale }) {
    /** @type {Array<RenderJob>} */
    const jobs = [];
    let activeJobId = null;

    function notify() {
        if (onUpdate) onUpdate(jobs.slice());
    }

    function findJob(id) {
        return jobs.find(j => j.id === id);
    }

    /**
     * Generate an auto-name for a job from seed + controls.
     */
    function autoName(seed, controls) {
        const seedStr = seedToString(seed);
        const rng = mulberry32(xmur3(seedStr + ':title')());
        return generateTitle(controls, rng, locale || 'en');
    }

    /**
     * Generate an auto-name from an animation's first expand event.
     */
    function autoNameFromAnimation(animation) {
        const expand = animation.events.find(e => e.type === 'expand' || e.type === 'transition');
        if (expand && expand.config && expand.seed) {
            return autoName(expand.seed, expand.config);
        }
        return 'Animation';
    }

    /**
     * Start the next queued job, if any.
     */
    function processNext() {
        if (activeJobId) return; // already working

        const next = jobs.find(j => j.status === 'queued');
        if (!next) return;

        activeJobId = next.id;
        next.status = 'rendering';
        next.progress = 0;
        next.label = 'Starting…';
        notify();

        if (next.jobType === 'animation') {
            workerBridge.sendGenerateAnimation({
                requestId: next.id,
                animation: next.animation,
            });
        } else {
            const res = getResolution();
            workerBridge.sendGenerate({
                requestId: next.id,
                seed: next.seed,
                controls: next.controls,
                locale: locale || 'en',
                staticWidth: res.w,
                staticHeight: res.h,
                spriteWidth: res.w,
                spriteHeight: res.h,
                frameCount: FRAME_COUNT,
            });
        }
    }

    // Wire up worker message handlers
    workerBridge.on('generate-progress', (msg) => {
        const job = findJob(msg.requestId);
        if (!job) return;
        job.progress = msg.progress;
        job.label = msg.label || '';
        notify();
    });

    workerBridge.on('generate-complete', async (msg) => {
        const job = findJob(msg.requestId);
        if (!job) return;

        // Convert thumbnail blob to data URL for fast gallery display
        let thumbDataUrl = '';
        try {
            thumbDataUrl = await blobToDataUrl(msg.thumbBlob);
        } catch (err) {
            console.warn('[render-queue] thumb dataURL conversion failed:', err);
        }

        // Generate alt text
        const nodeCount = msg.meta.nodeCount || 0;
        const altText = generateAltText(job.controls, nodeCount, msg.meta.title || job.name, locale || 'en');

        // Store in IndexedDB
        const asset = {
            id: job.id,
            name: job.name,
            seed: job.seed,
            controls: job.controls,
            thumbDataUrl,
            spriteBlob: msg.spriteBlob,
            staticBlob: msg.staticBlob,
            meta: {
                title: msg.meta.title || job.name,
                altText: msg.meta.altText || altText,
                nodeCount,
                width: msg.meta.width,
                height: msg.meta.height,
            },
            createdAt: job.createdAt,
        };
        await putAsset(asset);

        job.status = 'complete';
        job.progress = 100;
        job.label = 'Complete';
        job.asset = asset;
        activeJobId = null;
        notify();

        // Process next in queue
        processNext();
    });

    workerBridge.on('generate-failed', (msg) => {
        const job = findJob(msg.requestId);
        if (!job) return;

        if (msg.error === 'cancelled') {
            // Remove cancelled jobs entirely
            const idx = jobs.indexOf(job);
            if (idx >= 0) jobs.splice(idx, 1);
        } else {
            job.status = 'failed';
            job.error = msg.error;
            job.label = 'Failed';
        }
        activeJobId = null;
        notify();

        processNext();
    });

    /* ── Animation generation handlers ── */

    workerBridge.on('generate-animation-progress', (msg) => {
        const job = findJob(msg.requestId);
        if (!job) return;
        job.progress = Math.round(msg.progress * 100);
        job.label = `Rendering frame ${msg.frame}/${msg.totalFrames}`;
        notify();
    });

    workerBridge.on('generate-animation-complete', async (msg) => {
        const job = findJob(msg.requestId);
        if (!job) return;

        // Convert thumbnail blob to data URL
        let thumbDataUrl = '';
        if (msg.thumbBlob) {
            try { thumbDataUrl = await blobToDataUrl(msg.thumbBlob); }
            catch (err) { console.warn('[render-queue] anim thumb conversion failed:', err); }
        }

        // Video encoding: in-worker result or main-thread fallback
        let videoBlob = msg.videoBlob || null;
        let framesBlob = null;
        if (!videoBlob && msg.frames) {
            // Main-thread encoding fallback
            try {
                const tmpCanvas = document.createElement('canvas');
                tmpCanvas.width = msg.width;
                tmpCanvas.height = msg.height;
                const result = await exportFromBuffer({
                    frames: msg.frames,
                    fps: msg.fps,
                    durationMs: msg.durationS * 1000,
                    seed: '',
                    canvas: tmpCanvas,
                });
                if (result.kind === 'video') videoBlob = result.blob;
                else if (result.frames) {
                    // Pack PNG frames into a single blob
                    const parts = result.frames.map(f => f.blob);
                    framesBlob = new Blob(parts, { type: 'application/octet-stream' });
                }
            } catch (err) {
                console.warn('[render-queue] main-thread encoding failed:', err);
            }
            // Clean up transferred bitmaps
            for (const bm of msg.frames) { try { bm.close(); } catch { /* ignore */ } }
        }

        const asset = {
            id: job.id,
            name: job.name,
            animation: job.animation,
            videoBlob,
            framesBlob,
            thumbDataUrl,
            meta: {
                title: job.name,
                altText: '',
                fps: msg.fps,
                totalFrames: msg.totalFrames,
                durationS: msg.durationS,
                width: msg.width,
                height: msg.height,
            },
            createdAt: job.createdAt,
        };
        await putAnimAsset(asset);

        job.status = 'complete';
        job.progress = 100;
        job.label = 'Complete';
        job.asset = asset;
        activeJobId = null;
        notify();

        processNext();
    });

    workerBridge.on('generate-animation-failed', (msg) => {
        const job = findJob(msg.requestId);
        if (!job) return;

        if (msg.error === 'cancelled') {
            const idx = jobs.indexOf(job);
            if (idx >= 0) jobs.splice(idx, 1);
        } else {
            job.status = 'failed';
            job.error = msg.error;
            job.label = 'Failed';
        }
        activeJobId = null;
        notify();

        processNext();
    });

    return {
        /**
         * Add a new job to the queue.
         * @param {SeedTag} seed
         * @param {Controls} controls
         * @param {string} [name] — optional override name
         * @returns {string} job ID
         */
        enqueue(seed, controls, name) {
            const id = generateAssetId();
            const job = {
                id,
                name: name || autoName(seed, controls),
                seed,
                controls: { ...controls },
                status: 'queued',
                progress: 0,
                label: 'Queued',
                error: null,
                createdAt: Date.now(),
                asset: null,
            };
            jobs.push(job);
            notify();
            processNext();
            return id;
        },

        /**
         * Add an animation job to the queue.
         * @param {Animation} animation — timeline animation definition
         * @param {string} [name] — optional override name
         * @returns {string} job ID
         */
        enqueueAnimation(animation, name) {
            const id = generateAnimAssetId();
            const job = {
                id,
                jobType: 'animation',
                name: name || autoNameFromAnimation(animation),
                animation,
                status: 'queued',
                progress: 0,
                label: 'Queued',
                error: null,
                createdAt: Date.now(),
                asset: null,
            };
            jobs.push(job);
            notify();
            processNext();
            return id;
        },

        /**
         * Cancel a job. If queued, removes it. If rendering, cancels the worker.
         * @param {string} jobId
         */
        cancel(jobId) {
            const job = findJob(jobId);
            if (!job) return;

            if (job.status === 'queued') {
                const idx = jobs.indexOf(job);
                if (idx >= 0) jobs.splice(idx, 1);
                notify();
            } else if (job.status === 'rendering') {
                if (job.jobType === 'animation') {
                    workerBridge.cancelGenerateAnimation();
                } else {
                    workerBridge.cancelGenerate();
                }
            }
        },

        /**
         * Get a snapshot of all jobs.
         * @returns {Array}
         */
        getJobs() {
            return jobs.slice();
        },

        /**
         * Remove completed/failed jobs from the list.
         */
        clearFinished() {
            for (let i = jobs.length - 1; i >= 0; i--) {
                if (jobs[i].status === 'complete' || jobs[i].status === 'failed') {
                    jobs.splice(i, 1);
                }
            }
            notify();
        },
    };
}

/**
 * Convert a Blob to a data URL string.
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}
