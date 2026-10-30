/**
 * The high score list, kept in this browser (localStorage, `twistball.highscore.<place>.<field>`).
 * There is no server, so every browser has its own list.
 */
import { store } from './storage.js';

const FIELDS = ['name', 'score', 'level', 'from', 'date'];

/** @returns {{name: string, score: number, level: number, from: number, date: string}[]} best first */
export function loadHighScores() {
    const places = new Set(store.keys('highscore.').map((key) => key.split('.')[1]));
    const list = [];
    for (const place of places) {
        const at = (field) => `highscore.${place}.${field}`;
        const score = store.readNumber(at('score'), 0, 0);
        if (score > 0) {
            const level = store.readNumber(at('level'), 1, 1);
            list.push({ name: store.read(at('name')) ?? 'Anonymous', score, level, from: store.readNumber(at('from'), 1, 1, level), date: store.read(at('date')) ?? '' });
        }
    }

    return list.sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));
}

/** Whether a score makes it onto a list of at most `size` entries. */
export function qualifies(score, size) {
    if (score <= 0) {
        return false;
    }
    const list = loadHighScores();

    return list.length < size || score > list[list.length - 1].score;
}

/** Adds a score and returns its place (0 = first), or -1 when it did not make the list. */
export function addHighScore(entry, size) {
    const list = loadHighScores();
    list.push(entry);
    list.sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));
    const kept = list.slice(0, size);
    for (const key of store.keys('highscore.')) {
        store.write(key, null);
    }
    kept.forEach((item, index) => {
        for (const field of FIELDS) {
            store.write(`highscore.${index + 1}.${field}`, item[field]);
        }
    });

    return kept.indexOf(entry);
}
