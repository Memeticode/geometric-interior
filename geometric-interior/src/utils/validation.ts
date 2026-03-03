/**
 * Generic schema validation helpers.
 */

export function isObj(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function checkStr(errors: string[], key: string, obj: Record<string, unknown>, maxLen: number): void {
    const v = obj[key];
    if (typeof v !== 'string' || !v.trim()) {
        errors.push(`${key}: required, must be a non-empty string`);
    } else if (v.length > maxLen) {
        errors.push(`${key}: must be at most ${maxLen} characters`);
    }
}

export function checkNum(errors: string[], path: string, obj: Record<string, unknown>, key: string, min: number, max: number): void {
    const v = obj[key];
    if (typeof v !== 'number' || Number.isNaN(v)) {
        errors.push(`${path}.${key}: required, must be a number`);
    } else if (v < min || v > max) {
        errors.push(`${path}.${key}: must be between ${min} and ${max}`);
    }
}
