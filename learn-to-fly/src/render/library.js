import data from '../assets/library.json';

/*
 * The assets exported from the original SWF by tools/import-swf.mjs: characters (shapes, morph shapes,
 * fonts, texts, buttons, sprites, sounds) by id, the root timeline and the export names scripts use
 * with attachMovie() and attachSound(). Sounds are separate files, inlined into the page by the build.
 * There are no bitmaps: everything is vector (see the import tool).
 */

const soundUrls = import.meta.glob('../assets/sounds/*', { eager: true, query: '?url', import: 'default' });

export const library = data;
export const { stage: STAGE, exports: EXPORTS, chars: CHARS } = data;

/** The character with this id, or undefined. */
export const char = (id) => CHARS[id];

/** URL of a sound file (see `file` on sound characters and timeline streams). */
export const soundUrl = (file) => soundUrls[`../assets/sounds/${file}`];
