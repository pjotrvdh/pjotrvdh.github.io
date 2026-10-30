/*
 * localStorage, one key per value under `learn-to-fly.` (learn-to-fly.cash, learn-to-fly.level.fuel,
 * learn-to-fly.option.music, …), so each one can be read and changed by hand in the browser's dev
 * tools: numbers and true/false as plain text. A value that doesn't read (missing, not a number,
 * not true/false) falls back to its default. Every access is guarded: in private mode or with full
 * storage the game still plays, it just doesn't keep anything.
 *
 * watch() notices values changed outside the game (by hand in the dev tools, or in another tab) and
 * reports them, so the game can show them at once.
 */

const PREFIX = 'learn-to-fly.';
/** What the game last wrote or saw, per key; a different value in storage was changed elsewhere. */
const known = new Map();

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
            known.delete(PREFIX + key);
        } else {
            localStorage.setItem(PREFIX + key, String(value));
            known.set(PREFIX + key, String(value));
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

/** All of the game's keys and their values, as stored now. */
function snapshot() {
    const now = new Map();
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(PREFIX)) {
                now.set(key, localStorage.getItem(key));
            }
        }
    } catch {
        // Nothing to watch.
    }
    return now;
}

/**
 * Calls onChange(keys) with the keys (without the prefix) whose values changed outside the game:
 * checked twice a second (the dev tools don't tell the page) and on other tabs' storage events.
 */
export function watch(onChange) {
    for (const [key, value] of snapshot()) {
        known.set(key, value);
    }
    const check = () => {
        const now = snapshot();
        const changed = [];
        for (const key of new Set([...now.keys(), ...known.keys()])) {
            if (now.get(key) !== known.get(key)) {
                changed.push(key.slice(PREFIX.length));
                if (now.has(key)) {
                    known.set(key, now.get(key));
                } else {
                    known.delete(key);
                }
            }
        }
        if (changed.length) {
            onChange(changed);
        }
    };
    setInterval(check, 500);
    window.addEventListener('storage', check);
}

// The earlier format kept everything as JSON under two keys; those are no longer read.
try {
    localStorage.removeItem('learn-to-fly-save');
    localStorage.removeItem('learn-to-fly-options');
} catch {
    // Nothing to clean up.
}
