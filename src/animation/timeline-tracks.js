/**
 * Timeline visualization and overlay track editor for the animation editor.
 *
 * Renders a horizontal timeline with:
 * - Time ruler
 * - Event track (read-only proportional blocks)
 * - Camera lane (editable spans for zoom/rotate moves)
 * - Param lanes (twinkle, dynamism spans)
 * - Focus lane (focalDepth/blurAmount spans)
 * - Properties popover for selected spans
 */

import { totalDuration } from '../../lib/core/timeline.js';

const EASING_OPTIONS = ['linear', 'ease-in', 'ease-out', 'ease-in-out'];

/**
 * Create the timeline visualization.
 *
 * @param {object} opts
 * @param {HTMLElement} opts.containerEl - #timelineArea
 * @param {function} opts.getAnimation - () => Animation
 * @param {function} opts.onAnimationChange - (animation) => void
 * @param {function} opts.onTimeSeek - (timeSeconds: number) => void
 * @returns {{ refresh, setPlayheadTime, getSelectedSpan, destroy }}
 */
export function createTimeline({ containerEl, getAnimation, onAnimationChange, onTimeSeek }) {
    let selectedSpan = null;   // { lane: 'camera'|'param:twinkle'|'param:dynamism'|'focus', index: number }
    let playheadTime = 0;
    let popoverEl = null;

    // ── Build static structure ──
    const rulerEl = el('div', 'timeline-ruler');
    const eventTrackEl = el('div', 'timeline-event-track');
    const lanesEl = el('div', 'timeline-lanes');
    const playheadEl = el('div', 'timeline-playhead');

    const playheadHandle = el('div', 'timeline-playhead-handle');
    playheadEl.appendChild(playheadHandle);

    // Lane definitions
    const laneDefs = [
        { key: 'camera', label: 'Camera', getSpans: (a) => a.cameraMoves, setSpans: (a, s) => { a.cameraMoves = s; } },
        { key: 'param:twinkle', label: 'Twinkle', getSpans: (a) => a.paramTracks.filter(t => t.param === 'twinkle') },
        { key: 'param:dynamism', label: 'Dynamism', getSpans: (a) => a.paramTracks.filter(t => t.param === 'dynamism') },
        { key: 'focus', label: 'Focus', getSpans: (a) => a.focusTracks || [] },
    ];

    // ── Render ──

    function refresh() {
        const anim = getAnimation();
        const dur = totalDuration(anim);
        if (dur <= 0 || anim.events.length === 0) {
            containerEl.innerHTML = '';
            return;
        }

        containerEl.innerHTML = '';
        renderRuler(anim, dur);
        renderEventTrack(anim, dur);
        renderLanes(anim, dur);
        containerEl.appendChild(rulerEl);

        // Wrap event track and lanes with playhead
        const trackArea = el('div', '');
        trackArea.style.position = 'relative';
        trackArea.style.marginLeft = '60px';
        trackArea.appendChild(eventTrackEl);

        // Lanes inside the track area
        for (const laneRow of lanesEl.children) {
            const body = laneRow.querySelector('.timeline-lane-body');
            if (body) {
                // Lanes are positioned inside trackArea for playhead alignment
            }
        }

        containerEl.appendChild(trackArea);
        containerEl.appendChild(lanesEl);

        // Position playhead
        updatePlayheadPosition(dur);
        trackArea.appendChild(playheadEl);

        // Setup playhead drag
        setupPlayheadDrag(trackArea, dur);
    }

    function renderRuler(anim, dur) {
        rulerEl.innerHTML = '';
        // Event boundaries
        let t = 0;
        for (const ev of anim.events) {
            const tick = el('span', 'timeline-ruler-tick');
            tick.textContent = t.toFixed(t === 0 ? 0 : 1) + 's';
            tick.style.left = pct(t, dur);
            rulerEl.appendChild(tick);
            t += ev.duration;
        }
        // End tick
        const endTick = el('span', 'timeline-ruler-tick');
        endTick.textContent = dur.toFixed(1) + 's';
        endTick.style.left = pct(dur, dur);
        rulerEl.appendChild(endTick);
    }

    function renderEventTrack(anim, dur) {
        eventTrackEl.innerHTML = '';
        eventTrackEl.style.marginLeft = '0';
        for (const ev of anim.events) {
            const block = el('div', 'timeline-event-block');
            block.dataset.type = ev.type;
            block.style.flex = `${ev.duration} 0 0`;

            const typeLabel = el('span', 'timeline-event-block-type');
            typeLabel.textContent = ev.type;
            block.appendChild(typeLabel);

            const durLabel = el('span', 'timeline-event-block-dur');
            durLabel.textContent = ev.duration.toFixed(1) + 's';
            block.appendChild(durLabel);

            eventTrackEl.appendChild(block);
        }
    }

    function renderLanes(anim, dur) {
        lanesEl.innerHTML = '';

        // Camera lane
        renderLane(lanesEl, 'Camera', anim.cameraMoves, dur, {
            createDefault: () => ({
                type: 'zoom', startTime: 0, endTime: dur,
                easing: 'ease-in-out',
                from: { zoom: 1.0 }, to: { zoom: 0.85 },
            }),
            getLabel: (span) => {
                if (span.type === 'zoom') return `z ${fmtNum(span.from.zoom)}→${fmtNum(span.to.zoom)}`;
                return `r ${fmtNum(span.from.orbitY)}→${fmtNum(span.to.orbitY)}°`;
            },
            getArray: () => anim.cameraMoves,
            setArray: (arr) => { anim.cameraMoves = arr; },
            laneKey: 'camera',
        });

        // Twinkle lane
        const twinkleSpans = anim.paramTracks.filter(t => t.param === 'twinkle');
        renderLane(lanesEl, 'Twinkle', twinkleSpans, dur, {
            createDefault: () => ({
                param: 'twinkle', startTime: 0, endTime: dur,
                easing: 'ease-in', from: 0, to: 0.6,
            }),
            getLabel: (span) => `${fmtNum(span.from)}→${fmtNum(span.to)}`,
            getArray: () => anim.paramTracks.filter(t => t.param === 'twinkle'),
            setArray: (arr) => {
                anim.paramTracks = anim.paramTracks.filter(t => t.param !== 'twinkle').concat(arr);
            },
            laneKey: 'param:twinkle',
        });

        // Dynamism lane
        const dynamismSpans = anim.paramTracks.filter(t => t.param === 'dynamism');
        renderLane(lanesEl, 'Dynamism', dynamismSpans, dur, {
            createDefault: () => ({
                param: 'dynamism', startTime: 0, endTime: dur,
                easing: 'ease-in-out', from: 0, to: 0.5,
            }),
            getLabel: (span) => `${fmtNum(span.from)}→${fmtNum(span.to)}`,
            getArray: () => anim.paramTracks.filter(t => t.param !== 'dynamism' ? false : true),
            setArray: (arr) => {
                anim.paramTracks = anim.paramTracks.filter(t => t.param !== 'dynamism').concat(arr);
            },
            laneKey: 'param:dynamism',
        });

        // Focus lane
        const focusSpans = anim.focusTracks || [];
        renderLane(lanesEl, 'Focus', focusSpans, dur, {
            createDefault: () => ({
                startTime: 0, endTime: dur,
                easing: 'ease-in-out',
                from: { focalDepth: 0, blurAmount: 0 },
                to: { focalDepth: 1, blurAmount: 0.5 },
            }),
            getLabel: (span) => `d${fmtNum(span.from.focalDepth)}→${fmtNum(span.to.focalDepth)}`,
            getArray: () => anim.focusTracks || [],
            setArray: (arr) => { anim.focusTracks = arr; },
            laneKey: 'focus',
        });
    }

    function renderLane(parent, label, spans, dur, opts) {
        const row = el('div', 'timeline-lane-row');

        const header = el('div', 'timeline-lane-header');
        const headerLabel = el('span', '');
        headerLabel.textContent = label;
        header.appendChild(headerLabel);

        const addBtn = el('button', 'timeline-lane-add-btn');
        addBtn.textContent = '+';
        addBtn.addEventListener('click', () => {
            const anim = getAnimation();
            const arr = opts.getArray();
            arr.push(opts.createDefault());
            opts.setArray(arr);
            onAnimationChange(anim);
            refresh();
        });
        header.appendChild(addBtn);
        row.appendChild(header);

        const body = el('div', 'timeline-lane-body');

        spans.forEach((span, i) => {
            const spanEl = el('div', 'timeline-span');
            const isSelected = selectedSpan && selectedSpan.laneKey === opts.laneKey && selectedSpan.index === i;
            if (isSelected) spanEl.classList.add('selected');

            spanEl.style.left = pct(span.startTime, dur);
            spanEl.style.width = `calc(${pct(span.endTime - span.startTime, dur)})`;

            const labelEl = el('span', '');
            labelEl.textContent = opts.getLabel(span);
            spanEl.appendChild(labelEl);

            // Resize handles
            const handleLeft = el('div', 'span-handle span-handle-left');
            const handleRight = el('div', 'span-handle span-handle-right');
            spanEl.appendChild(handleLeft);
            spanEl.appendChild(handleRight);

            // Click to select
            spanEl.addEventListener('click', (e) => {
                e.stopPropagation();
                selectedSpan = { laneKey: opts.laneKey, index: i };
                refresh();
                showPopover(span, opts, i, dur);
            });

            // Drag resize
            setupResizeHandle(handleLeft, span, 'start', dur, opts);
            setupResizeHandle(handleRight, span, 'end', dur, opts);

            body.appendChild(spanEl);
        });

        // Double-click empty space to create new span
        body.addEventListener('dblclick', (e) => {
            if (e.target !== body) return;
            const rect = body.getBoundingClientRect();
            const clickPct = (e.clientX - rect.left) / rect.width;
            const clickTime = clickPct * dur;

            const anim = getAnimation();
            const newSpan = opts.createDefault();
            newSpan.startTime = Math.max(0, clickTime - dur * 0.1);
            newSpan.endTime = Math.min(dur, clickTime + dur * 0.1);
            const arr = opts.getArray();
            arr.push(newSpan);
            opts.setArray(arr);
            onAnimationChange(anim);
            refresh();
        });

        row.appendChild(body);
        parent.appendChild(row);
    }

    // ── Resize handles ──

    function setupResizeHandle(handleEl, span, edge, dur, opts) {
        let startX = 0;
        let startVal = 0;
        let bodyWidth = 0;

        function onMouseDown(e) {
            e.stopPropagation();
            e.preventDefault();
            startX = e.clientX;
            startVal = edge === 'start' ? span.startTime : span.endTime;
            const body = handleEl.closest('.timeline-lane-body');
            bodyWidth = body ? body.getBoundingClientRect().width : 1;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }

        function onMouseMove(e) {
            const dx = e.clientX - startX;
            const dt = (dx / bodyWidth) * dur;
            let newVal = startVal + dt;

            if (edge === 'start') {
                newVal = Math.max(0, Math.min(span.endTime - 0.1, newVal));
                span.startTime = Math.round(newVal * 10) / 10;
            } else {
                newVal = Math.max(span.startTime + 0.1, Math.min(dur, newVal));
                span.endTime = Math.round(newVal * 10) / 10;
            }

            const anim = getAnimation();
            onAnimationChange(anim);
            refresh();
        }

        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }

        handleEl.addEventListener('mousedown', onMouseDown);
    }

    // ── Popover ──

    function showPopover(span, opts, index, dur) {
        hidePopover();
        popoverEl = el('div', 'span-popover');

        const title = el('div', 'span-popover-title');
        title.textContent = opts.laneKey.includes('param') ? 'Parameter Track' :
            opts.laneKey === 'camera' ? 'Camera Move' : 'Focus Track';
        popoverEl.appendChild(title);

        // Time range
        const timeRow = el('div', 'span-popover-row');
        timeRow.appendChild(labelEl('Start'));
        const startInput = numInput(span.startTime, 0, dur, 0.1, (v) => {
            span.startTime = v;
            update();
        });
        timeRow.appendChild(startInput);
        timeRow.appendChild(arrowEl('s'));

        timeRow.appendChild(labelEl('End'));
        const endInput = numInput(span.endTime, 0, dur, 0.1, (v) => {
            span.endTime = v;
            update();
        });
        timeRow.appendChild(endInput);
        timeRow.appendChild(arrowEl('s'));
        popoverEl.appendChild(timeRow);

        // Value fields (vary by type)
        if (opts.laneKey === 'camera') {
            if (span.type === 'zoom') {
                const valRow = el('div', 'span-popover-row');
                valRow.appendChild(labelEl('Zoom'));
                valRow.appendChild(numInput(span.from.zoom ?? 1, 0.3, 3, 0.05, (v) => { span.from.zoom = v; update(); }));
                valRow.appendChild(arrowEl('\u2192'));
                valRow.appendChild(numInput(span.to.zoom ?? 1, 0.3, 3, 0.05, (v) => { span.to.zoom = v; update(); }));
                popoverEl.appendChild(valRow);
            }
            // Orbit Y
            const orbitRow = el('div', 'span-popover-row');
            orbitRow.appendChild(labelEl('Orbit Y'));
            orbitRow.appendChild(numInput(span.from.orbitY ?? 0, 0, 360, 5, (v) => { span.from.orbitY = v; update(); }));
            orbitRow.appendChild(arrowEl('\u2192'));
            orbitRow.appendChild(numInput(span.to.orbitY ?? 0, 0, 360, 5, (v) => { span.to.orbitY = v; update(); }));
            orbitRow.appendChild(arrowEl('\u00B0'));
            popoverEl.appendChild(orbitRow);

            // Camera type toggle
            const typeRow = el('div', 'span-popover-row');
            typeRow.appendChild(labelEl('Type'));
            const typeSel = document.createElement('select');
            typeSel.className = 'span-popover-input';
            typeSel.style.width = 'auto';
            for (const opt of ['zoom', 'rotate']) {
                const o = document.createElement('option');
                o.value = opt;
                o.textContent = opt;
                if (opt === span.type) o.selected = true;
                typeSel.appendChild(o);
            }
            typeSel.addEventListener('change', () => { span.type = typeSel.value; update(); });
            typeRow.appendChild(typeSel);
            popoverEl.appendChild(typeRow);
        } else if (opts.laneKey.startsWith('param:')) {
            const valRow = el('div', 'span-popover-row');
            valRow.appendChild(labelEl('Value'));
            valRow.appendChild(numInput(span.from, 0, 1, 0.05, (v) => { span.from = v; update(); }));
            valRow.appendChild(arrowEl('\u2192'));
            valRow.appendChild(numInput(span.to, 0, 1, 0.05, (v) => { span.to = v; update(); }));
            popoverEl.appendChild(valRow);
        } else if (opts.laneKey === 'focus') {
            const depthRow = el('div', 'span-popover-row');
            depthRow.appendChild(labelEl('Depth'));
            depthRow.appendChild(numInput(span.from.focalDepth, 0, 1, 0.05, (v) => { span.from.focalDepth = v; update(); }));
            depthRow.appendChild(arrowEl('\u2192'));
            depthRow.appendChild(numInput(span.to.focalDepth, 0, 1, 0.05, (v) => { span.to.focalDepth = v; update(); }));
            popoverEl.appendChild(depthRow);

            const blurRow = el('div', 'span-popover-row');
            blurRow.appendChild(labelEl('Blur'));
            blurRow.appendChild(numInput(span.from.blurAmount, 0, 1, 0.05, (v) => { span.from.blurAmount = v; update(); }));
            blurRow.appendChild(arrowEl('\u2192'));
            blurRow.appendChild(numInput(span.to.blurAmount, 0, 1, 0.05, (v) => { span.to.blurAmount = v; update(); }));
            popoverEl.appendChild(blurRow);
        }

        // Easing
        const easingRow = el('div', 'span-popover-row');
        easingRow.appendChild(labelEl('Easing'));
        const easingSel = document.createElement('select');
        easingSel.className = 'span-popover-input';
        easingSel.style.width = 'auto';
        for (const opt of EASING_OPTIONS) {
            const o = document.createElement('option');
            o.value = opt;
            o.textContent = opt;
            if (opt === span.easing) o.selected = true;
            easingSel.appendChild(o);
        }
        easingSel.addEventListener('change', () => { span.easing = easingSel.value; update(); });
        easingRow.appendChild(easingSel);
        popoverEl.appendChild(easingRow);

        // Actions
        const actions = el('div', 'span-popover-actions');
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-span-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => {
            const arr = opts.getArray();
            arr.splice(index, 1);
            opts.setArray(arr);
            selectedSpan = null;
            hidePopover();
            const anim = getAnimation();
            onAnimationChange(anim);
            refresh();
        });
        actions.appendChild(deleteBtn);

        const doneBtn = document.createElement('button');
        doneBtn.textContent = 'Done';
        doneBtn.addEventListener('click', () => {
            selectedSpan = null;
            hidePopover();
            refresh();
        });
        actions.appendChild(doneBtn);
        popoverEl.appendChild(actions);

        containerEl.appendChild(popoverEl);

        function update() {
            const anim = getAnimation();
            onAnimationChange(anim);
            refresh();
            // Re-show popover (refresh rebuilds DOM)
            showPopover(span, opts, index, dur);
        }
    }

    function hidePopover() {
        if (popoverEl) {
            popoverEl.remove();
            popoverEl = null;
        }
    }

    // ── Playhead ──

    function updatePlayheadPosition(dur) {
        if (dur <= 0) return;
        playheadEl.style.left = pct(playheadTime, dur);
    }

    function setupPlayheadDrag(trackArea, dur) {
        let dragging = false;

        playheadHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            dragging = true;
            document.addEventListener('mousemove', onDrag);
            document.addEventListener('mouseup', onDragEnd);
        });

        function onDrag(e) {
            if (!dragging) return;
            const rect = trackArea.getBoundingClientRect();
            const pctX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            playheadTime = pctX * dur;
            updatePlayheadPosition(dur);
            onTimeSeek(playheadTime);
        }

        function onDragEnd() {
            dragging = false;
            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('mouseup', onDragEnd);
        }
    }

    // ── Keyboard ──

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' && selectedSpan) {
            // Delete selected span
            const anim = getAnimation();
            const laneDef = laneDefs.find(l => l.key === selectedSpan.laneKey);
            if (!laneDef) return;
            // Handled via the popover delete button
        }
        if (e.key === 'Escape') {
            selectedSpan = null;
            hidePopover();
            refresh();
        }
    });

    // ── Helpers ──

    function el(tag, className) {
        const e = document.createElement(tag);
        if (className) e.className = className;
        return e;
    }

    function pct(time, dur) {
        return ((time / dur) * 100).toFixed(2) + '%';
    }

    function fmtNum(v) {
        if (v === undefined || v === null) return '0';
        return Number(v).toFixed(1);
    }

    function labelEl(text) {
        const l = el('span', 'span-popover-label');
        l.textContent = text;
        return l;
    }

    function arrowEl(text) {
        const a = el('span', 'span-popover-arrow');
        a.textContent = text;
        return a;
    }

    function numInput(value, min, max, step, onChange) {
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'span-popover-input';
        input.min = min;
        input.max = max;
        input.step = step;
        input.value = typeof value === 'number' ? value.toFixed(step < 1 ? 2 : 0) : '0';
        input.addEventListener('change', () => {
            let v = parseFloat(input.value);
            if (isNaN(v)) v = min;
            v = Math.max(min, Math.min(max, v));
            onChange(v);
        });
        return input;
    }

    // ── Public API ──

    return {
        refresh,
        setPlayheadTime(t) {
            playheadTime = t;
            const anim = getAnimation();
            const dur = totalDuration(anim);
            if (dur > 0) updatePlayheadPosition(dur);
        },
        getSelectedSpan() {
            return selectedSpan;
        },
        destroy() {
            containerEl.innerHTML = '';
            selectedSpan = null;
            hidePopover();
        },
    };
}
