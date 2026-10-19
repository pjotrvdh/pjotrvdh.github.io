/**
 * The high score list, kept in this browser (localStorage). There is no server, so every browser
 * has its own list.
 */
const KEY = 'twistball-highscores';

/** @returns {{name: string, score: number, level: number, date: string}[]} best first */
export function loadHighScores() {
    try {
        const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');

        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
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
    try {
        localStorage.setItem(KEY, JSON.stringify(kept));
    } catch {
        // Private browsing or full storage: the list just does not persist.
    }

    return kept.indexOf(entry);
}
