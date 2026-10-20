/**
 * Your creatures: what they do when idle (creatureThink()), arriving through portals (tryAttract())
 * and getting paid (payday()).
 */
import { CLAIM, HATCH, LAIR, LIB, TRAIN, TREAS, rand, tx, ty } from './constants.js';
import { ATTRACT, KINDS, PORTAL_LIMIT, wage } from './config.js';
import { creatures, go, headOut, leave, release, spawn, toBed } from './entities.js';
import { bfs } from './path.js';
import { G } from './state.js';
import { adjHeart, frontier, ti, walk } from './tiles.js';
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
    // payday: go and collect the wage at a Treasury (or the Heart, which holds gold too, without one)
    if (e.payDue > 0) {
        p = bfs(here, (i) => (G.rc[TREAS] ? G.room[i] === TREAS : adjHeart(i)), 6);
        if (p) {
            go(e, p, 'collect', COLLECT_TIME);
        } else {
            collect(e);
        }

        return;
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

/** Seconds a creature spends at the Treasury collecting its wage, and cheering afterwards. */
const COLLECT_TIME = 0.8;
const CHEER_TIME = 2.2;

/**
 * Payday: every creature (not imps, not those leaving) is owed its wage (`e.payDue`). It walks to a
 * Treasury, or to the Heart without one, and collects it there (`collect()`); a wage still unpaid at
 * the next payday adds up.
 */
export function payday() {
    let due = 0;
    for (const e of creatures()) {
        if (e.leaving) {
            continue;
        }
        e.payDue = (e.payDue || 0) + wage(e.kind);
        due += wage(e.kind);
        if (!e.held && ['idle', 'walk', 'study', 'train', 'think'].includes(e.state)) {
            e.state = 'think';
        }
    }
    if (due) {
        msg('Payday: your creatures go to collect ' + due + ' gold' + (G.rc[TREAS] ? ' from the Treasury.' : ' from your Heart.'), 'pay' + G.time);
    }
}

/** A creature takes its wage: paid, it cheers; with too little gold it leaves, unpaid. */
export function collect(e) {
    const w = e.payDue || 0;
    e.payDue = 0;
    if (!w) {
        e.state = 'think';

        return;
    }
    if (G.money >= w) {
        G.money -= w;
        fx({ type: 'text', x: e.x, y: e.y - 0.4, dur: 1, txt: '-' + w, col: '#e3b23c' });
        e.state = 'cheer';
        e.timer = CHEER_TIME;
    } else {
        msg('A ' + KINDS[e.kind].n + ' found too little gold for its wage and leaves.', 'unpaid' + e.id, 'bad');
        leave(e, 'unpaid');
    }
}
