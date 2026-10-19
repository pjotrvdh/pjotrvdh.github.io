/**
 * What the player (and the Computer Assistant) can do: build and sell rooms, mark blocks, cast spells,
 * pick up, drop, dismiss and slap units. Input handling is in input.js; this is the game side.
 */
import { CLAIM, HATCH, LAIR, LIB, N, ROCK, TRAIN, ix, rand, tx, ty } from './constants.js';
import { CFG, KINDS, ROOMS, SPELLS } from './config.js';
import { bedOwner, creatures, release, spawn, toPool } from './entities.js';
import { kill } from './combat.js';
import { G, app } from './state.js';
import { cap, diggable, ownPortal, walk } from './tiles.js';
import { msg } from './ui.js';
import { fx } from './world.js';

export function recount() {
    G.rc = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < N; i++) {
        if (G.room[i]) {
            G.rc[G.room[i]]++;
        }
    }
}

export function build(i, r) {
    if (G.t[i] !== CLAIM || G.room[i]) {
        return false;
    }
    const c = ROOMS[r].cost;
    if (G.money < c) {
        msg('Not enough gold for a ' + ROOMS[r].n + '.', 'nogold', 'bad');

        return false;
    }
    G.money -= c;
    G.room[i] = r;
    fx({ type: 'ring', x: tx(i) + 0.5, y: ty(i) + 0.5, dur: 0.4, col: ROOMS[r].col });

    return true;
}

function sell(i) {
    const r = G.room[i];
    if (!r) {
        return;
    }
    G.room[i] = 0;
    G.money += Math.floor(ROOMS[r].cost / 2);
}

/** Does a drag in `mode` ('mark', 'unmark', 'sell' or a room code) change tile i? */
export function affects(mode, i) {
    if (mode === 'mark') {
        return G.seen[i] ? diggable(i) && !G.mark[i] : !G.mark[i] && G.t[i] !== ROCK;
    }
    if (mode === 'unmark') {
        return !!G.mark[i];
    }
    if (!G.seen[i]) {
        return false;
    }
    if (mode === 'sell') {
        return !!G.room[i];
    }
    if (ROOMS[mode]) {
        return G.t[i] === CLAIM && !G.room[i];
    }

    return false;
}

/** Applies a finished drag (or click) over rectangle R; then cuts gold above the capacity. */
export function applyRect(mode, R) {
    for (let y = R.y0; y <= R.y1; y++) {
        for (let x = R.x0; x <= R.x1; x++) {
            const i = ix(x, y);
            if (!affects(mode, i)) {
                continue;
            }
            if (mode === 'mark') {
                if (diggable(i)) {
                    G.mark[i] = 1;
                }
            } else if (mode === 'unmark') {
                G.mark[i] = 0;
            } else if (mode === 'sell') {
                sell(i);
            } else if (!build(i, +mode)) {
                y = R.y1;
                break;
            }
        }
    }
    recount();
    if (G.money > cap()) {
        msg('Not all the gold fit in your treasuries.', 'lost', 'bad');
        G.money = cap();
    }
}

/** Is the current tool usable on tile i (the hover outline: light = yes, red = no)? `ent` is the unit under the pointer. */
export function toolValid(i, ent) {
    const tool = app.tool;
    if (tool === 'hand') {
        if (G.held.length) {
            return G.t[i] === CLAIM || ownPortal(i);
        }

        return !G.seen[i] || diggable(i) || !!ent;
    }
    if (tool === 'slap') {
        return !!ent;
    }
    if (ROOMS[tool]) {
        return affects(tool, i);
    }
    if (tool === 'sell') {
        return !!G.room[i];
    }
    if (tool === 'imp') {
        return G.t[i] === CLAIM;
    }
    if (tool === 'rally') {
        return G.seen[i] && walk(i);
    }

    return G.seen[i];
}

export function impCost() {
    return CFG.imp.baseCost + CFG.imp.perImp * G.ents.filter((e) => e.kind === 'imp').length;
}

// Call to Arms is free on your own territory, as in Dungeon Keeper.
export function spellCost(k, i) {
    return k === 'imp' ? impCost() : k === 'rally' && i !== undefined && G.t[i] === CLAIM ? 0 : SPELLS[k].cost;
}

/** Casts spell k on tile i, at point (px, py) in tile coordinates (the effect's centre). */
export function cast(k, i, px, py) {
    const s = SPELLS[k];
    if (G.research < s.req) {
        msg(s.n + ' has not been researched yet.', 'req', 'bad');

        return;
    }
    const c = spellCost(k, i);
    if (G.money < c) {
        msg('Not enough gold for ' + s.n + '.', 'nogold', 'bad');

        return;
    }
    if (k === 'imp') {
        if (G.t[i] !== CLAIM) {
            return;
        }
        const e = spawn('imp', tx(i), ty(i));
        fx({ type: 'ring', x: e.x, y: e.y, dur: 0.6, col: '#e0483c' });
    } else if (k === 'bolt') {
        if (!G.seen[i]) {
            return;
        }
        fx({ type: 'bolt', x: px, y: py, dur: 0.45, seed: rand(999) });
        for (const o of G.ents) {
            if (o.dead || o.side !== 1) {
                continue;
            }
            if (Math.hypot(o.x - px, o.y - py) < s.radius) {
                o.hp -= s.damage;
                o.hurtT = 0.3;
                fx({ type: 'text', x: o.x, y: o.y - 0.3, dur: 0.8, txt: '-' + s.damage, col: '#dfe9ff' });
                if (o.hp <= 0) {
                    kill(o);
                }
            }
        }
    } else if (k === 'heal') {
        if (!G.seen[i]) {
            return;
        }
        fx({ type: 'heal', x: px, y: py, dur: 0.6, r: s.radius });
        for (const o of G.ents) {
            if (!o.dead && o.side === 0 && Math.hypot(o.x - px, o.y - py) < s.radius) {
                o.hp = o.maxhp;
            }
        }
    } else if (k === 'rally') {
        if (!G.seen[i] || !walk(i)) {
            return;
        }
        G.rally = { i, until: G.time + s.duration };
        for (const o of creatures()) {
            if (o.state !== 'fight' && !o.leaving) {
                release(o);
                o.state = 'think';
            }
        }
        msg('Your creatures rally to arms.', 'rally', 'good');
    }
    G.money -= c;
}

export function pickUp(e) {
    if (G.held.length >= CFG.hand.capacity) {
        msg('Your hand is full (' + CFG.hand.capacity + '). Drop a creature first.', 'handfull', 'bad');

        return false;
    }
    release(e);
    e.held = true;
    e.path = [];
    e.target = null;
    e.boost = 1;
    G.held.push(e);

    return true;
}

// Dropping a creature (Dungeon Keeper 2 style): it lands dazed, and if it lands in a room it starts working there with a bonus.
export function dropHeld(i) {
    const d = G.held.pop();
    d.held = false;
    d.x = tx(i) + 0.5;
    d.y = ty(i) + 0.5;
    d.path = [];
    d.scan = 0;
    d.target = null;
    const r = G.room[i];
    const k = d.kind !== 'imp' && !d.leaving;
    // Dropped on a free Lair tile, a creature moves its bed there; another creature's bed stays locked.
    const bed = k && r === LAIR && !bedOwner(i, d);
    if (bed) {
        d.bed = i;
    }
    d.after = k && r === TRAIN && G.money > 0 ? ['train', 8] : k && r === LIB && KINDS[d.kind].study ? ['study', 8] : bed ? ['sleep', 0] : k && r === HATCH ? ['eat', 2.5] : null;
    d.boost = d.after ? CFG.hand.workBoost : 1;
    d.state = 'stun';
    d.timer = CFG.hand.dropStun;
    fx({ type: 'ring', x: d.x, y: d.y, dur: 0.4, col: '#eadcc6' });
    fx({ type: 'dust', x: d.x, y: d.y + 0.3, dur: 0.4, col: '#8a6446' });
}

/** Sends the creature on top of the hand back through own portal i. Imps are dropped there instead. */
export function dismissHeld(i) {
    const d = G.held.pop();
    d.dead = true;
    toPool(d);
    fx({ type: 'ring', x: tx(i) + 0.5, y: ty(i) + 0.5, dur: 0.6, col: '#c58cff' });
    msg('You dismissed your ' + KINDS[d.kind].n + ' through the portal.', 'dis' + d.id);
}

// A creature that likes slaps (the Dark Mistress) takes no damage, is not interrupted and works and fights faster (joy()).
export function slap(e) {
    e.slap = CFG.hand.slapTime;
    if (KINDS[e.kind].likesSlaps) {
        fx({ type: 'text', x: e.x, y: e.y - 0.3, dur: 0.8, txt: 'Yes, master!', col: '#ff9ccf' });

        return;
    }
    e.hp -= CFG.hand.slapDamage;
    e.hurtT = 0.3;
    fx({ type: 'text', x: e.x, y: e.y - 0.3, dur: 0.6, txt: 'Slap!', col: '#ffd2a8' });
    if (e.hp <= 0) {
        kill(e);

        return;
    }
    if (e.kind !== 'imp' && e.state !== 'fight') {
        release(e);
        e.state = 'think';
    }
}

/** What a unit is busy with, for the Creatures tab: 'hand', 'fighting', 'working' or 'idle'. */
export function activity(e) {
    if (e.held) {
        return 'hand';
    }
    const st = e.state === 'walk' ? e.next : e.state;
    if (st === 'fight') {
        return 'fighting';
    }

    return ['dig', 'claim', 'reinforce', 'deposit', 'train', 'study', 'eat', 'sleep'].includes(st) ? 'working' : 'idle';
}

/** Your unit nearest to point (px, py) in tile coordinates, within 0.42 tiles. */
export function entAt(px, py) {
    let best = null;
    let bd = 0.42;
    for (const e of G.ents) {
        if (e.dead || e.held || e.side !== 0) {
            continue;
        }
        const d = Math.hypot(e.x - px, e.y - py);
        if (d < bd) {
            bd = d;
            best = e;
        }
    }

    return best;
}
