/*
 * localStorage for a game, one key per value under the game's prefix (`learn-to-fly.cash`,
 * `twistball.option.palette`, `underlord.save.money`, …), so each value can be read and changed by
 * hand in the browser's dev tools: numbers and true/false as plain text, lists and records as JSON.
 * A value that doesn't read (missing, not a number, not true/false, broken JSON) falls back to its
 * default. Every access is guarded: in private mode or with full storage the game still plays, it
 * just doesn't keep anything.
 *
 * watch() notices values changed outside the game (by hand in the dev tools, or in another tab) and
 * reports them, so the game can show them at once.
 */

/** The storage of one game: every key below is relative to `prefix` (which ends in a dot). */
export function storage(prefix) {
    /** What the game last wrote or saw, per key; a different value in storage was changed elsewhere. */
    const known = new Map();

    function read(key) {
        try {
            return localStorage.getItem(prefix + key);
        } catch {
            return null;
        }
    }

    /**
     * Writes a value as text (objects and arrays as JSON); null or undefined removes the key.
     * Returns whether it was kept.
     */
    function write(key, value) {
        try {
            if (value === null || value === undefined) {
                localStorage.removeItem(prefix + key);
                known.delete(prefix + key);
            } else {
                const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
                localStorage.setItem(prefix + key, text);
                known.set(prefix + key, text);
            }
            return true;
        } catch {
            return false;
        }
    }

    /** A number; the fallback when it doesn't read. */
    function readFloat(key, fallback, min = -Infinity, max = Infinity) {
        const text = read(key);
        const n = text === null || text.trim() === '' ? NaN : Number(text);
        return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    }

    /** All of the game's keys and their values, as stored now. */
    function snapshot() {
        const now = new Map();
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith(prefix)) {
                    now.set(key, localStorage.getItem(key));
                }
            }
        } catch {
            // Nothing stored.
        }
        return now;
    }

    return {
        read,
        write,
        readFloat,
        has: (key) => read(key) !== null,

        /** A whole number, rounded and kept within [min, max]; the fallback when it doesn't read. */
        readNumber(key, fallback, min = -Infinity, max = Infinity) {
            const n = readFloat(key, NaN);
            return Number.isNaN(n) ? fallback : Math.min(max, Math.max(min, Math.round(n)));
        },

        /** true or false (any case); the fallback when it is anything else. */
        readBool(key, fallback) {
            const text = read(key)?.trim().toLowerCase();
            return text === 'true' ? true : text === 'false' ? false : fallback;
        },

        /** Parsed JSON; the fallback when it is missing or doesn't parse. */
        readJson(key, fallback) {
            const text = read(key);
            if (text === null) {
                return fallback;
            }
            try {
                return JSON.parse(text);
            } catch {
                return fallback;
            }
        },

        /** The stored keys that start with `start`, without the prefix. */
        keys(start = '') {
            return [...snapshot().keys()].map((key) => key.slice(prefix.length)).filter((key) => key.startsWith(start));
        },

        /**
         * Calls onChange(keys) with the keys (without the prefix) whose values changed outside the
         * game: checked twice a second (the dev tools don't tell the page) and on other tabs'
         * storage events.
         */
        watch(onChange) {
            for (const [key, value] of snapshot()) {
                known.set(key, value);
            }
            const check = () => {
                const now = snapshot();
                const changed = [];
                for (const key of new Set([...now.keys(), ...known.keys()])) {
                    if (now.get(key) !== known.get(key)) {
                        changed.push(key.slice(prefix.length));
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
        },
    };
}

/** Removes keys of an earlier format; with `convert`, first passes the old value to it. */
export function dropOldKey(key, convert) {
    try {
        const text = localStorage.getItem(key);
        if (text === null) {
            return;
        }
        if (convert) {
            try {
                convert(text);
            } catch {
                // Not convertible: it is dropped all the same.
            }
        }
        localStorage.removeItem(key);
    } catch {
        // Nothing to clean up.
    }
}
