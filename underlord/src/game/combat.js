/**
 * Fighting: line of sight for shots, picking targets, attacks, kills and bounties. How heroes move
 * through the map is heroes.js.
 */
import { sound } from './audio.js';
import { HERO, OWN, foes, inb, ix } from './constants.js';
import { CFG, ECON, KINDS } from './config.js';
import { addGold, gainXP, release, step } from './entities.js';
import { bfs } from './path.js';
import { G } from './state.js';
import { capture } from './prison.js';
import { ti, transp, walk } from './tiles.js';
import { msg } from './ui.js';
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
        if (o.dead || o.held || !foes(e, o)) {
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
        if (o.dead || o.held || o.side !== HERO || Math.hypot(o.x - cx, o.y - cy) > CFG.heart.zapRange) {
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
        fx({ type: 'proj', x: e.x, y: e.y, x1: t.x, y1: t.y, dur: 0.25, col: e.side === HERO ? '#bcd2f0' : '#c58cff' });
    } else {
        fx({ type: 'dust', x: (e.x + t.x) / 2, y: (e.y + t.y) / 2, dur: 0.25, col: '#ffffff' });
    }
    e.hitT = 0.4;
    t.hp -= dmg;
    t.hurtT = 0.3;
    if (e.side === OWN) {
        gainXP(e, dmg * 0.4);
    }
    if (t.side === OWN && t.kind !== 'imp' && t.state === 'sleep') {
        t.state = 'think';
    }
    if (t.hp <= 0) {
        kill(t);
    }
}

/** A unit's health ran out: slain, or (a hero, with room in your Prison) knocked out and taken prisoner. */
export function kill(t) {
    if (t.side === HERO && t.carry > 0) {
        // a Thief drops the gold it stole; your imps pick it up
        G.pile[ti(t)] += t.carry;
        t.carry = 0;
    }
    if (t.side === HERO) {
        const k = KINDS[t.kind];
        const a = addGold(Math.round(k.bounty * ECON.bountyMul));
        fx({ type: 'text', x: t.x, y: t.y, dur: 1.2, txt: '+' + a, col: '#e3b23c' });
        if (capture(t)) {
            return;
        }
    }
    t.dead = true;
    release(t);
    if (t.side === HERO) {
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
    if (!t || t.dead || t.held || !foes(e, t)) {
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
