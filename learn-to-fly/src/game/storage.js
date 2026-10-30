/*
 * localStorage, one key per value under `learn-to-fly.` (learn-to-fly.cash, learn-to-fly.level.fuel,
 * learn-to-fly.option.music, …), so each one can be read and changed by hand in the browser's dev
 * tools: numbers and true/false as plain text. A value that doesn't read (missing, not a number,
 * not true/false) falls back to its default. Every access is guarded: in private mode or with full
 * storage the game still plays, it just doesn't keep anything.
 */

const PREFIX = 'learn-to-fly.';

function get(key) {
    try {
        return localStorage.getItem(PREFIX + key);
    } catch {
        return null;
    }
}

/** Writes a value as text; null or undefined removes the key. */
export function write(key, value) {
    try {
        if (value === null || value === undefined) {
            localStorage.removeItem(PREFIX + key);
        } else {
            localStorage.setItem(PREFIX + key, String(value));
        }
    } catch {
        // Not kept.
    }
}

export const has = (key) => get(key) !== null;

/** A number, rounded and kept within [min, max]; the fallback when it doesn't read. */
export function readNumber(key, fallback, min = -Infinity, max = Infinity) {
    const text = get(key);
    const n = text === null || text.trim() === '' ? NaN : Number(text);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}

/** true or false (any case); the fallback when it is anything else. */
export function readBool(key, fallback) {
    const text = get(key)?.trim().toLowerCase();
    return text === 'true' ? true : text === 'false' ? false : fallback;
}

// The earlier format kept everything as JSON under two keys; those are no longer read.
try {
    localStorage.removeItem('learn-to-fly-save');
    localStorage.removeItem('learn-to-fly-options');
} catch {
    // Nothing to clean up.
}
