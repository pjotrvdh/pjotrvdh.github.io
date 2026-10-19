/**
 * Turns the game data in src/config into the lookup tables the game uses. applyConfig() runs once at
 * start; every table is a live export, so other modules always see the current values.
 */
import { ROOM_IDS } from './constants.js';
import { G } from './state.js';

export let CFG;
export let ECON;
/** Every unit kind (creatures and heroes): name, stats and needs, keyed by config key. */
export let KINDS;
/** Rooms by code (1..5): name, cost, colour, tip. */
export let ROOMS;
export let SPELLS;
export let WAVES;
/** Attractable creature kinds: `need` (text) and `ok()` (are their room needs met). */
export let ATTRACT;
export let PORTAL_LIMIT;
export let HEART_CAP;
export let TREAS_CAP;
export let WALL_HP;
/** What the renderer draws for what (src/config/assets.js). */
export let ASSETS;

export function applyConfig(c) {
    CFG = c.settings;
    ECON = CFG.economy;
    HEART_CAP = ECON.heartCap;
    TREAS_CAP = ECON.treasCap;
    WALL_HP = CFG.walls.hp;
    PORTAL_LIMIT = CFG.portal.creatureLimit;
    const mk = (v, side) => ({
        n: v.name,
        hp: v.hp,
        atk: v.attack,
        spd: v.speed,
        range: v.range,
        rate: v.rate,
        wage: v.wage || 0,
        col: v.color,
        side: side || undefined,
        bounty: v.bounty || 0,
        dig: v.dig,
        big: v.big ? 1 : 0,
        vision: v.vision || 5,
        pool: v.pool || 0,
        attract: v.attract || {},
        train: v.train || 0,
        study: v.study || 0,
        likesSlaps: !!v.likesSlaps,
    });
    KINDS = {};
    for (const [k, v] of Object.entries(c.creatures)) {
        KINDS[k] = mk(v, 0);
    }
    for (const [k, v] of Object.entries(c.heroes)) {
        KINDS[k] = mk(v, 1);
    }
    KINDS.imp.vision = CFG.imp.vision;
    ROOMS = {};
    ROOM_IDS.forEach((id, n) => {
        const r = c.rooms[id];
        ROOMS[n + 1] = { id, n: r.name, cost: r.cost, col: r.color, tip: id === 'treasury' ? 'Stores ' + TREAS_CAP + ' gold per tile' : r.tip };
    });
    SPELLS = {};
    for (const [k, v] of Object.entries(c.spells)) {
        SPELLS[k] = { ...v, n: v.name, req: v.research || 0, cost: v.cost || 0 };
    }
    WAVES = c.waves;
    ATTRACT = {};
    for (const [k, v] of Object.entries(KINDS)) {
        if (v.side || k === 'imp') {
            continue;
        }
        const req = Object.entries(v.attract);
        ATTRACT[k] = {
            need: req.length ? req.map(([r, n]) => 'a ' + ROOMS[ROOM_IDS.indexOf(r) + 1].n + ' of ' + n + '+ tiles').join(' and ') : 'a free bed in your Lair',
            ok: () => req.every(([r, n]) => G.rc[ROOM_IDS.indexOf(r) + 1] >= n),
        };
    }
    ASSETS = c.assets;
}

/** The wage of a creature kind, after the global multiplier. */
export const wage = (k) => Math.round(KINDS[k].wage * ECON.wageMul);
