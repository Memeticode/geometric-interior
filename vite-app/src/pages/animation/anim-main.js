/**
 * Animation Editor — mountable module for the gallery SPA.
 * Exports init/destroy functions called by gallery-main.js
 * when entering/leaving /animation/create.
 */

import { toast } from '../../components/toast.js';
import { t, getLocale } from '../../i18n/locale.js';
import { loadPortraits, loadProfiles, ensureStarterProfiles } from '../../stores/profiles.js';
import { initGalleryWorker } from '../gallery/gallery-worker-bridge.js';
import { createEventList } from './event-list.js';
import { createProfilePicker } from './profile-picker.js';
import { isSeedTag, seedTagToLabel } from '@geometric-interior/core/text-generation/seed-tags.js';
import { totalDuration, totalFrames, evaluateTimeline } from '@geometric-interior/core/timeline.js';
import { createTimeline } from './timeline-tracks.js';
import { getTemplates, applyTemplate } from './templates.js';
import { createPreviewPlayer } from './preview.js';

// ── Resolution map ──
const RESOLUTIONS = {
    pre: { w: 420,  h: 270 },
    sd:  { w: 840,  h: 540 },
    hd:  { w: 1400, h: 900 },
    fhd: { w: 1680, h: 1080 },
    qhd: { w: 2520, h: 1620 },
    '4k': { w: 3360, h: 2160 },
};

let instance = null;

/**
 * Initialize the animation editor.
 * Call when navigating to /animation/create.
 * @returns {object} API: { destroy(), getAnimation() }
 */
export function initAnimationEditor() {
    if (instance) return instance;

    // ── State ──
    const animation = {
        settings: { fps: 30, width: 1400, height: 900 },
        events: [],
        cameraMoves: [],
        paramTracks: [],
        focusTracks: [],
    };

    let selectedEventIndex = -1;

    // ── DOM refs (prefixed with 'anim' in the gallery SPA) ──
    const canvas = document.getElementById('animCanvas');
    const fpsSelect = document.getElementById('animFpsSelect');
    const resSelect = document.getElementById('animResolutionSelect');
    const durationReadout = document.getElementById('animDurationReadout');
    const frameReadout = document.getElementById('animFrameReadout');
    const totalDurationLabel = document.getElementById('animTotalDurationLabel');
    const totalFrameLabel = document.getElementById('animTotalFrameLabel');
    const renderBtn = document.getElementById('animRenderBtn');
    const previewPlayBtn = document.getElementById('animPreviewPlayBtn');
    const previewProfileName = document.getElementById('animPreviewProfileName');
    const previewSeedLabel = document.getElementById('animPreviewSeedLabel');
    const canvasOverlay = document.getElementById('animCanvasOverlay');
    const canvasOverlayText = document.getElementById('animCanvasOverlayText');
    const timelineArea = document.getElementById('animTimelineArea');

    // ── Worker ──
    const workerBridge = initGalleryWorker(canvas);
    let workerReady = false;

    if (workerBridge) {
        workerBridge.onReady(() => {
            workerReady = true;
            if (animation.events.length > 0 && selectedEventIndex >= 0) {
                updatePreview();
            }
        });

        workerBridge.on('rendered', () => {
            hideOverlay();
        });

        workerBridge.on('generate-animation-progress', (msg) => {
            showOverlay(`Rendering frame ${msg.frame} / ${msg.totalFrames}`);
        });

        workerBridge.on('generate-animation-complete', (msg) => {
            hideOverlay();
            toast(t('anim.renderComplete') || 'Animation rendered.');
            if (msg.videoBlob) {
                downloadVideoBlob(msg.videoBlob);
            }
        });

        workerBridge.on('generate-animation-failed', (msg) => {
            hideOverlay();
            toast(t('anim.renderFailed') || 'Animation render failed.');
            console.error('Animation render failed:', msg.error);
        });
    }

    // ── Profiles ──
    ensureStarterProfiles();
    const portraits = loadPortraits();

    // ── Profile Picker ──
    const profilePicker = createProfilePicker({
        portraits,
        getUserProfiles: loadProfiles,
        getThumbUrl: (name) => {
            try {
                const cache = JSON.parse(localStorage.getItem('geo_thumb_cache_v1') || '{}');
                return cache[name]?.dataUrl || null;
            } catch { return null; }
        },
        locale: getLocale(),
        modalId: 'animProfilePickerModal',
        bodyId: 'animProfilePickerBody',
        closeId: 'animProfilePickerClose',
    });

    // ── Event List ──
    const eventList = createEventList({
        containerEl: document.getElementById('animEventList'),
        addBtnEl: document.getElementById('animAddEventBtn'),
        onSelect(index) {
            selectedEventIndex = index;
            updatePreview();
        },
        onEventsChange(events) {
            animation.events = events;
            updateReadouts();
            updateButtons();
            refreshTimeline();
        },
        openProfilePicker() {
            return profilePicker.open();
        },
    });

    // ── Preview ──

    function updatePreview() {
        if (!workerReady || !workerBridge) return;
        if (selectedEventIndex < 0 || selectedEventIndex >= animation.events.length) {
            previewProfileName.textContent = '';
            previewSeedLabel.textContent = '';
            return;
        }

        const ev = animation.events[selectedEventIndex];
        let config, seed, displayName, seedLabel;
        if ((ev.type === 'expand' || ev.type === 'transition') && ev.config) {
            config = ev.config;
            seed = ev.seed;
            displayName = ev._displayName || '';
            seedLabel = ev._seedLabel || '';
        } else {
            for (let i = selectedEventIndex; i >= 0; i--) {
                const e = animation.events[i];
                if ((e.type === 'expand' || e.type === 'transition') && e.config) {
                    config = e.config;
                    seed = e.seed;
                    displayName = e._displayName || '';
                    seedLabel = e._seedLabel || '';
                    break;
                }
            }
        }

        if (config && seed) {
            previewProfileName.textContent = displayName;
            previewSeedLabel.textContent = seedLabel;
            showOverlay('Rendering...');
            workerBridge.sendRenderImmediate(seed, config, getLocale());
        }
    }

    // ── Readouts ──

    function updateReadouts() {
        const dur = totalDuration(animation);
        const frames = totalFrames(animation);
        const durStr = dur.toFixed(1) + 's';

        durationReadout.textContent = durStr;
        frameReadout.textContent = String(frames);
        totalDurationLabel.textContent = durStr;
        totalFrameLabel.textContent = frames + ' frames';
    }

    // ── Buttons ──

    function updateButtons() {
        const hasEvents = animation.events.length > 0;
        renderBtn.disabled = !hasEvents;
        previewPlayBtn.disabled = !hasEvents;
    }

    // ── Event listeners ──
    const abortCtrl = new AbortController();
    const sig = { signal: abortCtrl.signal };

    fpsSelect.addEventListener('change', () => {
        animation.settings.fps = parseInt(fpsSelect.value, 10);
        updateReadouts();
    }, sig);

    resSelect.addEventListener('change', () => {
        const res = RESOLUTIONS[resSelect.value] || RESOLUTIONS.hd;
        animation.settings.width = res.w;
        animation.settings.height = res.h;
        updateReadouts();
    }, sig);

    renderBtn.addEventListener('click', () => {
        if (animation.events.length === 0) {
            toast(t('anim.addEventFirst') || 'Add at least one event first.');
            return;
        }
        if (!workerBridge || !workerReady) {
            toast('Renderer not ready.');
            return;
        }

        const cleanAnimation = stripDisplayMeta(animation);
        showOverlay('Starting render...');
        workerBridge.sendGenerateAnimation({
            requestId: 'anim-' + Date.now(),
            animation: cleanAnimation,
        });
        toast(t('anim.queued') || 'Animation queued for rendering.');
    }, sig);

    previewPlayBtn.addEventListener('click', () => {
        if (animation.events.length === 0) return;
        if (previewPlayer.isPlaying()) {
            previewPlayer.pause();
        } else {
            previewPlayer.play();
        }
    }, sig);

    const localeHandler = () => { profilePicker.setLocale(getLocale()); };
    document.addEventListener('localechange', localeHandler, sig);

    // ── Helpers ──

    function stripDisplayMeta(anim) {
        return {
            ...anim,
            events: anim.events.map(ev => {
                const clean = { type: ev.type, duration: ev.duration, easing: ev.easing };
                if (ev.config) clean.config = ev.config;
                if (ev.seed) clean.seed = ev.seed;
                if (ev.camera) clean.camera = ev.camera;
                return clean;
            }),
        };
    }

    function downloadVideoBlob(videoBlob) {
        const url = URL.createObjectURL(videoBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `animation_${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }

    function showOverlay(text) {
        canvasOverlay.style.display = '';
        canvasOverlayText.textContent = text || '';
    }

    function hideOverlay() {
        canvasOverlay.style.display = 'none';
        canvasOverlayText.textContent = '';
    }

    // ── Timeline ──

    const timeline = createTimeline({
        containerEl: timelineArea,
        getAnimation() { return animation; },
        onAnimationChange(anim) {
            Object.assign(animation, {
                cameraMoves: anim.cameraMoves,
                paramTracks: anim.paramTracks,
                focusTracks: anim.focusTracks,
            });
        },
        onTimeSeek(timeSeconds) {
            if (!workerReady || !workerBridge) return;
            const dur = totalDuration(animation);
            if (dur <= 0) return;
            const t = Math.max(0, Math.min(dur, timeSeconds));
            const frame = evaluateTimeline(animation, t);
            if (frame.currentConfig && frame.currentSeed) {
                workerBridge.sendRenderImmediate(frame.currentSeed, frame.currentConfig, getLocale());
            }
        },
    });

    function refreshTimeline() {
        timeline.refresh();
    }

    // ── Preview Player ──

    const previewPlayer = createPreviewPlayer({
        workerBridge,
        getAnimation() { return animation; },
        onFrame(timeSeconds) {
            timeline.setPlayheadTime(timeSeconds);
        },
        onComplete() {
            previewPlayBtn.textContent = '\u25B6 Preview';
        },
        onStateChange(isPlaying) {
            previewPlayBtn.textContent = isPlaying ? '\u23F8 Pause' : '\u25B6 Preview';
        },
    });

    // ── Templates / Empty State ──

    function renderEmptyState() {
        const stage = document.querySelector('#animationEditor .anim-stage-content');
        if (!stage) return;

        const existing = stage.querySelector('.anim-empty-state');
        if (existing) existing.remove();

        if (animation.events.length > 0) return;

        const emptyState = document.createElement('div');
        emptyState.className = 'anim-empty-state';

        const heading = document.createElement('h3');
        heading.textContent = 'Start with a template';
        emptyState.appendChild(heading);

        const grid = document.createElement('div');
        grid.className = 'template-grid';

        for (const tmpl of getTemplates()) {
            const card = document.createElement('div');
            card.className = 'template-card';

            const name = document.createElement('div');
            name.className = 'template-card-name';
            name.textContent = tmpl.name;
            card.appendChild(name);

            const desc = document.createElement('div');
            desc.className = 'template-card-desc';
            desc.textContent = tmpl.description;
            card.appendChild(desc);

            card.addEventListener('click', () => applyTemplateFlow(tmpl));
            grid.appendChild(card);
        }

        emptyState.appendChild(grid);

        const orText = document.createElement('p');
        orText.textContent = 'or add your first event';
        emptyState.appendChild(orText);

        const addBtn = document.createElement('button');
        addBtn.className = 'add-event-btn';
        addBtn.style.width = 'auto';
        addBtn.style.margin = '0';
        addBtn.textContent = '+ Expand';
        addBtn.addEventListener('click', async () => {
            const profile = await profilePicker.open();
            if (!profile) return;
            animation.events.push({
                type: 'expand', duration: 3, easing: 'ease-out',
                config: profile.controls, seed: profile.seed,
                camera: profile.camera || { zoom: 1.0, rotation: 0 },
                _displayName: profile.name, _thumbUrl: profile.thumbUrl, _seedLabel: profile.seedLabel,
            });
            selectedEventIndex = 0;
            eventList.setEvents(animation.events);
            updateReadouts();
            updateButtons();
            refreshTimeline();
            updatePreview();
            removeEmptyState();
        });
        emptyState.appendChild(addBtn);

        const renderCard = stage.querySelector('.render-card');
        if (renderCard) {
            stage.insertBefore(emptyState, renderCard);
        } else {
            stage.appendChild(emptyState);
        }
    }

    function removeEmptyState() {
        const existing = document.querySelector('#animationEditor .anim-empty-state');
        if (existing) existing.remove();
    }

    async function applyTemplateFlow(tmpl) {
        const profiles = [];
        for (let i = 0; i < tmpl.profileSlots; i++) {
            const profile = await profilePicker.open();
            if (!profile) return;
            profiles.push(profile);
        }

        const result = applyTemplate(tmpl, profiles);

        animation.events = result.events;
        animation.cameraMoves = result.cameraMoves;
        animation.paramTracks = result.paramTracks;
        animation.focusTracks = result.focusTracks || [];

        selectedEventIndex = 0;
        eventList.setEvents(animation.events);
        updateReadouts();
        updateButtons();
        refreshTimeline();
        updatePreview();
        removeEmptyState();
    }

    // ── Init ──
    hideOverlay();
    updateReadouts();
    updateButtons();
    renderEmptyState();

    instance = {
        getAnimation() { return animation; },
        destroy() {
            abortCtrl.abort();
            if (previewPlayer.isPlaying()) previewPlayer.pause();
            if (workerBridge) workerBridge.destroy();
            removeEmptyState();
            instance = null;
        },
    };

    return instance;
}

/**
 * Destroy the animation editor and clean up.
 */
export function destroyAnimationEditor() {
    if (instance) {
        instance.destroy();
    }
}
