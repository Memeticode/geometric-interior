/**
 * Persists the display order of generated images in localStorage.
 * The order here matches the carousel gallery's "Generated" section.
 */

const STORAGE_KEY = 'geo-generated-order';

/**
 * Load the saved order of generated asset IDs.
 * @returns {string[]}
 */
export function loadGeneratedOrder() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/**
 * Save the order of generated asset IDs.
 * @param {string[]} ids
 */
export function saveGeneratedOrder(ids) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch { /* quota exceeded — silently ignore */ }
}

/**
 * Reconcile stored order with actual assets.
 * Assets not in the stored order are appended at the end (newest first).
 * Stored IDs that no longer exist are removed.
 * @param {Array<{id: string}>} assets — all assets from IndexedDB
 * @returns {Array<{id: string}>} — assets in display order
 */
export function syncGeneratedOrder(assets) {
    const storedOrder = loadGeneratedOrder();
    const assetMap = new Map(assets.map(a => [a.id, a]));

    // Start with stored order, keeping only existing assets
    const ordered = [];
    const seen = new Set();
    for (const id of storedOrder) {
        const asset = assetMap.get(id);
        if (asset) {
            ordered.push(asset);
            seen.add(id);
        }
    }

    // Append any new assets not in stored order (newest first — already sorted by getAllAssets)
    for (const asset of assets) {
        if (!seen.has(asset.id)) {
            ordered.push(asset);
        }
    }

    // Persist the reconciled order
    saveGeneratedOrder(ordered.map(a => a.id));

    return ordered;
}
