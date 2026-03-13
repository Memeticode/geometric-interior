/**
 * Layout Morph — a reusable controller for CSS-driven layout transitions.
 *
 * Manages `data-layout` (current state) and `data-morph-to` (transition target)
 * attributes on a container element. CSS defines target values per layout state
 * and transition rules scoped to `[data-morph-to="X"]`.
 *
 * Phase timing is configured via `--lm-*-base` CSS vars (durations + delays).
 * Use `setMorphTiming()` to reconfigure phase order per element.
 *
 * Text-replace behavior: mark elements with `data-lm-text-replace="out|move|in"`
 * in HTML. Pass `onSwap` to `morph()` to activate — callback fires at the
 * midpoint of the specified phase (when opacity hits 0).
 *
 * @param {HTMLElement} container - Element to manage (receives data-layout/data-morph-to)
 * @param {{ initial?: string }} [options]
 */

function parseDur(v) {
    v = v.trim();
    if (!v) return 275; // fallback half-duration
    return v.endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000;
}

const PHASE_VARS = {
    out:  { dur: '--lm-out-base',  delay: '--lm-d1-base' },
    move: { dur: '--lm-move-base', delay: '--lm-d2-base' },
    in:   { dur: '--lm-in-base',   delay: '--lm-d3-base' },
};

export function createLayoutMorph(container, options = {}) {
    let state = options.initial ?? container.dataset.layout ?? '';
    let morphing = false;
    let pending = null; // { timer, onAfter, cleanup }

    if (state) container.dataset.layout = state;

    /** Read total morph duration (ms) from CSS vars on the container. */
    function readDuration() {
        const s = getComputedStyle(container);
        const speed = parseFloat(s.getPropertyValue('--lm-speed')) || 1;
        return Math.max(
            parseDur(s.getPropertyValue('--lm-d1-base')) + parseDur(s.getPropertyValue('--lm-out-base')),
            parseDur(s.getPropertyValue('--lm-d2-base')) + parseDur(s.getPropertyValue('--lm-move-base')),
            parseDur(s.getPropertyValue('--lm-d3-base')) + parseDur(s.getPropertyValue('--lm-in-base')),
        ) * speed;
    }

    return {
        get state() { return state; },
        get morphing() { return morphing; },

        morph(to, { onBefore, onAfter, onSwap } = {}) {
            if (to === state && !morphing) return Promise.resolve(state);
            // Cancel in-flight morph — snap forward
            if (pending) {
                clearTimeout(pending.timer);
                pending.cleanup?.();
                delete container.dataset.morphTo;
                pending.onAfter?.();
                pending = null;
            }
            if (to === state) { morphing = false; return Promise.resolve(state); }
            morphing = true;
            const from = state;

            onBefore?.(from, to);

            // Text-replace: activate when onSwap is provided
            const trEls = onSwap
                ? [...container.querySelectorAll('[data-lm-text-replace]')]
                : [];
            let swapTimer = null;
            if (trEls.length) {
                for (const el of trEls) el.classList.add('lm-text-replacing');
                const phase = trEls[0].dataset.lmTextReplace;
                const vars = PHASE_VARS[phase];
                if (vars) {
                    const s = getComputedStyle(container);
                    const speed = parseFloat(s.getPropertyValue('--lm-speed')) || 1;
                    const delay = parseDur(s.getPropertyValue(vars.delay)) * speed;
                    const dur = parseDur(s.getPropertyValue(vars.dur)) * speed;
                    swapTimer = setTimeout(() => onSwap(from, to), delay + dur * 0.5);
                }
            }

            container.dataset.morphTo = to;
            void container.offsetHeight;
            container.dataset.layout = to;
            state = to;

            const cleanup = () => {
                clearTimeout(swapTimer);
                for (const el of trEls) el.classList.remove('lm-text-replacing');
            };

            const duration = readDuration();
            return new Promise(resolve => {
                const timer = setTimeout(() => {
                    try { onAfter?.(from, to); }
                    finally {
                        cleanup();
                        delete container.dataset.morphTo;
                        morphing = false;
                        pending = null;
                        resolve(to);
                    }
                }, duration);
                pending = { timer, onAfter, cleanup };
            });
        },

        set(to) {
            if (pending) {
                clearTimeout(pending.timer);
                pending.cleanup?.();
                delete container.dataset.morphTo;
                pending = null;
            }
            state = to;
            morphing = false;
            container.dataset.layout = to;
        },
    };
}

/* ── Phase-order presets ── */
export const MORPH_TIMING = {
    /** out → move → in (default, slight overlap between phases) */
    sequential: { order: ['out', 'move', 'in'], gap: -0.05 },
    /** All three phases run simultaneously */
    parallel:   { order: [['out', 'move', 'in']] },
    /** in → move → out (reversed choreography) */
    reverse:    { order: ['in', 'move', 'out'], gap: -0.05 },
    /** Reposition first, then fade out old + fade in new together */
    moveFirst:  { order: ['move', ['out', 'in']] },
};

/**
 * Configure morph phase timing on an element.
 *
 * Sets `--lm-*-base` CSS vars so the speed scalar still applies via CSS calc().
 * Different elements can have independent phase configs while sharing --lm-speed.
 *
 * @param {HTMLElement} el
 * @param {object} config
 * @param {Array} config.order - Phase sequence. Strings run sequentially,
 *   nested arrays run in parallel.
 *   E.g. ['out','move','in']  → sequential (default)
 *        [['out','move','in']] → all parallel
 *        ['move', ['out','in']] → move first, then out+in together
 * @param {object} [config.durations] - { out, move, in } in seconds
 * @param {number} [config.gap] - seconds between sequential steps (negative = overlap)
 */
export function setMorphTiming(el, { order = ['out', 'move', 'in'], durations = {}, gap = 0 } = {}) {
    const dur = { out: 0.2, move: 0.3, in: 0.2, ...durations };
    const delays = { out: 0, move: 0, in: 0 };
    let cursor = 0;

    for (const step of order) {
        const phases = Array.isArray(step) ? step : [step];
        const active = phases.filter(p => dur[p] > 0);
        if (!active.length) continue;
        let maxDur = 0;
        for (const phase of active) {
            delays[phase] = Math.max(0, cursor);
            maxDur = Math.max(maxDur, dur[phase]);
        }
        cursor += maxDur + gap;
    }

    el.style.setProperty('--lm-out-base',  dur.out + 's');
    el.style.setProperty('--lm-move-base', dur.move + 's');
    el.style.setProperty('--lm-in-base',   dur.in + 's');
    el.style.setProperty('--lm-d1-base',   delays.out + 's');
    el.style.setProperty('--lm-d2-base',   delays.move + 's');
    el.style.setProperty('--lm-d3-base',   delays.in + 's');
}

/**
 * Remove per-element timing overrides, reverting to CSS defaults.
 * @param {HTMLElement} el
 */
export function clearMorphTiming(el) {
    for (const v of ['--lm-out-base', '--lm-move-base', '--lm-in-base',
                      '--lm-d1-base', '--lm-d2-base', '--lm-d3-base']) {
        el.style.removeProperty(v);
    }
}
