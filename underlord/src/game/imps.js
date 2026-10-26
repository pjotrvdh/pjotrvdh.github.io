/**
 * Imp work (Dungeon Keeper style): digging marked blocks, hauling gold, claiming ground, opening chests
 * and reinforcing walls. impThink() picks the next job; doDig(), doClaim() and doReinforce() do it.
 */
import { sound } from './audio.js';
import { CLAIM, EARTH, FLOOR, GEM, GOLD, N4, PORTAL, TREAS, WALL, inb, ix, tx, ty } from './constants.js';
import { ASSETS, CFG, WALL_HP } from './config.js';
import { go, openTile, release, reserve } from './entities.js';
import { bfs } from './path.js';
import { G } from './state.js';
import { adjHeart, cap, diggable, nb, ti, walk } from './tiles.js';
import { msg } from './ui.js';
import { drop, haulJob } from './prison.js';
import { fx } from './world.js';

/** A marked, diggable block next to tile i that fewer than two imps work on (the least busy one), or -1. */
function digTarget(i, allowGold) {
    let best = -1;
    let bc = 9;
    const x = tx(i);
    const y = ty(i);
    for (const [dx, dy] of N4) {
        const a = x + dx;
        const b = y + dy;
        if (!inb(a, b)) {
            continue;
        }
        const j = ix(a, b);
        if (!G.mark[j] || !diggable(j)) {
            continue;
        }
        if (!allowGold && G.t[j] !== EARTH) {
            continue;
        }
        const c = G.res.get(j) || 0;
        if (c < 2 && c < bc) {
            bc = c;
            best = j;
        }
    }

    return best;
}

/** Where imps drop their gold: a Treasury tile or any walkable tile next to the Heart. */
export const depositGoal = (i) => walk(i) && (G.room[i] === TREAS || adjHeart(i));

const claimable = (i) => (G.t[i] === FLOOR || (G.t[i] === PORTAL && !G.pown[i])) && !G.res.has(i) && nb(i, (j) => G.t[j] === CLAIM) >= 0;

/** How much gold an imp carries before it hauls it to a Treasury. */
export const IMP_POCKET = 100;

/** Picks up gold from the pile on this tile, as much as the pocket holds. */
export function pickUpPile(e) {
    const i = ti(e);
    const a = Math.min(G.pile[i], IMP_POCKET - e.carry);
    G.pile[i] -= a;
    e.carry += a;
    sound('coins', e.x, e.y);
    e.state = 'think';
}

export function impThink(e) {
    release(e);
    drop(e);
    const here = ti(e);
    const full = G.money >= cap();
    if (e.carry >= 100 && !full) {
        const p = bfs(here, depositGoal);
        if (p) {
            go(e, p, 'deposit');

            return;
        }
    }
    // a knocked-out hero, to carry to the Prison
    if (haulJob(e)) {
        return;
    }
    let p = bfs(here, claimable, 1, walk, 2);
    if (p) {
        const end = p.length ? p[p.length - 1] : here;
        reserve(e, end);
        e.task = end;
        go(e, p, 'claim', 1.2);

        return;
    }
    // gold lying around (dropped by a full imp at a seam): pick it up while the pocket has room
    if (!full && e.carry < IMP_POCKET) {
        p = bfs(here, (i) => G.pile[i] > 0, 1, walk, 20);
        if (p) {
            go(e, p, 'pickup', 0.3);

            return;
        }
    }
    const allowGold = !(full && e.carry >= 100);
    p = bfs(here, (i) => digTarget(i, allowGold) >= 0);
    if (p) {
        const end = p.length ? p[p.length - 1] : here;
        const j = digTarget(end, allowGold);
        reserve(e, j);
        e.task = j;
        go(e, p, 'dig', 0.15);

        return;
    }
    if (e.carry > 0 && !full) {
        p = bfs(here, depositGoal);
        if (p) {
            go(e, p, 'deposit');

            return;
        }
    }
    p = bfs(here, claimable);
    if (p) {
        const end = p.length ? p[p.length - 1] : here;
        reserve(e, end);
        e.task = end;
        go(e, p, 'claim', 1.2);

        return;
    }
    p = bfs(here, (i) => G.loot[i] > 0, 1, walk, 30);
    if (p) {
        go(e, p, 'idle', 0.5);

        return;
    }
    p = bfs(here, (i) => G.t[i] === CLAIM && reinforceTarget(i) >= 0, 1, walk, 40);
    if (p) {
        const end = p.length ? p[p.length - 1] : here;
        const j = reinforceTarget(end);
        reserve(e, j);
        e.task = j;
        go(e, p, 'reinforce', 0.5);

        return;
    }
    p = bfs(here, (i) => G.t[i] === CLAIM && !G.room[i], 6, walk, 4);
    if (p && Math.random() < 0.5) {
        go(e, p, 'idle', 1 + Math.random() * 1.5);
    } else {
        e.state = 'idle';
        e.timer = 0.8 + Math.random();
    }
}

export function doDig(e, dt) {
    const j = e.task;
    if (j < 0 || !G.mark[j] || !diggable(j) || nb(ti(e), (k) => k === j) < 0) {
        e.state = 'think';

        return;
    }
    e.face = Math.sign(tx(j) - tx(ti(e))) || e.face;
    e.timer -= dt * (e.slap > 0 ? CFG.hand.slapBoost : 1);
    if (e.timer > 0) {
        return;
    }
    e.timer = 0.38;
    const t = G.t[j];
    if (t === EARTH || t === WALL) {
        if (--G.hp[j] <= 0) {
            openTile(j);
        }
    } else if (t === GOLD) {
        const g = Math.min(20, G.gold[j]);
        G.gold[j] -= g;
        e.carry += g;
        // a full pocket does not stop the mining: the rest falls in a pile at the imp's feet
        if (e.carry > IMP_POCKET) {
            G.pile[ti(e)] += e.carry - IMP_POCKET;
            e.carry = IMP_POCKET;
        }
        if (G.gold[j] <= 0) {
            openTile(j);
        }
    } else if (t === GEM) {
        e.carry += 20;
    }
    sound(t === GOLD ? 'gold' : t === GEM ? 'gem' : 'dig', tx(j) + 0.5, ty(j) + 0.5);
    fx({ type: 'dust', x: (e.x + tx(j) + 0.5) / 2, y: (e.y + ty(j) + 0.5) / 2, dur: 0.35, col: t === EARTH ? '#8a6446' : t === WALL ? '#9a8a80' : t === GEM ? ASSETS.gemColor : ASSETS.goldColor });
    // full: haul it (earth and walls), or for gold keep mining the seam out unless the treasuries are full
    const full = G.money >= cap();
    if (e.carry >= IMP_POCKET && (t === GOLD ? full : !full || t !== EARTH)) {
        e.state = 'think';
    }
}

// Idle imps fortify earth walls that border your territory (as in Dungeon Keeper).
function reinforceTarget(i) {
    return nb(i, (j) => G.t[j] === EARTH && !G.mark[j] && !G.res.has(j));
}

export function doReinforce(e, dt) {
    const j = e.task;
    if (j < 0 || G.t[j] !== EARTH || G.mark[j] || G.t[ti(e)] !== CLAIM || nb(ti(e), (k) => k === j) < 0) {
        e.work = 0;
        e.state = 'think';

        return;
    }
    e.face = Math.sign(tx(j) - tx(ti(e))) || e.face;
    e.timer -= dt * (e.slap > 0 ? CFG.hand.slapBoost : 1);
    if (e.timer > 0) {
        return;
    }
    e.timer = 0.5;
    e.work = (e.work || 0) + 1;
    fx({ type: 'dust', x: (e.x + tx(j) + 0.5) / 2, y: (e.y + ty(j) + 0.5) / 2, dur: 0.3, col: '#b8a89a' });
    sound('hammer', tx(j) + 0.5, ty(j) + 0.5);
    if (e.work >= 5) {
        e.work = 0;
        G.t[j] = WALL;
        G.hp[j] = WALL_HP;
        sound('wall', tx(j) + 0.5, ty(j) + 0.5);
        e.state = 'think';
    }
}

export function doClaim(e, dt) {
    const i = ti(e);
    if (i !== e.task || !(G.t[i] === FLOOR || (G.t[i] === PORTAL && !G.pown[i]))) {
        e.state = 'think';

        return;
    }
    e.timer -= dt * (e.slap > 0 ? CFG.hand.slapBoost : 1);
    if (e.timer > 0) {
        return;
    }
    if (nb(i, (j) => G.t[j] === CLAIM) >= 0) {
        if (G.t[i] === PORTAL) {
            G.pown[i] = 1;
            msg('A portal is yours. Creatures can now arrive through it.', 'portal' + i, 'good');
        } else {
            G.t[i] = CLAIM;
        }
        fx({ type: 'ring', x: tx(i) + 0.5, y: ty(i) + 0.5, dur: 0.5, col: '#e0483c' });
        sound('claim', tx(i) + 0.5, ty(i) + 0.5);
    }
    e.state = 'think';
}
