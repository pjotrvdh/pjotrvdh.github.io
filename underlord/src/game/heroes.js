/**
 * How heroes move through the map (state `march`), after Dungeon Keeper. Each wave is one party. A
 * Tunneller digs straight for your Heart; the others never dig: they walk to the Heart when there is an
 * open way, else follow their party's Tunneller through its tunnel, else wander the open caverns and
 * tunnels until a way opens. A Thief goes for your Treasury first and runs back to the Hero Gate with
 * the gold. Next to the Heart they hit it. Fighting is combat.js.
 */
import { sound } from './audio.js';
import { HERO, TREAS, tx, ty } from './constants.js';
import { CFG, KINDS } from './config.js';
import { openTile, step } from './entities.js';
import { bfs, dijkstra } from './path.js';
import { G } from './state.js';
import { adjHeart, diggable, ti, walk } from './tiles.js';
import { msg } from './ui.js';
import { fx } from './world.js';

/** State `march`: one step for a hero. */
export function march(e, dt) {
    const here = ti(e);
    const k = KINDS[e.kind];
    if (k.steals && (e.carry > 0 ? getAway(e, here, dt) : steal(e, here, k))) {
        return;
    }
    if (adjHeart(here)) {
        hitHeart(e, k);

        return;
    }
    e.repath -= dt;
    if (!e.path.length || e.repath <= 0) {
        plan(e, here, k);
    }
    advance(e, here, k, dt);
}

/** Picks the hero's path: a Tunneller's straight dig, else an open way (a Thief's to a Treasury), its Tunneller, or a wander. */
function plan(e, here, k) {
    if (k.tunnels) {
        e.repath = 5;
        e.path = dijkstra(here, (i) => adjHeart(i)) || [];

        return;
    }
    e.repath = 3;
    const loot = k.steals && G.rc[TREAS] && G.money > 0 && bfs(here, (i) => G.room[i] === TREAS);
    const open = loot || bfs(here, (i) => adjHeart(i));
    const lead = !open && digger(e);
    const follow = lead && bfs(here, (i) => i === ti(lead));
    if (open || follow) {
        e.path = open || follow;
    } else {
        wander(e, here);
    }
}

/** One step along the path: a walk, or for a Tunneller a blow at the block in the way. */
function advance(e, here, k, dt) {
    const n = e.path[0];
    if (n === undefined) {
        return;
    }
    if (walk(n)) {
        step(e, dt);

        return;
    }
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
}

/** Next to the Heart: a blow every `rate` seconds, and the alarm that calls your imps. */
function hitHeart(e, k) {
    e.aim = Math.atan2(G.hy + 0.5 - e.y, G.hx + 0.5 - e.x);
    if (e.cd > 0) {
        return;
    }
    e.cd = k.rate;
    e.hitT = 0.4;
    G.heartHP -= e.atk;
    G.heartFlash = 0.25;
    sound('heart', G.hx + 0.5, G.hy + 0.5);
    G.heartAlarm = CFG.imp.defendTime;
    fx({ type: 'dust', x: G.hx + 0.5 + (e.x - G.hx - 0.5) * 0.4, y: G.hy + 0.5 + (e.y - G.hy - 0.5) * 0.4, dur: 0.3, col: '#ff6a4a' });
    msg('Your Dungeon Heart is under attack!', 'heart', 'bad');
}

/** A Thief on a Treasury tile takes `steals` gold; true when it did. */
function steal(e, here, k) {
    if (G.room[here] !== TREAS || G.money <= 0) {
        return false;
    }
    const a = Math.min(k.steals, G.money);
    G.money -= a;
    e.carry = a;
    e.path = [];
    fx({ type: 'text', x: e.x, y: e.y - 0.4, dur: 1.2, txt: '-' + a, col: '#e3b23c' });
    msg('A Thief is stealing from your Treasury!', 'steal' + e.id, 'bad');
    sound('coins', e.x, e.y);

    return true;
}

/** A Thief with your gold runs back to the Hero Gate and is gone (slain, it drops the gold: kill()). Always true. */
function getAway(e, here, dt) {
    if (here === G.gate) {
        e.dead = true;
        msg('A Thief got away with ' + e.carry + ' of your gold!', 'thief' + e.id, 'bad');

        return true;
    }
    e.repath -= dt;
    if (!e.path.length || e.repath <= 0) {
        e.repath = 3;
        e.path = bfs(here, (i) => i === G.gate) || [];
    }
    if (e.path.length) {
        step(e, dt);
    }

    return true;
}

/** The digger of hero e's party (a Tunneller still alive), if any. */
function digger(e) {
    return G.ents.find((o) => o.side === HERO && !o.dead && o.party === e.party && KINDS[o.kind].tunnels && o !== e);
}

/** Wandering, as Dungeon Keeper heroes do without a way in: on to a random reachable spot within `roam` steps. */
function wander(e, here) {
    e.path = bfs(here, (i) => Math.hypot(tx(i) - tx(here), ty(i) - ty(here)) >= 4, 40, walk, CFG.waves.roam) || [];
    e.repath = 4 + Math.random() * 4;
}
