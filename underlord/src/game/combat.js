/**
 * Fighting and invading: line of sight for shots, picking targets, attacks, kills and bounties, and
 * heroes marching (and tunnelling) to the Dungeon Heart.
 */
import { sound } from './audio.js';
import { TREAS, inb, ix, tx, ty } from './constants.js';
import { CFG, ECON, KINDS } from './config.js';
import { addGold, gainXP, openTile, release, step } from './entities.js';
import { bfs, dijkstra } from './path.js';
import { G } from './state.js';
import { adjHeart, diggable, ti, transp, walk } from './tiles.js';
import { msg } from './ui.js';
import { capture } from './prison.js';
import { fx } from './world.js';

/** A shot from a to b only crosses open tiles (and does not squeeze between two solid corners). */
export function clearShot(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) * 5));
    let px = Math.floor(a.x);
    let py = Math.floor(a.y);
    for (let k = 1; k <= n; k++) {
        const x = Math.floor(a.x + dx * k / n);
        const y = Math.floor(a.y + dy * k / n);
        if (x === px && y === py) {
            continue;
        }
        if (!inb(x, y) || !transp(ix(x, y))) {
            return false;
        }
        if (x !== px && y !== py && !transp(ix(x, py)) && !transp(ix(px, y))) {
            return false;
        }
        px = x;
        py = y;
    }

    return true;
}

/** The nearest enemy of e within R tiles that it has a clear shot at (neutrals and prisoners never count). */
export function nearestEnemy(e, R) {
    let best = null;
    let bd = R * R;
    for (const o of G.ents) {
        if (o.dead || o.held || o.side === e.side || o.side >= 2) {
            continue;
        }
        const dx = o.x - e.x;
        const dy = o.y - e.y;
        const d = dx * dx + dy * dy;
        if (d < bd && clearShot(e, o)) {
            bd = d;
            best = o;
        }
    }

    return best;
}

// Work and attack speed multiplier for a slapped creature that likes slaps.
export function joy(e) {
    return e.slap > 0 && KINDS[e.kind].likesSlaps ? CFG.hand.slapBoost : 1;
}

// The hero nearest to imp e that stands at the Heart, if e is close enough to the Heart to defend it.
export function heartFoe(e) {
    const cx = G.hx + 0.5;
    const cy = G.hy + 0.5;
    if (Math.hypot(e.x - cx, e.y - cy) > CFG.imp.defendRange) {
        return null;
    }
    let best = null;
    let bd = 1 / 0;
    for (const o of G.ents) {
        if (o.dead || o.held || o.side !== 1 || Math.hypot(o.x - cx, o.y - cy) > CFG.heart.zapRange) {
            continue;
        }
        const d = Math.hypot(o.x - e.x, o.y - e.y);
        if (d < bd) {
            bd = d;
            best = o;
        }
    }

    return best;
}

export function attack(e, t) {
    const k = KINDS[e.kind];
    const dmg = e.atk * (0.85 + Math.random() * 0.3);
    sound(k.range > 1.5 ? 'shot' : 'hit', e.x, e.y);
    if (k.range > 1.5) {
        fx({ type: 'proj', x: e.x, y: e.y, x1: t.x, y1: t.y, dur: 0.25, col: e.side ? '#bcd2f0' : '#c58cff' });
    } else {
        fx({ type: 'dust', x: (e.x + t.x) / 2, y: (e.y + t.y) / 2, dur: 0.25, col: '#ffffff' });
    }
    e.hitT = 0.4;
    t.hp -= dmg;
    t.hurtT = 0.3;
    if (e.side === 0) {
        gainXP(e, dmg * 0.4);
    }
    if (t.side === 0 && t.kind !== 'imp' && t.state === 'sleep') {
        t.state = 'think';
    }
    if (t.hp <= 0) {
        kill(t);
    }
}

/** A unit's health ran out: slain, or (a hero, with room in your Prison) knocked out and taken prisoner. */
export function kill(t) {
    if (t.side === 1 && t.carry > 0) {
        // a Thief drops the gold it stole; your imps pick it up
        G.pile[ti(t)] += t.carry;
        t.carry = 0;
    }
    if (t.side === 1) {
        const k = KINDS[t.kind];
        const a = addGold(Math.round(k.bounty * ECON.bountyMul));
        fx({ type: 'text', x: t.x, y: t.y, dur: 1.2, txt: '+' + a, col: '#e3b23c' });
        if (capture(t)) {
            return;
        }
    }
    t.dead = true;
    release(t);
    if (t.side === 1) {
        if (t.kind === 'lord') {
            msg('The Lord of the Land has fallen!', 'lord', 'good');
        }
    } else {
        msg((t.kind === 'imp' ? 'An imp' : 'Your ' + KINDS[t.kind].n) + ' has been slain.', 'die' + t.id, 'bad');
    }
    fx({ type: 'death', x: t.x, y: t.y, dur: 1.2, kind: t.kind, face: t.face, side: t.side });
    sound('death', t.x, t.y);
}

/** State `fight`: chase the target and attack it when in range. */
export function fight(e, dt) {
    const t = e.target;
    if (!t || t.dead || t.held || t.side === e.side || t.side >= 2) {
        e.state = 'think';
        e.target = null;

        return;
    }
    const k = KINDS[e.kind];
    const d = Math.hypot(t.x - e.x, t.y - e.y);
    if (d > 13) {
        e.state = 'think';
        e.target = null;

        return;
    }
    if (d <= k.range + 0.35 && clearShot(e, t)) {
        e.path = [];
        e.face = Math.sign(t.x - e.x) || e.face;
        e.aim = Math.atan2(t.y - e.y, t.x - e.x);
        if (e.cd <= 0) {
            attack(e, t);
            e.cd = k.rate / joy(e);
        }

        return;
    }
    e.repath -= dt;
    if (e.repath <= 0 || !e.path.length) {
        e.repath = 0.6;
        const g = ti(t);
        const p = bfs(ti(e), (i) => i === g, 1, walk, 22);
        if (!p) {
            e.state = 'think';
            e.target = null;
            e.ignoreT = G.time + 3;

            return;
        }
        e.path = p;
    }
    step(e, dt);
}

/** The digger of hero e's wave (a Tunneller still alive), if any. */
function digger(e) {
    return G.ents.find((o) => o.side === 1 && !o.dead && o.party === e.party && KINDS[o.kind].tunnels && o !== e);
}

/** Wandering, as Dungeon Keeper heroes do without a way in: on to a random reachable spot within `roam` steps. */
function wander(e, here) {
    e.path = bfs(here, (i) => Math.hypot(tx(i) - tx(here), ty(i) - ty(here)) >= 4, 40, walk, CFG.waves.roam) || [];
    e.repath = 4 + Math.random() * 4;
}

/**
 * State `march` (heroes), after Dungeon Keeper: a Tunneller digs straight for your Heart; the others
 * never dig. They walk to the Heart when there is an open way, else follow their wave's Tunneller
 * through its tunnel, else wander the open caverns and tunnels until a way opens. A Thief goes for your
 * Treasury first and runs back to the Hero Gate with the gold. Next to the Heart they hit it.
 */
export function march(e, dt) {
    const here = ti(e);
    const k = KINDS[e.kind];
    if (k.steals && e.carry > 0) {
        // a Thief with your gold: back to the gate, and gone
        if (here === G.gate) {
            e.dead = true;
            msg('A Thief got away with ' + e.carry + ' of your gold!', 'thief' + e.id, 'bad');

            return;
        }
        e.repath -= dt;
        if (!e.path.length || e.repath <= 0) {
            e.repath = 3;
            e.path = bfs(here, (i) => i === G.gate) || [];
        }
        if (e.path.length) {
            step(e, dt);
        }

        return;
    }
    if (k.steals && G.room[here] === TREAS && G.money > 0) {
        const a = Math.min(k.steals, G.money);
        G.money -= a;
        e.carry = a;
        e.path = [];
        fx({ type: 'text', x: e.x, y: e.y - 0.4, dur: 1.2, txt: '-' + a, col: '#e3b23c' });
        msg('A Thief is stealing from your Treasury!', 'steal' + e.id, 'bad');
        sound('coins', e.x, e.y);

        return;
    }
    if (adjHeart(here)) {
        e.aim = Math.atan2(G.hy + 0.5 - e.y, G.hx + 0.5 - e.x);
        if (e.cd <= 0) {
            e.cd = k.rate;
            e.hitT = 0.4;
            G.heartHP -= e.atk;
            G.heartFlash = 0.25;
            sound('heart', G.hx + 0.5, G.hy + 0.5);
            G.heartAlarm = CFG.imp.defendTime;
            fx({ type: 'dust', x: G.hx + 0.5 + (e.x - G.hx - 0.5) * 0.4, y: G.hy + 0.5 + (e.y - G.hy - 0.5) * 0.4, dur: 0.3, col: '#ff6a4a' });
            msg('Your Dungeon Heart is under attack!', 'heart', 'bad');
        }

        return;
    }
    e.repath -= dt;
    if (!e.path.length || e.repath <= 0) {
        if (k.tunnels) {
            e.repath = 5;
            e.path = dijkstra(here, (i) => adjHeart(i)) || [];
        } else {
            e.repath = 3;
            const thief = k.steals && G.rc[TREAS] && G.money > 0 && bfs(here, (i) => G.room[i] === TREAS);
            const open = thief || bfs(here, (i) => adjHeart(i));
            const lead = !open && digger(e);
            const follow = lead && bfs(here, (i) => i === ti(lead));
            if (open || follow) {
                e.path = open || follow;
            } else {
                wander(e, here);
            }
        }
    }
    const n = e.path[0];
    if (n === undefined) {
        return;
    }
    if (!walk(n)) {
        if (!k.tunnels || !diggable(n)) {
            e.path = [];

            return;
        }
        e.face = Math.sign(tx(n) - tx(here)) || e.face;
        e.aim = Math.atan2(ty(n) - ty(here), tx(n) - tx(here));
        e.digging = 0.3;
        e.timer -= dt;
        if (e.timer > 0) {
            return;
        }
        e.timer = k.dig;
        if (G.hp[n] > 0) {
            G.hp[n]--;
        }
        if (G.hp[n] <= 0) {
            openTile(n);
        }
        fx({ type: 'dust', x: (e.x + tx(n) + 0.5) / 2, y: (e.y + ty(n) + 0.5) / 2, dur: 0.35, col: '#8a6446' });
        sound('dig', tx(n) + 0.5, ty(n) + 0.5);

        return;
    }
    step(e, dt);
}
