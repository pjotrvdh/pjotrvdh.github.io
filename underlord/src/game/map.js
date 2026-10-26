/**
 * A new dungeon: genMap() digs the random map (Heart, gold, lava, gems, caverns, portal, Hero Gate),
 * newGame() creates the game state around it, and vision() reveals what your units can see.
 */
import { CLAIM, EARTH, FLOOR, GATE, GEM, GOLD, H, HEART, N, N4, PORTAL, ROCK, W, inb, ix, rand, tx, ty } from './constants.js';
import { ATTRACT, CFG, ECON, HEART_CAP, KINDS } from './config.js';
import { spawn } from './entities.js';
import { dijkstra } from './path.js';
import { G, setG } from './state.js';
import { adjHeart, ti, transp } from './tiles.js';
import { clearLog, msg, syncCpu } from './ui.js';
import { fx } from './world.js';
import { view } from '../render/view.js';

/** Gem seams, hidden caverns and how far each cavern winds (steps of 2 x 2 tiles), for the 80 x 52 map. */
const GEMS = 6;
const CAVES = 14;
const CAVE_STEPS = 18;

function genMap() {
    let caves = [];
    for (let tries = 0; tries < 40; tries++) {
        const t = new Uint8Array(N).fill(EARTH);
        caves = [];
        for (let x = 0; x < W; x++) {
            t[ix(x, 0)] = ROCK;
            t[ix(x, H - 1)] = ROCK;
        }
        for (let y = 0; y < H; y++) {
            t[ix(0, y)] = ROCK;
            t[ix(W - 1, y)] = ROCK;
        }
        const blob = (type, n, len) => {
            for (let k = 0; k < n; k++) {
                let x = 2 + rand(W - 4);
                let y = 2 + rand(H - 4);
                for (let s = 0; s < len; s++) {
                    if (x > 0 && y > 0 && x < W - 1 && y < H - 1) {
                        t[ix(x, y)] = type;
                    }
                    const [dx, dy] = N4[rand(4)];
                    x += dx;
                    y += dy;
                }
            }
        };
        blob(GOLD, ECON.goldVeins, 7);
        for (let k = 0; k < GEMS; k++) {
            t[ix(16 + rand(W - 22), 3 + rand(H - 6))] = GEM;
        }
        const hx = 5;
        const hy = H >> 1;
        // hidden caverns
        for (let k = 0; k < CAVES; k++) {
            let cx = 0;
            let cy = 0;
            let ok = false;
            for (let a = 0; a < 30 && !ok; a++) {
                cx = 13 + rand(W - 20);
                cy = 3 + rand(H - 6);
                ok = caves.every((c) => Math.hypot(c.x - cx, c.y - cy) > 9);
            }
            const cells = [];
            let x = cx;
            let y = cy;
            for (let s = 0; s < CAVE_STEPS; s++) {
                for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
                    const a = x + dx;
                    const b = y + dy;
                    if (a > 1 && b > 1 && a < W - 2 && b < H - 2) {
                        t[ix(a, b)] = FLOOR;
                        cells.push(ix(a, b));
                    }
                }
                const [dx, dy] = N4[rand(4)];
                x = Math.max(2, Math.min(W - 4, x + dx));
                y = Math.max(2, Math.min(H - 4, y + dy));
            }
            caves.push({ x: cx, y: cy, cells });
        }
        for (let dy = -4; dy <= 4; dy++) {
            for (let dx = -4; dx <= 4; dx++) {
                const x = hx + dx;
                const y = hy + dy;
                if (x > 0 && y > 0 && x < W - 1 && y < H - 1) {
                    t[ix(x, y)] = EARTH;
                }
            }
        }
        for (let dy = -3; dy <= 3; dy++) {
            for (let dx = -3; dx <= 3; dx++) {
                const x = hx + dx;
                const y = hy + dy;
                if (x > 0 && y > 0) {
                    t[ix(x, y)] = Math.abs(dx) <= 1 && Math.abs(dy) <= 1 ? HEART : CLAIM;
                }
            }
        }
        for (let y = hy - 2; y <= hy + 1; y++) {
            t[ix(hx + 5, y)] = GOLD;
        }
        // One portal, a short tunnel from the Heart: above or below it, just past the gold seam.
        const up = Math.random() < 0.5;
        const portals = [];
        {
            const x = 12 + rand(3);
            const y = hy + (up ? -1 : 1) * (4 + rand(3));
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    t[ix(x + dx, y + dy)] = FLOOR;
                }
            }
            t[ix(x, y)] = PORTAL;
            portals.push(ix(x, y));
        }
        const gx = W - 4;
        const gy = 4 + rand(H - 8);
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                t[ix(gx + dx, gy + dy)] = FLOOR;
            }
        }
        t[ix(gx, gy)] = GATE;
        G.t = t;
        G.hx = hx;
        G.hy = hy;
        G.portals = portals;
        G.portal = portals[0];
        G.gate = ix(gx, gy);
        if (dijkstra(G.gate, (i) => adjHeart(i))) {
            break;
        }
    }
    for (let i = 0; i < N; i++) {
        G.hp[i] = G.t[i] === GOLD ? 5 : 3;
        G.gold[i] = G.t[i] === GOLD ? ECON.seamGold : 0;
    }
    // populate the caverns (hero camp in the one farthest from the heart)
    caves.sort((a, b) => Math.hypot(b.x - G.hx, b.y - G.hy) - Math.hypot(a.x - G.hx, a.y - G.hy));
    caves.forEach((c, k) => {
        const cells = [...new Set(c.cells)].filter((i) => G.t[i] === FLOOR && Math.hypot(tx(i) - tx(G.gate), ty(i) - ty(G.gate)) > 4);
        if (cells.length < 3) {
            return;
        }
        const pick = () => cells.splice(rand(cells.length), 1)[0];
        if (k === 0) {
            const a = pick();
            const b = pick();
            G.loot[pick()] = 600;
            for (const [kind, i] of [['knight', a], ['archer', b]]) {
                const e = spawn(kind, tx(i), ty(i));
                e.guard = true;
                e.state = 'guard';
            }
        } else if (k <= 2) {
            const i = pick();
            const e = spawn(k === 1 ? 'orc' : 'troll', tx(i), ty(i));
            e.side = 2;
            e.state = 'neutral';
            G.loot[pick()] = 200;
        } else {
            G.loot[pick()] = 250;
            G.loot[pick()] = 150;
        }
    });
}

export function newGame() {
    const old = G;
    setG({
        t: null, room: new Uint8Array(N), mark: new Uint8Array(N), hp: new Uint8Array(N), gold: new Int16Array(N), seen: new Uint8Array(N), loot: new Int16Array(N), pile: new Int16Array(N),
        res: new Map(), rc: [0, 0, 0, 0, 0, 0, 0], ents: [], fx: [], money: ECON.startGold, heartHP: CFG.heart.hp, heartMax: CFG.heart.hp, heartFlash: 0, heartAlarm: 0,
        time: 0, nextWave: CFG.waves.first, zapT: 0, wave: 0, spawnQ: [], research: 0, payT: ECON.payInterval, pown: new Uint8Array(N),
        pool: Object.fromEntries(Object.keys(ATTRACT).map((k) => [k, KINDS[k].pool])), portalT: CFG.portal.firstArrival, idc: 1,
        held: [], over: null, rally: null, msgCd: {}, visT: 0,
        cpu: { on: !!(old && old.cpu && old.cpu.on), mode: (old && old.cpu && old.cpu.mode) || 'defensive', t: 0 },
    });
    genMap();
    const ring = [];
    for (let i = 0; i < N; i++) {
        if (G.t[i] === CLAIM) {
            ring.push(i);
        }
    }
    for (let k = 0; k < CFG.imp.startCount; k++) {
        const i = ring[rand(ring.length)];
        spawn('imp', tx(i), ty(i));
    }
    for (let i = 0; i < N; i++) {
        if (Math.hypot(tx(i) - G.hx, ty(i) - G.hy) <= 4.3 || G.portals.some((p) => Math.abs(tx(i) - tx(p)) <= 1 && Math.abs(ty(i) - ty(p)) <= 1)) {
            G.seen[i] = 1;
        }
    }
    vision();
    clearLog();
    msg('A portal glows in the dark near your Heart. Dig a tunnel and claim it to attract creatures.');
    msg('Click or drag a box over earth to mark it for digging. Right-click drops and slaps.');
    msg('Build a Treasury: your Heart holds only ' + HEART_CAP + ' gold.');
    view.centerOn(G.hx, G.hy);
    syncCpu();
}

/* ---------- vision ---------- */
const VIS = {};

/** Tile offsets within radius R. */
function offsets(R) {
    if (VIS[R]) {
        return VIS[R];
    }
    const o = [];
    for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
            if (dx * dx + dy * dy <= R * R + 0.5) {
                o.push([dx, dy]);
            }
        }
    }

    return (VIS[R] = o);
}

/** Line of sight from tile (x0, y0) to tile (x1, y1): every tile in between lets sight through. */
function los(x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 3);
    for (let k = 1; k < n; k++) {
        const x = Math.floor(x0 + 0.5 + dx * k / n);
        const y = Math.floor(y0 + 0.5 + dy * k / n);
        if (x === x1 && y === y1) {
            return true;
        }
        if (x === x0 && y === y0) {
            continue;
        }
        if (!transp(ix(x, y))) {
            return false;
        }
    }

    return true;
}

/** Marks what your units see as seen (permanently), and lets wandering creatures you meet join you. */
export function vision() {
    let dirty = false;
    for (const e of G.ents) {
        if (e.dead || e.held || e.side !== 0) {
            continue;
        }
        const cx = Math.floor(e.x);
        const cy = Math.floor(e.y);
        for (const [dx, dy] of offsets(KINDS[e.kind].vision)) {
            const x = cx + dx;
            const y = cy + dy;
            if (!inb(x, y)) {
                continue;
            }
            const i = ix(x, y);
            if (G.seen[i]) {
                continue;
            }
            if (los(cx, cy, x, y)) {
                G.seen[i] = 1;
                dirty = true;
            }
        }
    }
    for (const n of G.ents) {
        if (n.side !== 2 || n.dead || !G.seen[ti(n)]) {
            continue;
        }
        if (G.ents.some((o) => o.side === 0 && !o.held && !o.dead && Math.hypot(o.x - n.x, o.y - n.y) < 3)) {
            n.side = 0;
            n.state = 'think';
            fx({ type: 'ring', x: n.x, y: n.y, dur: 0.8, col: '#e0483c' });
            msg('A wandering ' + KINDS[n.kind].n + ' joins your dungeon.', 'join' + n.id, 'good');
        }
    }
    if (dirty) {
        G.fogDirty = true;
    }
}
