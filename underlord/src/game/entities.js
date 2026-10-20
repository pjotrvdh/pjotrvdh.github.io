/**
 * Units (imps, creatures, heroes): creating them, moving them along paths, task reservations, beds,
 * experience, research, gold and leaving. The per-kind behaviour lives in imps.js, creatures.js and
 * combat.js; the state machine that drives them is tick() in world.js.
 */
import { FLOOR, LAIR, hash, inb, ix, tx, ty } from './constants.js';
import { CFG, KINDS, SPELLS } from './config.js';
import { bfs } from './path.js';
import { G } from './state.js';
import { cap, ownPortal, ti, walk } from './tiles.js';
import { msg } from './ui.js';
import { fx } from './world.js';

export function spawn(kind, x, y, mult = 1) {
    const k = KINDS[kind];
    const e = {
        id: G.idc++, kind, side: k.side || 0, x: x + 0.5, y: y + 0.5,
        hp: k.hp * mult, maxhp: k.hp * mult, atk: k.atk * mult, lvl: 1, xp: 0,
        state: k.side ? 'march' : 'think', path: [], next: null, nextT: 0, timer: 0, cd: 0, carry: 0,
        hunger: Math.random() * 40, slap: 0, resv: -1, bed: -1, target: null, leaving: '', fromPool: false,
        repath: 0, scan: Math.random() * 0.5, ignoreT: 0, dead: false, held: false, face: 1, task: -1, guard: false,
    };
    G.ents.push(e);

    return e;
}

/** Marks tile i as e's task, so other imps pick something else (dig targets allow two). */
export function reserve(e, i) {
    e.resv = i;
    G.res.set(i, (G.res.get(i) || 0) + 1);
}

export function release(e) {
    if (e.resv >= 0) {
        const c = (G.res.get(e.resv) || 1) - 1;
        if (c > 0) {
            G.res.set(e.resv, c);
        } else {
            G.res.delete(e.resv);
        }
        e.resv = -1;
    }
}

/** Walk `path`, then switch to state `next` with timer `t` (see arrive()). */
export function go(e, path, next, t = 0) {
    e.path = path;
    e.next = next;
    e.nextT = t;
    e.state = 'walk';
}

/** Where unit e walks to in tile i: the centre plus a small offset of its own, so units do not file over tile centres or stack up. */
function spot(e, i) {
    return { x: tx(i) + 0.5 + (hash(e.id, 7) - 0.5) * 0.44, y: ty(i) + 0.5 + (hash(e.id, 11) - 0.5) * 0.44 };
}

/** A straight walk from (ax, ay) to (bx, by) stays on walkable tiles, with room for a unit's body (`pad` tiles) on every side. */
export function lineWalk(ax, ay, bx, by, pad = 0.18) {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 6));
    for (let k = 0; k <= n; k++) {
        const x = ax + (bx - ax) * k / n;
        const y = ay + (by - ay) * k / n;
        for (const [ox, oy] of [[-pad, -pad], [pad, -pad], [-pad, pad], [pad, pad]]) {
            const a = Math.floor(x + ox);
            const b = Math.floor(y + oy);
            if (!inb(a, b) || !walk(ix(a, b))) {
                return false;
            }
        }
    }

    return true;
}

/**
 * Moves e along its path; true when it has arrived. Units are not bound to the grid: each walks to its
 * own spot in a tile (spot()), and heads straight for the next path point when nothing is in the way, so
 * it cuts corners and walks diagonally instead of from tile centre to tile centre.
 */
export function step(e, dt) {
    if (!e.path.length) {
        return true;
    }
    if (e.path.length > 1 && walk(e.path[0]) && walk(e.path[1])) {
        const s = spot(e, e.path[1]);
        if (lineWalk(e.x, e.y, s.x, s.y)) {
            e.path.shift();
        }
    }
    const n = e.path[0];
    const { x: cx, y: cy } = spot(e, n);
    const dx = cx - e.x;
    const dy = cy - e.y;
    const d = Math.hypot(dx, dy);
    const sp = KINDS[e.kind].spd * (e.slap > 0 ? CFG.hand.slapBoost : 1) * dt;
    if (Math.abs(dx) > 0.01) {
        e.face = Math.sign(dx);
    }
    if (d <= sp) {
        e.x = cx;
        e.y = cy;
        e.path.shift();

        return !e.path.length;
    }
    e.x += dx / d * sp;
    e.y += dy / d * sp;

    return false;
}

export function arrive(e) {
    e.state = e.next;
    e.timer = e.nextT;
    if (e.state === 'deposit') {
        const add = addGold(e.carry);
        e.carry -= add;
        if (e.carry > 0) {
            msg('Your treasuries are full. Build more.', 'full', 'bad');
        }
        e.state = 'think';
    }
}

/** Adds what fits under cap() and returns how much that was. */
export function addGold(n) {
    const a = Math.max(0, Math.min(n, cap() - G.money));
    G.money += a;

    return a;
}

export function openTile(j) {
    G.t[j] = FLOOR;
    G.mark[j] = 0;
}

/** Your living creatures (imps excluded, held ones included). */
export function creatures() {
    return G.ents.filter((e) => e.side === 0 && e.kind !== 'imp' && !e.dead);
}

// Beds (Dungeon Keeper style): every creature claims one Lair tile as its own bed. Nobody else sleeps there,
// and the bed is freed when the creature dies or leaves, or when the tile stops being a Lair.
export function bedOwner(i, except) {
    return G.ents.find((o) => o !== except && !o.dead && o.side === 0 && o.bed === i);
}

export function hasBed(e) {
    return e.bed >= 0 && G.room[e.bed] === LAIR;
}

/** The path to e's bed, claiming the nearest free Lair tile first if it has none. */
export function toBed(e) {
    const here = ti(e);
    if (!hasBed(e)) {
        e.bed = -1;
    }
    if (e.bed >= 0) {
        return bfs(here, (i) => i === e.bed);
    }
    if (!G.rc[LAIR]) {
        return null;
    }
    const p = bfs(here, (i) => G.room[i] === LAIR && !bedOwner(i, e));
    if (p) {
        e.bed = p.length ? p[p.length - 1] : here;
    }

    return p;
}

/** XP needed for the next level. */
export function need(e) {
    return 80 * e.lvl;
}

export function gainXP(e, n) {
    if (e.lvl >= 10) {
        return;
    }
    e.xp += n;
    while (e.lvl < 10 && e.xp >= need(e)) {
        e.xp -= need(e);
        e.lvl++;
        e.maxhp *= 1.12;
        e.hp = e.maxhp;
        e.atk *= 1.1;
        fx({ type: 'text', x: e.x, y: e.y - 0.4, dur: 1.2, txt: 'Level ' + e.lvl, col: '#e3b23c' });
    }
}

export function research(n) {
    const before = G.research;
    G.research += n;
    for (const [k, s] of Object.entries(SPELLS)) {
        if (s.req && before < s.req && G.research >= s.req) {
            msg('Research complete: ' + s.n + '.', 'sp' + k, 'good');
        }
    }
}

// A creature that decides to leave keeps `leaving` set: picking it up, dropping it or loading a save only delays it.
export function leave(e, why) {
    e.leaving = why;
    msg('The ' + KINDS[e.kind].n + ' leaves your dungeon (' + why + ').', 'lv' + e.id, 'bad');
    if (!e.held) {
        headOut(e);
    }
}

export function headOut(e) {
    release(e);
    e.target = null;
    e.after = null;
    const p = bfs(ti(e), ownPortal);
    if (!p) {
        e.dead = true;
        toPool(e);

        return;
    }
    e.path = p;
    e.state = 'leave';
}

// Only creatures that came through a portal go back to its pool, and only when they leave or are dismissed: slain ones are gone.
export function toPool(e) {
    if (e.fromPool && G.pool[e.kind] !== undefined) {
        G.pool[e.kind]++;
        e.fromPool = false;
    }
}
