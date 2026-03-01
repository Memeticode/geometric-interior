/**
 * Share actions — share URL builder, popover toggle, social share buttons,
 * and visual export (ZIP download).
 */

import { encodeStateToURL } from '../core/url-state.js';
import { packageStillZip, packageStillZipFromBlob } from '../export/export.js';
import { generateTitle, generateAltText } from '../../lib/core/text.js';
import { xmur3, mulberry32 } from '../../lib/core/prng.js';
import { profileToConfig } from '../../lib/core/config-schema.js';
import { downloadBlob, toIsoLocalish, safeName } from '../export/export.js';
import { hideTooltip } from '../shared/tooltips.js';
import { toast } from '../shared/toast.js';
import { t } from '../i18n/locale.js';

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

    /* ── Toggle popovers ── */

    el.shareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        hideTooltip();
        el.sharePopover.classList.toggle('hidden');
        el.settingsPopover.classList.add('hidden');
    });

    el.settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        hideTooltip();
        el.settingsPopover.classList.toggle('hidden');
        el.sharePopover.classList.add('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!el.sharePopover.contains(e.target) && e.target !== el.shareBtn) {
            el.sharePopover.classList.add('hidden');
        }
        if (!el.settingsPopover.contains(e.target) && e.target !== el.settingsBtn) {
            el.settingsPopover.classList.add('hidden');
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!el.sharePopover.classList.contains('hidden')) {
                el.sharePopover.classList.add('hidden');
                el.shareBtn.focus();
            }
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

    /* ── Copy link ── */

    document.getElementById('shareCopyLink').addEventListener('click', async () => {
        const shareURL = buildShareURL();
        try {
            await navigator.clipboard.writeText(shareURL);
            toast(t('toast.linkCopied'));
        } catch {
            const ta = document.createElement('textarea');
            ta.value = shareURL;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            toast(t('toast.linkCopiedShort'));
        }
        el.sharePopover.classList.add('hidden');
    });

    /* ── Download visual (ZIP) ── */

    document.getElementById('shareDownloadPng').addEventListener('click', async () => {
        if (!isStillRendered()) { toast(t('toast.renderFirst')); return; }
        if (!window.JSZip) { toast(t('toast.jszipMissing')); return; }
        el.sharePopover.classList.add('hidden');

        const seed = getCurrentSeed();
        const controls = readControlsFromUI();
        const name = el.profileNameField.value.trim() || 'Untitled';
        const titleRng = mulberry32(xmur3(seed + ':title')());
        const title = generateTitle(controls, titleRng);
        const altText = generateAltText(controls, getNodeCount(), title);
        const meta = { title, altText, nodeCount: getNodeCount() };

        try {
            if (bridge.isWorker()) {
                const blob = await bridge.exportCanvas();
                const canvas = bridge.getCanvas();
                const rect = canvas.getBoundingClientRect();
                await packageStillZipFromBlob(blob, {
                    seed, controls, name, meta,
                    canvasWidth: Math.round(rect.width * window.devicePixelRatio),
                    canvasHeight: Math.round(rect.height * window.devicePixelRatio),
                });
            } else {
                await packageStillZip(bridge.getCanvas(), { seed, controls, name, meta });
            }
            toast(t('toast.visualExported'));
        } catch (err) {
            console.error(err);
            toast(t('toast.visualExportFailed'));
        }
    });

    /* ── Social share buttons ── */

    function openShare(urlFn) {
        const shareURL = buildShareURL();
        urlFn(shareURL);
        el.sharePopover.classList.add('hidden');
    }

    document.getElementById('shareTwitter').addEventListener('click', () => {
        openShare((url) => {
            const title = generateTitleForShare();
            const text = `${title} — Geometric Interior`;
            window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank', 'noopener,width=550,height=420');
        });
    });

    document.getElementById('shareFacebook').addEventListener('click', () => {
        openShare((url) => {
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'noopener,width=555,height=525');
        });
    });

    document.getElementById('shareBluesky').addEventListener('click', () => {
        openShare((url) => {
            const title = generateTitleForShare();
            const text = `${title} — Geometric Interior\n${url}`;
            window.open(`https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`, '_blank', 'noopener,width=600,height=500');
        });
    });

    document.getElementById('shareReddit').addEventListener('click', () => {
        openShare((url) => {
            const title = generateTitleForShare();
            window.open(`https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(`${title} — Geometric Interior`)}`, '_blank', 'noopener,width=700,height=600');
        });
    });

    document.getElementById('shareLinkedIn').addEventListener('click', () => {
        openShare((url) => {
            window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank', 'noopener,width=600,height=550');
        });
    });

    document.getElementById('shareEmail').addEventListener('click', () => {
        openShare((url) => {
            const title = generateTitleForShare();
            const subject = `${title} — Geometric Interior`;
            const body = `Check out this generative artwork:\n\n${url}`;
            window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
        });
    });
}
