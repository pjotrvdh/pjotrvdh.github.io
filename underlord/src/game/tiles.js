/**
 * Questions about tiles of the current game: can units walk or see through it, can it be dug, what is
 * next to it. Most take a tile index (see constants.js).
 */
import { CLAIM, EARTH, FLOOR, GATE, GEM, GOLD, HEART, LAVA, N4, PORTAL, ROCK, TREAS, WALL, inb, ix, tx, ty } from './constants.js';
import { HEART_CAP, TREAS_CAP } from './config.js';
import { G } from './state.js';

/** The tile a unit stands on. */
export const ti = (e) => ix(Math.floor(e.x), Math.floor(e.y));

/** Units can walk here. */
export const walk = (i) => {
    const t = G.t[i];

    return t === FLOOR || t === CLAIM || t === PORTAL || t === GATE;
};

/** Sight and shots pass through here. */
export const transp = (i) => {
    const t = G.t[i];

    return t === FLOOR || t === CLAIM || t === PORTAL || t === GATE || t === HEART || t === LAVA;
};

export const diggable = (i) => {
    const t = G.t[i];

    return t === EARTH || t === GOLD || t === GEM || t === WALL;
};

/** A solid block: drawn raised, with walls where it meets open ground. */
export const solid = (i) => {
    const t = G.t[i];

    return t === ROCK || t === EARTH || t === GOLD || t === GEM || t === WALL;
};

/** The first orthogonal neighbour of i for which f(neighbour) holds, or -1. */
export const nb = (i, f) => {
    const x = tx(i);
    const y = ty(i);
    for (const [dx, dy] of N4) {
        const a = x + dx;
        const b = y + dy;
        if (inb(a, b) && f(ix(a, b))) {
            return ix(a, b);
        }
    }

    return -1;
};

export const adjHeart = (i) => nb(i, (j) => G.t[j] === HEART) >= 0;

/** How much gold you can hold: the Heart plus every Treasury tile. */
export const cap = () => HEART_CAP + TREAS_CAP * G.rc[TREAS];

export const ownPortal = (i) => G.t[i] === PORTAL && !!G.pown[i];
export const anyPortal = () => G.portals.some((p) => G.pown[p]);

/** Next to ground nobody has seen yet. */
export const frontier = (i) => nb(i, (j) => !G.seen[j]) >= 0;
