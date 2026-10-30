/*
 * localStorage, one key per value under `twistball.` (see shared/storage.js), so each one can be read
 * and changed by hand in the browser's dev tools; watch() reports values changed outside the game.
 *   option.palette, option.startLevel, option.cpu   the title screen's choices
 *   name                                            the name last entered for a high score
 *   highscore.<place>.<name|score|level|from|date>  the high score list (highscores.js)
 */
import { dropOldKey, storage } from '../../../shared/storage.js';

export const store = storage('twistball.');

// The earlier format: twistball-<name> keys, the high scores as one JSON list.
for (const [old, key] of [['twistball-palette', 'option.palette'], ['twistball-start-level', 'option.startLevel'], ['twistball-cpu', 'option.cpu'], ['twistball-name', 'name']]) {
    dropOldKey(old, (text) => store.write(key, text));
}
dropOldKey('twistball-highscores', (text) => {
    JSON.parse(text).forEach((entry, index) => {
        for (const field of ['name', 'score', 'level', 'from', 'date']) {
            store.write(`highscore.${index + 1}.${field}`, entry[field]);
        }
    });
});
