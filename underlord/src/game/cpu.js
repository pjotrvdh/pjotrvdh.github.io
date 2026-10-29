/**
 * The Computer Assistant, modelled on Dungeon Keeper 1's: Aggressive, Defensive, Construction only or
 * Move only. cpuTick() runs every update(); every `assistant.interval` seconds it does what its mode allows.
 */
import { CLAIM, EARTH, GEM, GOLD, H, HATCH, HERO, LAIR, LIB, N, N4, OWN, TRAIN, TREAS, W, WALL, inb, ix, rand, tx, ty } from './constants.js';
import { CFG, ROOMS, SPELLS } from './config.js';
import { activity, build, cast, dropHeld, impCost, pickUp, recount, spellCost } from './actions.js';
import { clearShot } from './combat.js';
import { creatures } from './entities.js';
import { bfs, dijkstra, hcost } from './path.js';
import { G } from './state.js';
import { adjHeart, anyPortal, cap, diggable, nb, ti, walk } from './tiles.js';
import { msg } from './ui.js';

const CPU_DOES = {
    aggressive: { build: 1, move: 1, attack: 1 },
    defensive: { build: 1, move: 1, guard: 1 },
    construction: { build: 1 },
    move: { move: 1 },
};

export function cpuTick(dt) {
    const c = G.cpu;
    if (!c || !c.on) {
        return;
    }
    if ((c.t -= dt) > 0) {
        return;
    }
    c.t = CFG.assistant.interval;
    const d = CPU_DOES[c.mode] || {};
    if (d.build) {
        cpuBuild();
    }
    if (d.move) {
        cpuMove();
    }
    if (d.attack || d.guard) {
        cpuSpells(!!d.attack);
    }
}

const marksCount = () => {
    let n = 0;
    for (let i = 0; i < N; i++) {
        n += G.mark[i];
    }

    return n;
};

// Walls are only marked when `walls` is set: the paths below cost more through walls, so they only cross one when there is no other way.
function cpuMark(list, walls) {
    let n = marksCount();
    for (const i of list) {
        if (n >= CFG.assistant.maxMarks) {
            break;
        }
        if (diggable(i) && (walls || G.t[i] !== WALL) && !G.mark[i]) {
            G.mark[i] = 1;
            n++;
        }
    }
}

function cpuBuild() {
    const A = CFG.assistant;
    // 1. tunnel to the nearest portal until one is ours
    if (!anyPortal()) {
        for (const P of G.portals.slice().sort((a, b) => Math.hypot(tx(a) - G.hx, ty(a) - G.hy) - Math.hypot(tx(b) - G.hx, ty(b) - G.hy))) {
            const p = dijkstra(P, (i) => G.t[i] === CLAIM);
            if (p) {
                cpuMark(p, true);
                break;
            }
        }
    }
    // 2. tunnel to the nearest gold seam (gold glints through the clouds, so the player knows where it is)
    if (G.money < cap() * 0.9 && marksCount() < A.maxMarks / 2) {
        const p = dijkstra(ix(G.hx + 2, G.hy), (i) => (G.t[i] === GOLD || (G.t[i] === GEM && G.money < cap() * 0.5)) && !G.mark[i], (i) => (G.t[i] === GEM ? 6 : hcost(i)));
        if (p) {
            cpuMark(p, true);
        }
    }
    // 3. rooms, in the order a keeper needs them
    const cre = creatures().length;
    const want = [
        [LAIR, Math.max(4, cre + 2)],
        [HATCH, 4],
        [TREAS, G.money > cap() * 0.75 ? G.rc[TREAS] + 4 : Math.max(G.rc[TREAS], 2)],
        [TRAIN, cre >= 3 ? 9 : 0],
        [LIB, cre >= 3 ? 9 : 0],
        [HATCH, cre >= 5 ? 9 : 4],
        [LAIR, cre >= 5 ? Math.max(9, cre + 2) : 0],
    ];
    let short = false;
    for (const [r, n] of want) {
        if (G.rc[r] >= n) {
            continue;
        }
        const cost = ROOMS[r].cost;
        let need = n - G.rc[r];
        if (G.money - A.reserveGold < cost * need) {
            need = Math.floor((G.money - A.reserveGold) / cost);
        }
        if (need <= 0) {
            break;
        }
        const seeds = [];
        for (let i = 0; i < N; i++) {
            if (G.room[i] === r) {
                seeds.push(i);
            }
        }
        const free = [];
        const seen = new Uint8Array(N);
        const q = seeds.length ? seeds : [ix(G.hx + 2, G.hy)];
        for (const i of q) {
            seen[i] = 1;
        }
        for (let h = 0; h < q.length && free.length < need; h++) {
            const c = q[h];
            if (G.t[c] === CLAIM && !G.room[c] && !adjHeart(c)) {
                free.push(c);
            }
            for (const [dx, dy] of N4) {
                const a = tx(c) + dx;
                const b = ty(c) + dy;
                if (!inb(a, b)) {
                    continue;
                }
                const k = ix(a, b);
                if (!seen[k] && G.t[k] === CLAIM) {
                    seen[k] = 1;
                    q.push(k);
                }
            }
        }
        for (const i of free) {
            build(i, r);
        }
        if (free.length) {
            msg('Assistant: built ' + free.length + ' ' + ROOMS[r].n + ' tile' + (free.length > 1 ? 's' : '') + '.', 'cpu-b' + r);
        }
        recount();
        if (free.length < need) {
            short = true;
            break;
        }
    }
    // 4. out of floor space: dig out a 3x3 block of earth next to your territory, close to the Heart
    if (short && marksCount() < A.maxMarks / 2) {
        const p = bfs(ix(G.hx + 2, G.hy), (i) => G.t[i] === CLAIM && nb(i, (j) => G.t[j] === EARTH || G.t[j] === WALL) >= 0, 4, (i) => G.t[i] === CLAIM);
        if (p) {
            const end = p.length ? p[p.length - 1] : ix(G.hx + 2, G.hy);
            const e = nb(end, (j) => G.t[j] === EARTH || G.t[j] === WALL);
            const blk = [];
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const x = tx(e) + (tx(e) - tx(end)) + dx;
                    const y = ty(e) + (ty(e) - ty(end)) + dy;
                    if (x > 0 && y > 0 && x < W - 1 && y < H - 1) {
                        blk.push(ix(x, y));
                    }
                }
            }
            blk.push(e);
            for (const i of blk) {
                if (G.t[i] === WALL && !G.mark[i]) {
                    G.mark[i] = 1;
                }
            }
            cpuMark(blk);
        }
    }
    // 5. enough imps for the size of the dungeon
    let claimed = 0;
    for (let i = 0; i < N; i++) {
        claimed += G.t[i] === CLAIM;
    }
    const imps = G.ents.filter((e) => e.kind === 'imp' && e.side === OWN).length;
    if (imps < Math.min(A.maxImps, CFG.imp.startCount + Math.floor(claimed / A.impsPerClaimed)) && G.money > impCost() + A.reserveGold) {
        const r = [];
        for (let i = 0; i < N; i++) {
            if (G.t[i] === CLAIM && adjHeart(i)) {
                r.push(i);
            }
        }
        if (r.length) {
            cast('imp', r[rand(r.length)]);
            msg('Assistant: summoned an imp.', 'cpu-imp');
        }
    }
}

function cpuMove() {
    const heroes = G.ents.filter((e) => e.side === HERO && !e.dead && !e.guard && G.seen[ti(e)]);
    if (heroes.length) {
        const tgt = heroes.reduce((a, b) => (Math.hypot(a.x - G.hx, a.y - G.hy) < Math.hypot(b.x - G.hx, b.y - G.hy) ? a : b));
        let drop = -1;
        let bd = 9;
        for (let dy = -4; dy <= 4; dy++) {
            for (let dx = -4; dx <= 4; dx++) {
                const x = Math.floor(tgt.x) + dx;
                const y = Math.floor(tgt.y) + dy;
                if (!inb(x, y)) {
                    continue;
                }
                const i = ix(x, y);
                const d = Math.hypot(x + 0.5 - tgt.x, y + 0.5 - tgt.y);
                if (G.t[i] === CLAIM && d >= 1.5 && d < bd && clearShot({ x: x + 0.5, y: y + 0.5 }, tgt)) {
                    bd = d;
                    drop = i;
                }
            }
        }
        if (drop >= 0) {
            let n = 0;
            const ready = creatures().filter((e) => !e.leaving && activity(e) !== 'fighting' && e.hp > e.maxhp * 0.6 && Math.hypot(e.x - tgt.x, e.y - tgt.y) > 8).sort((a, b) => b.lvl - a.lvl);
            for (const e of ready) {
                if (n >= 3 || !pickUp(e)) {
                    break;
                }
                dropHeld(drop);
                n++;
            }
            if (n) {
                msg('Assistant: dropped ' + n + ' creature' + (n > 1 ? 's' : '') + ' on the invaders.', 'cpu-mv');
            }
        }

        return;
    }
    // in peace time, put one idle creature to work in the Training Room
    if (G.rc[TRAIN] && G.money > CFG.assistant.reserveGold) {
        const e = creatures().find((e) => !e.leaving && activity(e) === 'idle' && e.lvl < 10 && e.hunger < 80);
        if (e) {
            const t = [];
            for (let i = 0; i < N; i++) {
                if (G.room[i] === TRAIN) {
                    t.push(i);
                }
            }
            if (t.length && pickUp(e)) {
                dropHeld(t[rand(t.length)]);
            }
        }
    }
}

function cpuSpells(aggressive) {
    const A = CFG.assistant;
    const heroes = G.ents.filter((e) => e.side === HERO && !e.dead && G.seen[ti(e)] && (aggressive ? !e.guard : Math.hypot(e.x - G.hx, e.y - G.hy) < 8));
    if (heroes.length && G.research >= SPELLS.bolt.req && G.money > SPELLS.bolt.cost + A.reserveGold) {
        let best = null;
        let bn = 0;
        for (const h of heroes) {
            const n = heroes.filter((o) => Math.hypot(o.x - h.x, o.y - h.y) < SPELLS.bolt.radius).length;
            if (n > bn) {
                bn = n;
                best = h;
            }
        }
        if (best) {
            cast('bolt', ti(best), best.x, best.y);
        }
    }
    if (aggressive && heroes.length && G.research >= SPELLS.rally.req && !(G.rally && G.time < G.rally.until)) {
        const h = heroes[0];
        const p = bfs(ti(h), walk, 1, walk, 6);
        const i = p && (p.length ? p[p.length - 1] : ti(h));
        if (p && G.money > spellCost('rally', i) + A.reserveGold) {
            cast('rally', i, h.x, h.y);
        }
    }
    if (!aggressive && G.research >= SPELLS.heal.req && G.money > SPELLS.heal.cost + A.reserveGold) {
        const hurt = creatures().find((e) => activity(e) === 'fighting' && e.hp < e.maxhp * 0.4);
        if (hurt) {
            cast('heal', ti(hurt), hurt.x, hurt.y);
        }
    }
}
