/**
 * Every unit's state machine: tick() runs one step for one unit. Before the state's own step it counts
 * down the unit's timers, lets your units pick up treasure and get hungry, and lets everyone look out
 * for enemies (imps flee, or defend the Heart). What each state does is the STATES table.
 */
import { HATCH, HERO, LIB, NEUTRAL, OWN, PRISONER, TRAIN, tx, ty } from './constants.js';
import { ECON, KINDS } from './config.js';
import { collect, creatureThink } from './creatures.js';
import { addGold, arrive, gainXP, go, hasBed, leave, release, research, step, toPool } from './entities.js';
import { fight, heartFoe, joy, nearestEnemy } from './combat.js';
import { march } from './heroes.js';
import { doClaim, doDig, doReinforce, impThink, pickUpPile } from './imps.js';
import { grab, jail, prisonerTick } from './prison.js';
import { bfs } from './path.js';
import { G } from './state.js';
import { adjHeart, ti } from './tiles.js';
import { msg } from './ui.js';
import { fx } from './world.js';

/** One unit's step: wanderers stand still, prisoners have their own (prison.js). */
export function tick(e, dt) {
    if (e.side === NEUTRAL) {
        return;
    }
    if (e.side === PRISONER) {
        prisonerTick(e, dt);

        return;
    }
    countDown(e, dt);
    if (e.side === OWN) {
        findTreasure(e);
        getHungry(e, dt);
    }
    if (e.kind === 'imp') {
        impLookout(e, dt);
    } else {
        lookout(e, dt);
    }
    (STATES[e.state] ?? toThink)(e, dt);
}

/** The attack cooldown, the slap and the short-lived hints for the renderer's animations (not saved). */
function countDown(e, dt) {
    e.cd -= dt;
    for (const k of ['slap', 'hitT', 'hurtT', 'digging']) {
        if (e[k] > 0) {
            e[k] -= dt;
        }
    }
}

/** Your unit on a chest takes what fits in your treasuries. */
function findTreasure(e) {
    const i = ti(e);
    if (G.loot[i] <= 0) {
        return;
    }
    const a = addGold(G.loot[i]);
    if (a > 0) {
        G.loot[i] -= a;
        fx({ type: 'text', x: e.x, y: e.y - 0.3, dur: 1.2, txt: '+' + a, col: '#e3b23c' });
        msg('Treasure found: ' + a + ' gold.', 'loot' + i, 'good');
    }
}

/** Your creatures (not imps, not those that never eat) get hungry; starving, they leave. */
function getHungry(e, dt) {
    if (e.kind === 'imp' || !KINDS[e.kind].eats) {
        return;
    }
    e.hunger += dt * 1.5;
    if (e.hunger >= 200 && !e.leaving) {
        e.hunger = 0;
        leave(e, 'starving');
    }
}

/** Imps flee from heroes, except while the Heart is under attack: then the ones nearby defend it. */
function impLookout(e, dt) {
    if (e.state === 'stun' || e.state === 'fight' || (e.scan -= dt) > 0) {
        return;
    }
    e.scan = 0.5;
    const h = G.heartAlarm > 0 && heartFoe(e);
    if (h) {
        attackNow(e, h);
    } else if (e.state !== 'flee') {
        const o = nearestEnemy(e, 3.2);
        if (o) {
            release(e);
            const p = bfs(ti(e), (i) => adjHeart(i) && Math.hypot(tx(i) - o.x, ty(i) - o.y) > 3, 1);
            if (p && p.length) {
                go(e, p, 'idle', 3);
                e.state = 'flee';
            }
        }
    }
}

/** Creatures and heroes attack the nearest enemy they see (heroes within 5 tiles, your creatures 8). */
function lookout(e, dt) {
    if (e.state === 'fight' || e.state === 'stun' || e.leaving || (e.scan -= dt) > 0) {
        return;
    }
    e.scan = 0.5;
    if (G.time < e.ignoreT) {
        return;
    }
    const o = nearestEnemy(e, e.side === HERO ? 5 : 8);
    if (o) {
        attackNow(e, o);
    }
}

function attackNow(e, target) {
    release(e);
    e.state = 'fight';
    e.target = target;
    e.path = [];
    e.repath = 0;
}

const toThink = (e) => {
    e.state = 'think';
};

/** A state that ends with `done` once its timer runs out. */
const timed = (done) => (e, dt) => {
    if ((e.timer -= dt) <= 0) {
        done(e);
    }
};

/** Work in a room of `room`: the unit stops when it is not on one (or when `stop()`), else does `work`. */
const inRoom = (room, work, stop = () => false) => (e, dt) => {
    if (G.room[ti(e)] !== room || stop()) {
        toThink(e);

        return;
    }
    work(e, dt);
};

const done = timed(toThink);

/** What each state does, one step. An unknown state goes back to `think`. */
const STATES = {
    // dazed after a drop: then on with what the drop started (a room's work, a bed), or think
    stun: timed((e) => {
        if (e.after) {
            [e.state, e.timer] = e.after;
            e.after = null;
        } else {
            toThink(e);
        }
    }),
    think: (e) => {
        e.boost = 1;
        if (e.side === HERO) {
            e.state = e.guard ? 'guard' : 'march';
            e.path = [];
            e.repath = 0;
        } else if (e.kind === 'imp') {
            impThink(e);
        } else {
            creatureThink(e);
        }
    },
    guard: () => {},
    walk: (e, dt) => step(e, dt) && arrive(e),
    flee: (e, dt) => step(e, dt) && arrive(e),
    idle: done,
    cheer: done,
    dig: doDig,
    claim: doClaim,
    reinforce: doReinforce,
    pickup: timed(pickUpPile),
    collect: timed(collect),
    grab,
    jail,
    // asleep on its own bed until healed, and for a nap at least `timer` seconds
    sleep: (e, dt) => {
        if (ti(e) !== e.bed || !hasBed(e)) {
            toThink(e);

            return;
        }
        e.hp = Math.min(e.maxhp, e.hp + e.maxhp * 0.06 * dt);
        e.timer -= dt;
        if (e.hp >= e.maxhp && e.timer <= 0) {
            toThink(e);
        }
    },
    eat: inRoom(HATCH, timed((e) => {
        e.hunger = 0;
        e.hp = Math.min(e.maxhp, e.hp + e.maxhp * 0.15);
        toThink(e);
    })),
    // training costs gold per second; with none left it stops
    train: inRoom(TRAIN, (e, dt) => {
        G.money = Math.max(0, G.money - ECON.trainCost * dt);
        gainXP(e, KINDS[e.kind].train * (e.boost || 1) * joy(e) * dt);
        done(e, dt);
    }, () => G.money <= 0),
    study: inRoom(LIB, (e, dt) => {
        research(dt * KINDS[e.kind].study * (e.boost || 1) * joy(e));
        done(e, dt);
    }),
    fight,
    march,
    leave: (e, dt) => {
        if (step(e, dt)) {
            e.dead = true;
            toPool(e);
            fx({ type: 'ring', x: e.x, y: e.y, dur: 0.6, col: '#9b6bf0' });
        }
    },
};
