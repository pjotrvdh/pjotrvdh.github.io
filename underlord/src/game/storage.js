/*
 * localStorage, one key per value under `underlord.` (see shared/storage.js), so each one can be read
 * and changed by hand in the browser's dev tools; watch() reports values changed outside the game.
 *   option.sound, option.tab   sound on (true/false) and the last panel tab
 *   save.*                     the saved game (save.js)
 */
import { dropOldKey, storage } from '../../../shared/storage.js';

export const store = storage('underlord.');

// The earlier format: underlord-<name> keys (the old save is converted in save.js).
dropOldKey('underlord-sound', (text) => store.write('option.sound', text !== 'off'));
dropOldKey('underlord-tab', (text) => store.write('option.tab', text));
