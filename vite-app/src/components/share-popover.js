/**
 * Shared share-popover behaviour — toggle, close, click-outside, escape,
 * copy-link, and social-share button wiring.
 *
 * Each page supplies its own getShareURL / getShareTitle callbacks.
 *
 * @param {object} opts
 * @param {HTMLElement} opts.shareBtn
 * @param {HTMLElement} opts.sharePopover
 * @param {() => string} opts.getShareURL
 * @param {() => string} opts.getShareTitle
 * @returns {{ close: () => void }}
 */

import { refreshTooltip } from './tooltips.js';
import { toast } from './toast.js';
import { t } from '../i18n/locale.js';

export function initSharePopover({ shareBtn, sharePopover, getShareURL, getShareTitle }) {

    function close() {
        sharePopover.classList.add('hidden');
        shareBtn.classList.remove('share-open');
        shareBtn.setAttribute('data-tooltip', 'Open share');
        refreshTooltip(shareBtn);
    }

    /* ── Toggle ── */

    shareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sharePopover.classList.toggle('hidden');
        const open = !sharePopover.classList.contains('hidden');
        shareBtn.classList.toggle('share-open', open);
        shareBtn.setAttribute('data-tooltip', open ? 'Close share' : 'Open share');
        refreshTooltip(shareBtn);
    });

    /* ── Dismiss ── */

    document.addEventListener('click', (e) => {
        if (!sharePopover.contains(e.target) && e.target !== shareBtn) {
            close();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !sharePopover.classList.contains('hidden')) {
            close();
            shareBtn.focus();
        }
    });

    /* ── Copy link ── */

    document.getElementById('shareCopyLink').addEventListener('click', async () => {
        const url = getShareURL();
        try {
            await navigator.clipboard.writeText(url);
            toast(t('toast.linkCopied') || 'Link copied');
        } catch {
            const ta = document.createElement('textarea');
            ta.value = url;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            toast(t('toast.linkCopiedShort') || 'Copied');
        }
        close();
    });

    /* ── Social share buttons ── */

    function openShare(urlFn) {
        urlFn(getShareURL());
        close();
    }

    document.getElementById('shareTwitter').addEventListener('click', () => {
        openShare((url) => {
            const text = getShareTitle();
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
            const text = `${getShareTitle()}\n${url}`;
            window.open(`https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`, '_blank', 'noopener,width=600,height=500');
        });
    });

    document.getElementById('shareReddit').addEventListener('click', () => {
        openShare((url) => {
            window.open(`https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(getShareTitle())}`, '_blank', 'noopener,width=700,height=600');
        });
    });

    document.getElementById('shareGoogle').addEventListener('click', () => {
        openShare((url) => {
            window.open(`https://plus.google.com/share?url=${encodeURIComponent(url)}`, '_blank', 'noopener,width=600,height=500');
        });
    });

    document.getElementById('shareLinkedIn').addEventListener('click', () => {
        openShare((url) => {
            window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank', 'noopener,width=600,height=550');
        });
    });

    document.getElementById('shareEmail').addEventListener('click', () => {
        openShare((url) => {
            const title = getShareTitle();
            const body = `Check out this generative artwork:\n\n${url}`;
            window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`);
        });
    });

    return { close };
}
