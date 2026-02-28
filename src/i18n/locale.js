/**
 * Core localization module.
 *
 * Provides locale detection, string resolution, and DOM patching.
 * No external dependencies — pure vanilla JS.
 *
 * Usage:
 *   import { initLocale, t, getLocale, setLocale } from '../i18n/locale.js';
 *   initLocale();            // detect + apply locale on page load
 *   t('toast.enterName')     // resolve a key
 *   setLocale('es')          // switch locale at runtime
 */

import en from './messages/en.js';
import es from './messages/es.js';

const LS_KEY = 'geo-self-portrait-locale';
const SUPPORTED = ['en', 'es'];
const DEFAULT_LOCALE = 'en';

const CATALOGS = { en, es };

/** @type {{ locale: string, messages: Record<string, string> } | null} */
let ctx = null;

/* ── Helpers ── */

function bestMatch(candidates) {
    for (const tag of candidates) {
        const lang = tag.split('-')[0].toLowerCase();
        if (SUPPORTED.includes(lang)) return lang;
    }
    return null;
}

/* ── Public API ── */

/**
 * Detect the preferred locale.
 * 1. localStorage override
 * 2. navigator.languages / navigator.language
 * 3. default
 */
export function detectLocale() {
    try {
        const stored = localStorage.getItem(LS_KEY);
        if (stored && SUPPORTED.includes(stored)) return stored;
    } catch { /* private browsing */ }

    const navLangs = navigator.languages || [navigator.language || ''];
    return bestMatch(navLangs) || DEFAULT_LOCALE;
}

/**
 * Create an immutable locale context.
 */
function createContext(locale) {
    return Object.freeze({
        locale,
        messages: CATALOGS[locale] || CATALOGS[DEFAULT_LOCALE],
    });
}

/**
 * Translate a message key.
 * Supports simple {param} interpolation.
 *
 * @param {string} key  Dot-path key, e.g. 'toast.enterName'
 * @param {Record<string, string|number>} [params]
 * @returns {string}
 */
export function t(key, params) {
    const msg = ctx?.messages[key];
    if (msg == null) return key; // fallback: show key (dev aid)
    if (!params) return msg;
    return msg.replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? String(params[k]) : `{${k}}`));
}

/**
 * Get the current locale code.
 * @returns {string}
 */
export function getLocale() {
    return ctx?.locale || DEFAULT_LOCALE;
}

/**
 * Get the list of supported locale codes.
 * @returns {string[]}
 */
export function getSupportedLocales() {
    return SUPPORTED.slice();
}

/**
 * Walk the DOM and patch all data-i18n* elements with resolved strings.
 */
export function applyLocaleToDOM() {
    const root = document.documentElement;
    root.lang = ctx.locale;

    // Patch textContent via data-i18n
    root.querySelectorAll('[data-i18n]').forEach(el => {
        const resolved = t(el.dataset.i18n);
        // Preserve child elements (e.g. <span class="info-icon">)
        const first = el.firstChild;
        if (first && first.nodeType === Node.TEXT_NODE) {
            first.textContent = resolved;
        } else if (first) {
            el.insertBefore(document.createTextNode(resolved), first);
        } else {
            el.textContent = resolved;
        }
    });

    // Patch data-tooltip
    root.querySelectorAll('[data-i18n-tooltip]').forEach(el => {
        el.setAttribute('data-tooltip', t(el.dataset.i18nTooltip));
    });

    // Patch data-label
    root.querySelectorAll('[data-i18n-label]').forEach(el => {
        el.setAttribute('data-label', t(el.dataset.i18nLabel));
    });

    // Patch placeholder
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.dataset.i18nPlaceholder);
    });

    // Patch aria-label
    root.querySelectorAll('[data-i18n-aria]').forEach(el => {
        el.setAttribute('aria-label', t(el.dataset.i18nAria));
    });
}

/**
 * Switch locale at runtime.
 * Updates context, persists preference, patches DOM, dispatches event.
 *
 * @param {string} locale
 */
export function setLocale(locale) {
    if (!SUPPORTED.includes(locale)) locale = DEFAULT_LOCALE;
    ctx = createContext(locale);
    try { localStorage.setItem(LS_KEY, locale); } catch { /* */ }
    applyLocaleToDOM();
    document.dispatchEvent(new CustomEvent('localechange', { detail: { locale } }));
}

/**
 * Initialize locale on page load.
 * Detects preferred locale, creates context, patches DOM.
 * Call once after DOMContentLoaded.
 */
export function initLocale() {
    const locale = detectLocale();
    ctx = createContext(locale);
    applyLocaleToDOM();
}
