/*
 * localStorage, one key per value under `learn-to-fly.` (learn-to-fly.cash, learn-to-fly.level.fuel,
 * learn-to-fly.option.music, …; see shared/storage.js), so each one can be read and changed by hand
 * in the browser's dev tools. watch() reports values changed outside the game, so it can show them
 * at once.
 */
export { dropOldKey } from '../../../shared/storage.js';
import { storage } from '../../../shared/storage.js';

export const { write, has, readNumber, readBool, watch } = storage('learn-to-fly.');
