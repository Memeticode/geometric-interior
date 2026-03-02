/**
 * Persistent thumbnail cache backed by IndexedDB.
 * Stores data-URL strings keyed by the same thumbCacheKey used in main.js.
 */

const DB_NAME = 'geo-thumb-cache';
const DB_VERSION = 1;
const STORE_NAME = 'thumbs';

/** @type {IDBDatabase|null} */
let db = null;

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const database = req.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME);
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
 * Load all cached thumbnails into a Map.
 * Called once at startup to pre-populate the in-memory cache.
 * @returns {Promise<Map<string, string>>}
 */
export async function getAllThumbs() {
    const map = new Map();
    try {
        const database = await ensureDB();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.openCursor();
            req.onsuccess = () => {
                const cursor = req.result;
                if (cursor) {
                    map.set(cursor.key, cursor.value);
                    cursor.continue();
                } else {
                    resolve(map);
                }
            };
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.warn('[thumb-cache] Failed to load from IndexedDB:', err);
        return map;
    }
}

/**
 * Store a single thumbnail data URL.
 * @param {string} key - thumbCacheKey
 * @param {string} dataUrl - data:image/png;base64,...
 */
export async function putThumb(key, dataUrl) {
    try {
        const database = await ensureDB();
        const tx = database.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(dataUrl, key);
    } catch (err) {
        console.warn('[thumb-cache] Failed to write:', err);
    }
}

/**
 * Delete a single thumbnail by its cache key.
 * @param {string} key - thumbCacheKey
 */
export async function deleteThumb(key) {
    try {
        const database = await ensureDB();
        const tx = database.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(key);
    } catch (err) {
        console.warn('[thumb-cache] Failed to delete:', err);
    }
}
