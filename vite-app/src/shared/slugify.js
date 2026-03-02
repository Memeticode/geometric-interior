/**
 * Convert a profile name to a URL-safe slug.
 * Uses underscores as word separators; hyphens in names are preserved.
 * @param {string} name
 * @returns {string}
 */
export function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9-]+/g, '_').replace(/^_|_$/g, '');
}

/**
 * Validate that a profile name is acceptable.
 * Disallows underscores (reserved as slug separator).
 * @param {string} name
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateProfileName(name) {
    if (!name || !name.trim()) return { valid: false, reason: 'Name is required.' };
    if (name.includes('_')) return { valid: false, reason: 'Underscores are not allowed in profile names.' };
    return { valid: true };
}
