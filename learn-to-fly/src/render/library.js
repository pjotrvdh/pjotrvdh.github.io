import data from '../assets/library.json';

/*
 * The assets exported from the original SWF by tools/import-swf.mjs: characters (shapes, morph shapes,
 * fonts, texts, buttons, sprites, bitmaps, sounds) by id, the root timeline and the export names
 * scripts use with attachMovie() and attachSound(). Bitmaps and sounds are separate files, inlined
 * into the page by the build.
 */

const bitmapUrls = import.meta.glob('../assets/bitmaps/*', { eager: true, query: '?url', import: 'default' });
const soundUrls = import.meta.glob('../assets/sounds/*', { eager: true, query: '?url', import: 'default' });

export const library = data;
export const { stage: STAGE, exports: EXPORTS, chars: CHARS } = data;

/** The character with this id, or undefined. */
export const char = (id) => CHARS[id];

/** URL of a sound file (see `file` on sound characters and timeline streams). */
export const soundUrl = (file) => soundUrls[`../assets/sounds/${file}`];

/** Decoded bitmaps by character id: a canvas (JPEGs with an alpha mask are combined here). */
export const bitmaps = new Map();

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}

/** Loads every bitmap; call once before drawing. */
export async function loadBitmaps() {
    const jobs = Object.entries(CHARS).filter(([, c]) => c.t === 'bitmap').map(async ([id, c]) => {
        const img = await loadImage(bitmapUrls[`../assets/bitmaps/${c.file}`]);
        if (!c.alpha) {
            bitmaps.set(Number(id), img);
            return;
        }
        const mask = await loadImage(bitmapUrls[`../assets/bitmaps/${c.alpha}`]);
        const canvas = document.createElement('canvas');
        canvas.width = c.w;
        canvas.height = c.h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(mask, 0, 0);
        const alpha = ctx.getImageData(0, 0, c.w, c.h);
        ctx.drawImage(img, 0, 0);
        const pixels = ctx.getImageData(0, 0, c.w, c.h);
        for (let i = 0; i < pixels.data.length; i += 4) {
            pixels.data[i + 3] = alpha.data[i];
        }
        ctx.putImageData(pixels, 0, 0);
        bitmaps.set(Number(id), canvas);
    });
    await Promise.all(jobs);
}
