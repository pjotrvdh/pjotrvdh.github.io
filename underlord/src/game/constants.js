/**
 * Fixed values and small helpers every part of the game uses: the map size, tile and room codes,
 * labels, and tile-index arithmetic. Tiles are numbered row by row: i = y * W + x.
 */

/** Map size in tiles. */
export const W = 40;
export const H = 26;
export const N = W * H;

// Tile types (G.t). Saved games store these codes: changing them needs a new SAVE_V (see save.js).
export const ROCK = 0;
export const EARTH = 1;
export const GOLD = 2;
export const GEM = 3;
export const FLOOR = 4;
export const CLAIM = 5;
export const HEART = 6;
export const PORTAL = 7;
export const GATE = 8;
export const LAVA = 9;
export const WALL = 10;

// Room codes (G.room), 1..6 in the order of ROOM_IDS. Saved games store these codes: only add new ones at the end.
export const TREAS = 1;
export const LAIR = 2;
export const HATCH = 3;
export const TRAIN = 4;
export const LIB = 5;
export const PRISON = 6;
export const ROOM_IDS = ['treasury', 'lair', 'hatchery', 'training', 'library', 'prison'];

/** What a unit is doing, as shown in the hover info and the creature list. */
export const STATE_EN = {
    think: 'thinking',
    walk: 'on the move',
    dig: 'digging',
    claim: 'claiming ground',
    reinforce: 'reinforcing a wall',
    sleep: 'sleeping',
    eat: 'eating',
    train: 'training',
    study: 'studying',
    fight: 'fighting',
    march: 'advancing',
    leave: 'leaving',
    idle: 'loitering',
    stun: 'dazed from the drop',
    flee: 'fleeing',
    guard: 'guarding',
    neutral: 'wandering, unaligned',
    collect: 'collecting its wage',
    cheer: 'cheering',
    pickup: 'picking up gold',
    out: 'knocked out',
    hauled: 'carried to the Prison',
    jailed: 'imprisoned',
    grab: 'fetching a prisoner',
    jail: 'taking a prisoner to the Prison',
};

/** Tile names for the hover info (the portal has its own text). */
export const TILE_EN = {
    [ROCK]: 'Rock (impenetrable)',
    [EARTH]: 'Earth',
    [GOLD]: 'Gold seam',
    [GEM]: 'Gem seam (never runs out)',
    [FLOOR]: 'Unclaimed ground',
    [CLAIM]: 'Your territory',
    [HEART]: 'Dungeon Heart',
    [GATE]: 'Hero Gate',
    [LAVA]: 'Lava',
    [WALL]: 'Reinforced wall (slows heroes down)',
};

/** The four orthogonal neighbours. */
export const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export const rand = (n) => Math.floor(Math.random() * n);
export const ix = (x, y) => y * W + x;
export const tx = (i) => i % W;
export const ty = (i) => (i / W) | 0;
export const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

/** A stable pseudo-random number in [0, 1] per tile (and seed), for variation that must not flicker. */
export const hash = (x, y, s = 0) => {
    let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);

    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

export const words = (n) => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][n] || String(n);
