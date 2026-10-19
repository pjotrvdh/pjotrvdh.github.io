/**
 * Your creatures: what they do when idle (creatureThink()), arriving through portals (tryAttract())
 * and getting paid (payday()).
 */
import { CLAIM, HATCH, LAIR, LIB, TRAIN, rand, tx, ty } from './constants.js';
import { ATTRACT, KINDS, PORTAL_LIMIT, wage } from './config.js';
import { creatures, go, headOut, leave, release, spawn, toBed } from './entities.js';
import { bfs } from './path.js';
import { G } from './state.js';
import { frontier, ti, walk } from './tiles.js';
import { msg } from './ui.js';
import { fx } from './world.js';

export function creatureThink(e) {
    if (e.leaving) {
        headOut(e);

        return;
    }
    release(e);
    const here = ti(e);
    let p;
    if (G.rally && G.time < G.rally.until) {
        p = bfs(here, (i) => i === G.rally.i);
        if (p) {
            go(e, p, 'idle', 1);

            return;
        }
    }
    if (e.hp < e.maxhp * 0.5) {
        p = toBed(e);
        if (p) {
            go(e, p, 'sleep');

            return;
        }
    }
    if (e.hunger >= 100 && G.rc[HATCH]) {
        p = bfs(here, (i) => G.room[i] === HATCH, 6);
        if (p) {
            go(e, p, 'eat', 2.5);

            return;
        }
    }
    if (e.kind === 'warlock' && G.rc[LIB] && Math.random() < 0.8) {
        p = bfs(here, (i) => G.room[i] === LIB, 6);
        if (p) {
            go(e, p, 'study', 8);

            return;
        }
    }
    if (G.rc[TRAIN] && G.money > 20 && e.lvl < 10 && Math.random() < 0.6) {
        p = bfs(here, (i) => G.room[i] === TRAIN, 6);
        if (p) {
            go(e, p, 'train', 8);

            return;
        }
    }
    if (Math.random() < 0.35) {
        p = bfs(here, (i) => frontier(i) || G.loot[i] > 0, 3, walk, 40);
        if (p && p.length) {
            go(e, p, 'idle', 1.5);

            return;
        }
    }
    if (KINDS[e.kind].study && G.rc[LIB] && Math.random() < 0.5) {
        p = bfs(here, (i) => G.room[i] === LIB, 6);
        if (p) {
            go(e, p, 'study', 8);

            return;
        }
    }
    p = toBed(e);
    if (!p) {
        p = bfs(here, (i) => G.t[i] === CLAIM, 8, walk, 5);
    }
    if (p) {
        go(e, p, 'idle', 2 + Math.random() * 3);
    } else {
        e.state = 'idle';
        e.timer = 2;
    }
}

export function tryAttract() {
    const n = creatures().length;
    if (n >= PORTAL_LIMIT) {
        msg('Your dungeon has reached its creature limit of ' + PORTAL_LIMIT + '.', 'limit', 'bad');

        return;
    }
    if (G.rc[LAIR] <= n) {
        msg('Your creatures need a bigger Lair. The portal stays quiet until there is a free bed.', 'nolair', 'bad');

        return;
    }
    const opts = Object.keys(ATTRACT).filter((k) => G.pool[k] > 0 && ATTRACT[k].ok());
    if (!opts.length) {
        return;
    }
    const k = opts[rand(opts.length)];
    const own = G.portals.filter((p) => G.pown[p]);
    const pt = own[rand(own.length)];
    G.pool[k]--;
    const e = spawn(k, tx(pt), ty(pt));
    e.fromPool = true;
    fx({ type: 'ring', x: e.x, y: e.y, dur: 0.8, col: '#c58cff' });
    msg('A ' + KINDS[k].n + ' steps through the portal.', 'arr' + e.id, 'good');
}

export function payday() {
    let paid = 0;
    let gone = 0;
    for (const e of creatures()) {
        if (e.leaving) {
            continue;
        }
        const w = wage(e.kind);
        if (G.money >= w) {
            G.money -= w;
            paid += w;
            fx({ type: 'text', x: e.x, y: e.y - 0.4, dur: 1, txt: '-' + w, col: '#e3b23c' });
        } else {
            gone++;
            leave(e, 'unpaid');
        }
    }
    if (paid || gone) {
        msg('Payday: ' + paid + ' gold paid out' + (gone ? ', ' + gone + ' went unpaid.' : '.'), 'pay' + G.time, gone ? 'bad' : '');
    }
}
