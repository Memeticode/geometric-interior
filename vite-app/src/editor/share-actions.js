/**
 * Share actions — editor-specific wiring on top of the shared share-popover,
 * plus settings-popover toggle and JSON config export.
 */

import { encodeStateToURL } from '../stores/url-state.js';
import { generateTitle } from '@geometric-interior/core/text-generation/title-text.js';
import { xmur3, mulberry32 } from '@geometric-interior/utils/prng.js';
import { profileToConfig } from '@geometric-interior/core/config-schema.js';
import { downloadBlob, toIsoLocalish, safeName } from '../export/export.js';
import { hideTooltip } from '../components/tooltips.js';
import { toast } from '../components/toast.js';
import { t } from '../i18n/locale.js';
import { initSharePopover } from '../components/share-popover.js';

/**
 * @param {object} opts
 * @param {object} opts.el - DOM refs (shareBtn, sharePopover, settingsBtn, settingsPopover, exportBtn, profileNameField)
 * @param {Function} opts.getCurrentSeed
 * @param {Function} opts.readControlsFromUI
 * @param {Function} opts.readCameraFromUI
 * @param {Function} opts.getNodeCount - () => number
 * @param {Function} opts.isStillRendered - () => boolean
 * @param {object} opts.bridge - render bridge (for exportCanvas)
 */
export function initShareActions({ el, getCurrentSeed, readControlsFromUI, readCameraFromUI, getNodeCount, isStillRendered, bridge }) {

    function buildShareURL() {
        return encodeStateToURL(window.location.origin, {
            seed: getCurrentSeed(),
            controls: readControlsFromUI(),
            camera: readCameraFromUI(),
            name: el.profileNameField.value.trim(),
        });
    }

    function generateTitleForShare() {
        const seed = getCurrentSeed();
        const controls = readControlsFromUI();
        const titleRng = mulberry32(xmur3(seed + ':title')());
        return generateTitle(controls, titleRng);
    }

    /* ── Shared share-popover (toggle, dismiss, social buttons) ── */

    const share = initSharePopover({
        shareBtn: el.shareBtn,
        sharePopover: el.sharePopover,
        getShareURL: buildShareURL,
        getShareTitle: () => `${generateTitleForShare()} — Geometric Interior`,
    });

    /* ── Settings popover ── */

    el.settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        hideTooltip();
        el.settingsPopover.classList.toggle('hidden');
        share.close();
    });

    document.addEventListener('click', (e) => {
        if (!el.settingsPopover.contains(e.target) && e.target !== el.settingsBtn) {
            el.settingsPopover.classList.add('hidden');
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!el.settingsPopover.classList.contains('hidden')) {
                el.settingsPopover.classList.add('hidden');
                el.settingsBtn.focus();
            }
        }
    });

    /* ── Export (JSON config) ── */

    el.exportBtn.addEventListener('click', () => {
        if (el.exportBtn.disabled) return;
        if (!isStillRendered()) { toast(t('toast.renderFirst')); return; }

        try {
            const seed = getCurrentSeed();
            const controls = readControlsFromUI();
            const name = el.profileNameField.value.trim() || 'Untitled';
            const camera = readCameraFromUI();
            const config = profileToConfig(name, { seed, controls, camera });
            const json = JSON.stringify(config, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const ts = toIsoLocalish();
            downloadBlob(`geometric-interior_${safeName(seed)}_${ts}.json`, blob);
            toast(t('toast.configExported'));
        } catch (err) {
            console.error(err);
            toast(t('toast.exportFailed'));
        }
    });

    return { close: share.close };
}
