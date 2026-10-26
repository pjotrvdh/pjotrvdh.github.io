/**
 * The Prison (Dungeon Keeper style): with free Prison tiles, a hero your side defeats is knocked out
 * instead of slain (`capture()`). An imp carries it to a free Prison tile (`grab()`, `jail()`); there it
 * starves and, once dead, rises as a Skeleton on your side (`prisonerTick()`). Prisoners are side 3:
 * nobody fights them, and they do not count as heroes for winning.
 */
import { sound } from './audio.js';
import { HERO, PRISON, PRISONER, tx, ty } from './constants.js';
import { KINDS, PORTAL_LIMIT, ROOMS } from './config.js';
import { creatures, go, release, spawn } from './entities.js';
import { bfs } from './path.js';
import { G } from './state.js';
import { ti, walk } from './tiles.js';
import { msg } from './ui.js';
import { fx } from './world.js';

const P = () => ROOMS[PRISON].cfg;

/** Living prisoners: knocked out, carried or jailed. */
export const prisoners = () => G.ents.filter((e) => e.side === PRISONER && !e.dead);

/** Prison tile i holds a jailed prisoner (or one on its way there). */
const taken = (i) => G.ents.some((e) => e.side === PRISONER && !e.dead && e.cell === i);

/** Is there room for one more prisoner? One per Prison tile. */
export const prisonRoom = () => prisoners().length < (G.rc[PRISON] || 0);

/** A defeated hero is knocked out and waits for an imp; true when it was taken prisoner. */
export function capture(t) {
    if (t.side !== HERO || !prisonRoom()) {
        return false;
    }
    release(t);
    t.side = PRISONER;
    t.state = 'out';
    t.timer = P().outTime;
    t.hp = 1;
    t.path = [];
    t.target = null;
    t.guard = false;
    t.cell = -1;
    t.by = 0;
    sound('knockout', t.x, t.y);
    msg('A ' + KINDS[t.kind].n + ' is knocked out. Your imps will take it to the Prison.', 'ko' + t.id, 'good');

    return true;
}

/** Imp job: the nearest knocked-out prisoner nobody fetches yet, if a Prison tile is free. */
export function haulJob(e) {
    const here = ti(e);
    const free = (i) => G.room[i] === PRISON && walk(i) && !taken(i);
    if (!G.rc[PRISON] || !bfs(here, free)) {
        return false;
    }
    const wait = G.ents.filter((o) => o.side === PRISONER && !o.dead && o.state === 'out' && !o.by);
    if (!wait.length) {
        return false;
    }
    const at = new Set(wait.map(ti));
    const p = bfs(here, (i) => at.has(i), 1, walk, 40);
    if (!p) {
        return false;
    }
    const end = p.length ? p[p.length - 1] : here;
    const o = wait.find((w) => ti(w) === end);
    o.by = e.id;
    e.haul = o.id;
    go(e, p, 'grab');

    return true;
}

/** State `grab` (imp): pick up the prisoner and carry it to a free Prison tile. */
export function grab(e) {
    const o = G.ents.find((u) => u.id === e.haul && !u.dead && u.side === PRISONER);
    const p = o && bfs(ti(e), (i) => G.room[i] === PRISON && walk(i) && !taken(i));
    if (!p) {
        drop(e);
        e.state = 'think';

        return;
    }
    o.state = 'hauled';
    o.cell = p.length ? p[p.length - 1] : ti(e);
    go(e, p, 'jail');
}

/** State `jail` (imp): put the prisoner down in its cell. */
export function jail(e) {
    const o = G.ents.find((u) => u.id === e.haul && !u.dead && u.side === PRISONER);
    e.haul = 0;
    e.state = 'think';
    if (!o) {
        return;
    }
    if (ti(e) !== o.cell || G.room[o.cell] !== PRISON) {
        o.state = 'out';
        o.cell = -1;
        o.by = 0;

        return;
    }
    o.state = 'jailed';
    // it comes round in its cell, then slowly starves
    o.hp = o.maxhp;
    o.x = tx(o.cell) + 0.5;
    o.y = ty(o.cell) + 0.5;
    fx({ type: 'ring', x: o.x, y: o.y, dur: 0.5, col: '#8c93a3' });
}

/** The imp lets go of what it carries (it was picked up, scared off or lost its way). */
export function drop(e) {
    const o = e.haul && G.ents.find((u) => u.id === e.haul);
    e.haul = 0;
    if (o && !o.dead && o.state !== 'jailed') {
        o.state = 'out';
        o.cell = -1;
        o.by = 0;
    }
}

/** A prisoner from a saved game: back in its cell if that is still a Prison tile, else knocked out where it lies. */
export function restorePrisoner(e) {
    e.by = 0;
    if (e.cell >= 0 && G.room[e.cell] === PRISON) {
        e.state = 'jailed';
    } else {
        e.state = 'out';
        e.timer = P().outTime;
        e.cell = -1;
    }
}

/** One step for a prisoner: waiting, carried along, or starving in its cell. */
export function prisonerTick(e, dt) {
    if (e.state === 'hauled') {
        const imp = G.ents.find((u) => u.id === e.by && !u.dead);
        if (!imp || imp.haul !== e.id || imp.held) {
            e.state = 'out';
            e.cell = -1;
            e.by = 0;

            return;
        }
        e.x = imp.x;
        e.y = imp.y;

        return;
    }
    if (e.state === 'jailed') {
        // a sold cell sets it free: it is a hero again
        if (G.room[e.cell] !== PRISON) {
            e.side = HERO;
            e.state = 'march';
            e.hp = Math.max(e.hp, e.maxhp * 0.3);
            e.cell = -1;
            msg('A prisoner escapes!', 'esc' + e.id, 'bad');

            return;
        }
        e.hp -= e.maxhp * P().starve * dt;
        if (e.hp <= 0) {
            rise(e);
        }

        return;
    }
    e.state = 'out';
    if (!e.by && (e.timer -= dt) <= 0) {
        e.dead = true;
        fx({ type: 'death', x: e.x, y: e.y, dur: 1.2, kind: e.kind, face: e.face, side: PRISONER });
    }
}

/** A prisoner dies in its cell and rises as a Skeleton (unless your dungeon is full). */
function rise(e) {
    e.dead = true;
    fx({ type: 'death', x: e.x, y: e.y, dur: 1.2, kind: e.kind, face: e.face, side: PRISONER });
    if (creatures().length >= PORTAL_LIMIT) {
        msg('A prisoner died, but your dungeon is too full for another Skeleton.', 'skfull', 'bad');

        return;
    }
    const s = spawn('skeleton', tx(e.cell), ty(e.cell));
    s.state = 'stun';
    s.timer = 1.2;
    fx({ type: 'ring', x: s.x, y: s.y, dur: 0.8, col: '#d8d0b8' });
    sound('portal', s.x, s.y);
    msg('A ' + KINDS[e.kind].n + ' died in your Prison and rises as a Skeleton.', 'sk' + s.id, 'good');
}
