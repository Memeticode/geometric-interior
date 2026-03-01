/**
 * Event list UI component for the animation editor.
 * Manages a vertical stack of scene cards representing ContentEvents.
 */

import { t } from '../i18n/locale.js';

const DEFAULT_DURATIONS = { expand: 3, pause: 5, transition: 4, collapse: 3 };
const DEFAULT_EASINGS = { expand: 'ease-out', pause: 'linear', transition: 'ease-in-out', collapse: 'ease-in' };
const EASING_OPTIONS = ['linear', 'ease-in', 'ease-out', 'ease-in-out'];
const EASING_LABELS = {
    'linear': 'linear',
    'ease-in': 'ease-in',
    'ease-out': 'ease-out',
    'ease-in-out': 'ease-in-out',
};

/**
 * Determine which event types are valid to add at the end of the current event list.
 */
function getValidEventTypes(events) {
    if (events.length === 0) return ['expand'];
    const last = events[events.length - 1];
    if (last.type === 'collapse') return ['expand'];
    // After expand, pause, or transition: can pause, transition, or collapse
    return ['pause', 'transition', 'collapse'];
}

/**
 * Create the event list UI.
 *
 * @param {object} opts
 * @param {HTMLElement} opts.containerEl - #eventList
 * @param {HTMLElement} opts.addBtnEl - #addEventBtn
 * @param {function} opts.onSelect - (index: number) => void
 * @param {function} opts.onEventsChange - (events: ContentEvent[]) => void
 * @param {function} opts.openProfilePicker - () => Promise<{name, seed, controls, camera, thumbUrl}>
 * @returns {{ setEvents, getEvents, getSelectedIndex, setSelectedIndex, refresh }}
 */
export function createEventList({ containerEl, addBtnEl, onSelect, onEventsChange, openProfilePicker }) {
    let events = [];
    let selectedIndex = -1;
    let pickerEl = null; // the inline add-event picker

    function notifyChange() {
        onEventsChange(events);
        renderCards();
    }

    // ── Card rendering ──

    function renderCards() {
        containerEl.innerHTML = '';
        events.forEach((ev, i) => {
            const card = buildCard(ev, i);
            containerEl.appendChild(card);
        });
    }

    function buildCard(ev, index) {
        const card = document.createElement('div');
        card.className = 'scene-card' + (index === selectedIndex ? ' selected' : '');
        card.addEventListener('click', (e) => {
            // Don't select if clicking an interactive control
            if (e.target.closest('input, select, button')) return;
            selectedIndex = index;
            renderCards();
            onSelect(index);
        });

        // ── Header row: badge + content ──
        const header = document.createElement('div');
        header.className = 'scene-card-header';

        const badge = document.createElement('span');
        badge.className = 'scene-type-badge';
        badge.dataset.type = ev.type;
        badge.textContent = ev.type.charAt(0).toUpperCase() + ev.type.slice(1);
        header.appendChild(badge);

        if (ev.type === 'expand' || ev.type === 'transition') {
            // Thumbnail + profile info
            const info = document.createElement('div');
            info.className = 'scene-card-info';

            if (ev._thumbUrl) {
                const thumb = document.createElement('img');
                thumb.className = 'scene-card-thumb';
                thumb.src = ev._thumbUrl;
                thumb.alt = ev._displayName || '';
                header.insertBefore(thumb, null);
            }

            const name = document.createElement('div');
            name.className = 'scene-card-name';
            name.textContent = ev._displayName || 'Untitled';
            info.appendChild(name);

            if (ev._seedLabel) {
                const seedLabel = document.createElement('div');
                seedLabel.className = 'scene-card-seed';
                seedLabel.textContent = ev._seedLabel;
                info.appendChild(seedLabel);
            }

            header.appendChild(info);
        } else {
            // Pause / collapse
            const holds = document.createElement('div');
            holds.className = 'scene-card-holds';
            holds.textContent = t('anim.holdsCurrentScene') || '(holds current scene)';
            header.appendChild(holds);
        }

        card.appendChild(header);

        // ── Controls row: duration, easing, reorder, delete ──
        const controls = document.createElement('div');
        controls.className = 'scene-card-controls';

        // Duration
        const durInput = document.createElement('input');
        durInput.type = 'number';
        durInput.className = 'duration-input';
        durInput.min = '0.5';
        durInput.max = '30';
        durInput.step = '0.5';
        durInput.value = ev.duration;
        durInput.addEventListener('input', () => {
            const v = parseFloat(durInput.value);
            if (!isNaN(v) && v >= 0.5 && v <= 30) {
                ev.duration = v;
                onEventsChange(events);
            }
        });
        durInput.addEventListener('blur', () => {
            let v = parseFloat(durInput.value);
            if (isNaN(v) || v < 0.5) v = 0.5;
            if (v > 30) v = 30;
            v = Math.round(v * 2) / 2; // snap to 0.5
            ev.duration = v;
            durInput.value = v;
            onEventsChange(events);
        });
        controls.appendChild(durInput);

        const durUnit = document.createElement('span');
        durUnit.className = 'duration-unit';
        durUnit.textContent = 's';
        controls.appendChild(durUnit);

        // Easing
        const easingSel = document.createElement('select');
        easingSel.className = 'easing-select';
        for (const key of EASING_OPTIONS) {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = EASING_LABELS[key];
            if (key === ev.easing) opt.selected = true;
            easingSel.appendChild(opt);
        }
        easingSel.addEventListener('change', () => {
            ev.easing = easingSel.value;
            onEventsChange(events);
        });
        controls.appendChild(easingSel);

        // Spacer
        const spacer = document.createElement('span');
        spacer.className = 'scene-card-spacer';
        controls.appendChild(spacer);

        // Actions
        const actions = document.createElement('div');
        actions.className = 'scene-card-actions';

        // Move up
        const upBtn = makeBtn('\u25B2', index === 0);
        upBtn.addEventListener('click', () => {
            if (index > 0) {
                [events[index - 1], events[index]] = [events[index], events[index - 1]];
                if (selectedIndex === index) selectedIndex = index - 1;
                else if (selectedIndex === index - 1) selectedIndex = index;
                notifyChange();
            }
        });
        actions.appendChild(upBtn);

        // Move down
        const downBtn = makeBtn('\u25BC', index === events.length - 1);
        downBtn.addEventListener('click', () => {
            if (index < events.length - 1) {
                [events[index], events[index + 1]] = [events[index + 1], events[index]];
                if (selectedIndex === index) selectedIndex = index + 1;
                else if (selectedIndex === index + 1) selectedIndex = index;
                notifyChange();
            }
        });
        actions.appendChild(downBtn);

        // Delete
        const delBtn = makeBtn('\u2715', false, true);
        delBtn.addEventListener('click', () => {
            events.splice(index, 1);
            if (selectedIndex >= events.length) selectedIndex = events.length - 1;
            notifyChange();
            if (selectedIndex >= 0) onSelect(selectedIndex);
        });
        actions.appendChild(delBtn);

        controls.appendChild(actions);
        card.appendChild(controls);

        // Camera info (if non-default)
        if (ev.camera && (ev.camera.zoom !== 1.0 || ev.camera.rotation !== 0)) {
            const camInfo = document.createElement('div');
            camInfo.className = 'scene-card-camera';
            camInfo.textContent = `z${ev.camera.zoom.toFixed(1)} r${Math.round(ev.camera.rotation)}\u00B0`;
            card.appendChild(camInfo);
        }

        return card;
    }

    function makeBtn(text, disabled, isDel) {
        const btn = document.createElement('button');
        btn.className = 'scene-card-btn' + (isDel ? ' delete-btn' : '');
        btn.textContent = text;
        btn.disabled = !!disabled;
        return btn;
    }

    // ── Add Event flow ──

    function showAddEventPicker() {
        hideAddEventPicker();
        const validTypes = getValidEventTypes(events);

        pickerEl = document.createElement('div');
        pickerEl.className = 'add-event-picker';

        const title = document.createElement('div');
        title.className = 'add-event-picker-title';
        title.textContent = t('anim.selectType') || 'Select event type';
        pickerEl.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'add-event-type-grid';

        let selectedType = null;

        const allTypes = ['expand', 'pause', 'transition', 'collapse'];
        const labels = {
            expand: t('anim.expand') || 'Expand',
            pause: t('anim.pause') || 'Pause',
            transition: t('anim.transition') || 'Transition',
            collapse: t('anim.collapse') || 'Collapse',
        };

        const typeButtons = [];

        for (const type of allTypes) {
            const btn = document.createElement('button');
            btn.className = 'add-event-type-option';
            btn.textContent = labels[type];
            btn.disabled = !validTypes.includes(type);
            btn.addEventListener('click', () => {
                selectedType = type;
                typeButtons.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                nextBtn.disabled = false;
            });
            grid.appendChild(btn);
            typeButtons.push(btn);
        }
        pickerEl.appendChild(grid);

        const actions = document.createElement('div');
        actions.className = 'add-event-picker-actions';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', hideAddEventPicker);
        actions.appendChild(cancelBtn);

        const nextBtn = document.createElement('button');
        nextBtn.className = 'primary';
        nextBtn.textContent = 'Next \u2192';
        nextBtn.disabled = true;
        nextBtn.addEventListener('click', async () => {
            if (!selectedType) return;

            if (selectedType === 'expand' || selectedType === 'transition') {
                hideAddEventPicker();
                try {
                    const profile = await openProfilePicker();
                    if (!profile) return; // cancelled
                    addEvent(selectedType, profile);
                } catch { /* picker cancelled */ }
            } else {
                // pause or collapse — no profile needed
                addEvent(selectedType, null);
                hideAddEventPicker();
            }
        });
        actions.appendChild(nextBtn);

        pickerEl.appendChild(actions);
        addBtnEl.insertAdjacentElement('afterend', pickerEl);
    }

    function hideAddEventPicker() {
        if (pickerEl) {
            pickerEl.remove();
            pickerEl = null;
        }
    }

    function addEvent(type, profile) {
        const ev = {
            type,
            duration: DEFAULT_DURATIONS[type],
            easing: DEFAULT_EASINGS[type],
        };

        if (profile) {
            ev.config = profile.controls;
            ev.seed = profile.seed;
            ev.camera = profile.camera || { zoom: 1.0, rotation: 0 };
            ev._displayName = profile.name;
            ev._thumbUrl = profile.thumbUrl || null;
            ev._seedLabel = profile.seedLabel || '';
        }

        events.push(ev);
        selectedIndex = events.length - 1;
        notifyChange();
        onSelect(selectedIndex);
    }

    // ── Init ──

    addBtnEl.addEventListener('click', showAddEventPicker);

    return {
        setEvents(newEvents) {
            events = newEvents;
            renderCards();
        },
        getEvents() {
            return events;
        },
        getSelectedIndex() {
            return selectedIndex;
        },
        setSelectedIndex(i) {
            selectedIndex = i;
            renderCards();
        },
        refresh() {
            renderCards();
        },
    };
}
