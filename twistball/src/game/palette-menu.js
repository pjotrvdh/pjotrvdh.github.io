/**
 * The colour palettes (config/palettes.js): the choice on the title screen, remembered in this browser,
 * applied to the renderer and to the page's CSS colours.
 */
import { $, PALETTES, renderer } from './context.js';
import { store } from './storage.js';

function applyPalette(key) {
    const palette = PALETTES[key] ?? Object.values(PALETTES)[0];
    renderer.setPalette(palette);
    for (const [name, value] of Object.entries(palette.ui)) {
        document.documentElement.style.setProperty(`--${name}`, value);
    }
    store.write('option.palette', key);
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

const remembered = () => {
    const saved = store.read('option.palette');

    return PALETTES[saved] ? saved : Object.keys(PALETTES)[0];
};

/** Fills the palette list and applies the remembered palette (else the first). */
export function initPalettes() {
    const chosen = remembered();
    $('palette').replaceChildren(...Object.entries(PALETTES).map(([key, palette]) => paletteOption(key, palette, key === chosen)));
    applyPalette(chosen);
}

/** Applies the remembered palette again, after it was changed in localStorage. */
export function reloadPalette() {
    const chosen = remembered();
    for (const input of document.querySelectorAll('input[name="palette"]')) {
        input.checked = input.value === chosen;
    }
    applyPalette(chosen);
}
