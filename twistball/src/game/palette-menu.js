/**
 * The colour palettes (config/palettes.js): the choice on the title screen, remembered in this browser,
 * applied to the renderer and to the page's CSS colours.
 */
import { $, PALETTES, renderer } from './context.js';

function applyPalette(key) {
    const palette = PALETTES[key] ?? Object.values(PALETTES)[0];
    renderer.setPalette(palette);
    for (const [name, value] of Object.entries(palette.ui)) {
        document.documentElement.style.setProperty(`--${name}`, value);
    }
    try {
        localStorage.setItem('twistball-palette', key);
    } catch {
        // Not remembering the palette is fine.
    }
}

/** One choice in the palette list: a radio button with the palette's name and swatches of its colours. */
function paletteOption(key, palette, checked) {
    const label = document.createElement('label');
    label.className = 'palette-option';
    const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'palette', value: key, checked });
    input.addEventListener('change', () => applyPalette(key));
    const swatches = document.createElement('span');
    swatches.className = 'swatches';
    swatches.setAttribute('aria-hidden', 'true');
    for (const [title, color] of [['You', palette.near.edge], ['Opponent', palette.far.edge], ['Ball', palette.ball[1]], ['Tunnel', palette.walls[2]]]) {
        const swatch = document.createElement('i');
        swatch.style.background = color;
        swatch.title = title;
        swatches.append(swatch);
    }
    const name = Object.assign(document.createElement('span'), { className: 'palette-name', textContent: palette.name });
    label.append(input, swatches, name);

    return label;
}

/** Fills the palette list and applies the remembered palette (else the first). */
export function initPalettes() {
    let saved = null;
    try {
        saved = localStorage.getItem('twistball-palette');
    } catch {
        // Use the first palette.
    }
    const chosen = PALETTES[saved] ? saved : Object.keys(PALETTES)[0];
    $('palette').replaceChildren(...Object.entries(PALETTES).map(([key, palette]) => paletteOption(key, palette, key === chosen)));
    applyPalette(chosen);
}
