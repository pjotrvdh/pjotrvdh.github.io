/*
 * Building blocks for the HTML screens over the canvas (shop, ramp menu, tutorial boards,
 * achievements, end screen, clear data): element creation, one screen at a time, and the chalk
 * drawings (inline SVG) they use. Styles: src/styles/screens.css.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** h('div', {class: 'x', onclick: fn}, child, 'text', …): an element. */
export function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === null || v === false) {
            continue;
        }
        if (k.startsWith('on')) {
            el.addEventListener(k.slice(2), v);
        } else if (k === 'class') {
            el.className = v;
        } else {
            el.setAttribute(k, v === true ? '' : v);
        }
    }
    el.append(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
    return el;
}

/** An inline SVG drawing from path data and shapes, in a 100 × 100 box unless `viewBox` says otherwise. */
export function sketch(markup, viewBox = '0 0 100 100', label = null) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('class', 'sketch');
    if (label) {
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', label);
    } else {
        svg.setAttribute('aria-hidden', 'true');
    }
    svg.innerHTML = markup;
    return svg;
}

/** Chalk drawings (strokes in currentColor; `.fill` parts are filled). */
export const DRAWINGS = {
    // Gliders: a torn paper delta, a hang glider, a sail plane.
    glider1: '<path d="M50 8 L86 88 L64 84 L58 92 L52 80 L44 90 L40 82 L14 88 Z"/><path d="M50 8 L50 86"/><path d="M30 60 l6 -4 M70 52 l-5 6"/>',
    glider2: '<path d="M50 8 L90 86 L10 86 Z"/><path d="M50 8 L44 86 M50 8 L56 86 M30 50 L70 50"/>',
    glider3: '<path d="M44 10 L56 10 L56 30 L72 30 L50 8"/><path d="M44 30 L28 30 L50 8"/><path d="M46 30 L46 70 L10 76 L10 88 L90 88 L90 76 L54 70 L54 30"/><path d="M50 30 L50 88"/>',
    // Rockets: a plain one, a double one, a big one.
    rocket1: '<path d="M78 14 L86 22 L36 72 L28 64 Z"/><path d="M36 72 L30 88 L24 70 M28 64 L12 70 L30 76"/>',
    rocket2: '<path d="M70 12 L82 10 L80 22 L36 66 L26 56 Z"/><path d="M62 20 L74 32 M54 28 L66 40"/><path d="M36 66 L32 86 L22 70 M26 56 L8 60 L24 72"/><path d="M28 80 l-8 8 M20 74 l-8 8"/>',
    rocket3: '<path d="M66 10 L90 10 L90 34 L44 80 L20 56 Z"/><path d="M44 80 L38 94 L30 74 M20 56 L6 62 L26 70"/><path d="M30 66 l-10 10 M36 72 l-10 10"/><path d="M58 30 l12 12"/>',
    // The ramp and the jump (tutorial board).
    ramp: '<path d="M8 20 Q10 78 50 80 Q74 80 86 58"/><path d="M8 20 L8 92 L92 92 L92 62"/><path d="M80 52 l10 4 l-4 10"/>',
    // The arrow keys.
    arrows: '<rect x="4" y="22" width="42" height="40" rx="7"/><rect x="54" y="22" width="42" height="40" rx="7"/><path d="M34 42 L16 42 M24 34 L16 42 L24 50"/><path d="M66 42 L84 42 M76 34 L84 42 L76 50"/>',
    // A penguin tilting (tutorial board).
    tilt: '<ellipse cx="50" cy="50" rx="26" ry="20"/><circle cx="62" cy="44" r="2.5" class="fill"/><path d="M74 50 l8 2 l-8 3"/><path d="M28 18 Q50 6 72 18 M66 12 l6 6 l-8 2"/><path d="M28 82 Q50 94 72 82 M34 88 l-6 -6 l8 -2"/>',
    // Bouncing off the water (tutorial board).
    bounce: '<path d="M6 70 Q20 64 34 70 T62 70 T94 70"/><path d="M14 20 Q34 66 46 66 Q60 66 80 28"/><path d="M72 30 l8 -2 l1 8"/><path d="M40 58 l-6 -6 M46 56 l0 -8 M52 58 l6 -6"/>',
    // The space bar.
    space: '<rect x="6" y="34" width="88" height="26" rx="6"/><text x="50" y="52" text-anchor="middle" class="label">Space</text>',
    // The red zone of the speed meter (tutorial board).
    redzone: '<path d="M14 84 A46 46 0 0 1 86 40" class="dim"/><path d="M86 40 A46 46 0 0 1 94 62" class="warn"/><path d="M50 84 L76 46"/><circle cx="50" cy="84" r="4" class="fill"/>',
    wow: '<path d="M30 30 L40 12 L48 28 L62 10 L66 30 L86 22 L76 42 L94 50 L74 58 L84 78 L62 70 L56 90 L46 72 L28 86 L30 64 L8 62 L26 48 L10 32 Z"/><circle cx="44" cy="46" r="2" class="fill"/><circle cx="56" cy="46" r="2" class="fill"/><path d="M42 56 Q50 62 58 56"/>',
    // Achievements: distance, altitude, speed, duration.
    distance: '<path d="M8 74 Q50 10 92 74"/><path d="M80 66 l12 8 l-2 -14"/><path d="M8 86 L92 86"/>',
    altitude: '<path d="M50 90 L50 12 M38 26 L50 12 L62 26"/><path d="M20 90 L80 90"/>',
    speed: '<path d="M12 78 A40 40 0 1 1 88 78"/><path d="M50 74 L76 40"/><circle cx="50" cy="74" r="4" class="fill"/>',
    duration: '<circle cx="50" cy="54" r="34"/><path d="M50 54 L50 32 M50 54 L66 62"/><path d="M42 12 L58 12 M50 12 L50 20"/>',
    check: '<path d="M18 52 L42 76 L84 26"/>',
    lock: '<rect x="22" y="44" width="56" height="44" rx="6"/><path d="M34 44 V32 a16 16 0 0 1 32 0 V44"/>',
};

export const drawing = (name, label = null) => sketch(DRAWINGS[name], '0 0 100 100', label);

/** The HTML screens: only one is shown at a time. */
const screens = new Map();

export function registerScreen(name, el) {
    el.hidden = true;
    el.classList.add('screen');
    document.getElementById('screens').append(el);
    screens.set(name, el);
    return el;
}

let current = null;

export function showScreen(name) {
    for (const [n, el] of screens) {
        el.hidden = n !== name;
    }
    current = name;
    const el = screens.get(name);
    // Focus the first control, so the keyboard can play straight away.
    el?.querySelector('[data-autofocus], button:not([disabled])')?.focus({ preventScroll: true });
}

export function hideScreens() {
    for (const el of screens.values()) {
        el.hidden = true;
    }
    current = null;
}

export const currentScreen = () => current;

/** Hides clips of the canvas scene that an HTML screen replaces (hidden clips can't be clicked either). */
export function hideClips(...clips) {
    for (const c of clips) {
        if (c) {
            c.visible = false;
        }
    }
}

/** Tells the open screens that the saved game changed outside them (the cheats), so they redraw. */
export const STATE_EVENT = 'learn-to-fly-state';

export function stateChanged() {
    window.dispatchEvent(new Event(STATE_EVENT));
}

/** Money as the game shows it. */
export const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
