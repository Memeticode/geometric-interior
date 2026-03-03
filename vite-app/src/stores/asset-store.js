/**
 * Persistent asset storage backed by IndexedDB.
 *
 * Image asset store ("assets"):
 *   id:           string          "gen-<timestamp>-<random4>"
 *   name:         string          Auto-generated title
 *   seed:         SeedTag         [number, number, number]
 *   controls:     Controls
 *   thumbDataUrl: string          280×180 data URL
 *   spriteBlob:   Blob            60-frame vertical strip PNG
 *   staticBlob:   Blob            Full-resolution still PNG
 *   meta:         { title, altText, nodeCount, width, height }
 *   createdAt:    number          Date.now()
 *
 * Animation asset store ("animations"):
 *   id:           string          "anim-<timestamp>-<random4>"
 *   name:         string          Auto-generated title
 *   animation:    Animation       Full definition for replay/re-edit
 *   videoBlob:    Blob|null       MP4 video (null if WebCodecs unavailable)
 *   framesBlob:   Blob|null       Fallback: frame data
 *   thumbDataUrl: string          280×180 data URL
 *   meta:         { title, altText, fps, totalFrames, durationS, width, height }
 *   createdAt:    number          Date.now()
 */

const DB_NAME = 'geo-asset-store';
const DB_VERSION = 2;
const STORE_NAME = 'assets';
const ANIM_STORE_NAME = 'animations';

/** @type {IDBDatabase|null} */
let db = null;

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const database = req.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
            if (!database.objectStoreNames.contains(ANIM_STORE_NAME)) {
                database.createObjectStore(ANIM_STORE_NAME, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => {
            db = req.result;
            resolve(db);
        };
        req.onerror = () => reject(req.error);
    });
}

function ensureDB() {
    if (db) return Promise.resolve(db);
    return openDB();
}

/**
 * Generate a unique asset ID.
 * @returns {string}
 */
export function generateAssetId() {
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 6);
    return `gen-${ts}-${rand}`;
}

/**
 * Load all assets, sorted by createdAt descending (newest first).
 * @returns {Promise<Array>}
 */
export async function getAllAssets() {
    try {
        const database = await ensureDB();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.getAll();
            req.onsuccess = () => {
                const assets = req.result || [];
                assets.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                resolve(assets);
            };
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.warn('[asset-store] Failed to load assets:', err);
        return [];
    }
}

/**
 * Get a single asset by ID.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getAsset(id) {
    try {
        const database = await ensureDB();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.warn('[asset-store] Failed to get asset:', err);
        return null;
    }
}

/**
 * Store an asset record.
 * @param {Object} asset - Must include `id` field
 */
export async function putAsset(asset) {
    try {
        const database = await ensureDB();
        const tx = database.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(asset);
    } catch (err) {
        console.warn('[asset-store] Failed to write asset:', err);
    }
}

/**
 * Delete an asset by ID.
 * @param {string} id
 */
export async function deleteAsset(id) {
    try {
        const database = await ensureDB();
        const tx = database.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
    } catch (err) {
        console.warn('[asset-store] Failed to delete asset:', err);
    }
}

/**
 * Get just the sprite blob for an asset (avoids loading full record into memory).
 * Falls back to loading the full record.
 * @param {string} id
 * @returns {Promise<Blob|null>}
 */
export async function getAssetSprite(id) {
    const asset = await getAsset(id);
    return asset ? asset.spriteBlob : null;
}

/* ── Animation assets ── */

/**
 * Generate a unique animation asset ID.
 * @returns {string}
 */
export function generateAnimAssetId() {
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 6);
    return `anim-${ts}-${rand}`;
}

/**
 * Load all animation assets, sorted by createdAt descending.
 * @returns {Promise<Array>}
 */
export async function getAllAnimAssets() {
    try {
        const database = await ensureDB();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(ANIM_STORE_NAME, 'readonly');
            const store = tx.objectStore(ANIM_STORE_NAME);
            const req = store.getAll();
            req.onsuccess = () => {
                const assets = req.result || [];
                assets.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                resolve(assets);
            };
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.warn('[asset-store] Failed to load animation assets:', err);
        return [];
    }
}

/**
 * Get a single animation asset by ID.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getAnimAsset(id) {
    try {
        const database = await ensureDB();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(ANIM_STORE_NAME, 'readonly');
            const store = tx.objectStore(ANIM_STORE_NAME);
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.warn('[asset-store] Failed to get animation asset:', err);
        return null;
    }
}

/**
 * Store an animation asset record.
 * @param {Object} asset - Must include `id` field
 */
export async function putAnimAsset(asset) {
    try {
        const database = await ensureDB();
        const tx = database.transaction(ANIM_STORE_NAME, 'readwrite');
        tx.objectStore(ANIM_STORE_NAME).put(asset);
    } catch (err) {
        console.warn('[asset-store] Failed to write animation asset:', err);
    }
}

/**
 * Delete an animation asset by ID.
 * @param {string} id
 */
export async function deleteAnimAsset(id) {
    try {
        const database = await ensureDB();
        const tx = database.transaction(ANIM_STORE_NAME, 'readwrite');
        tx.objectStore(ANIM_STORE_NAME).delete(id);
    } catch (err) {
        console.warn('[asset-store] Failed to delete animation asset:', err);
    }
}
