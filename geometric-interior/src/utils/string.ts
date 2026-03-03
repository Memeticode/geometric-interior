/**
 * String and text utilities.
 */

export function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Replace {Color} and {color} placeholders in a template string. */
export function injectColor(template: string, color: string): string {
    return template
        .replace(/\{Color\}/g, capitalize(color))
        .replace(/\{color\}/g, color);
}

/** Bucket a [0,1] value into 'high' / 'mid' / 'low'. */
export function tier(value: number): string {
    if (value > 0.66) return 'high';
    if (value > 0.33) return 'mid';
    return 'low';
}
