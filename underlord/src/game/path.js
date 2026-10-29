/**
 * Path finding on the tile grid: bfs() for units that only walk, dijkstra() for heroes, who tunnel
 * through earth, gold and walls at a cost (hcost()). Paths are lists of tile indices, start excluded.
 */
import { EARTH, GOLD, N, N4, WALL, inb, ix, rand, tx, ty } from './constants.js';
import { G } from './state.js';
import { walk } from './tiles.js';

function buildPath(prev, g, start) {
    const p = [];
    let c = g;
    while (c !== start && c >= 0) {
        p.push(c);
        c = prev[c];
    }

    return p.reverse();
}

/**
 * 4-neighbour breadth-first search from `start` over tiles where `pass` holds. Collects up to `k` goal
 * tiles and returns the path to a random one of them: [] if that goal is the start, null if none.
 */
export function bfs(start, goal, k = 1, pass = walk, maxLen = 1e9) {
    const m = [];
    if (goal(start)) {
        m.push(start);
    }
    const prev = new Int32Array(N).fill(-2);
    prev[start] = -1;
    const q = [start];
    const dep = new Int16Array(N);
    let h = 0;
    while (h < q.length && m.length < k) {
        const c = q[h++];
        if (dep[c] >= maxLen) {
            continue;
        }
        const x = tx(c);
        const y = ty(c);
        for (const [dx, dy] of N4) {
            const a = x + dx;
            const b = y + dy;
            if (!inb(a, b)) {
                continue;
            }
            const n = ix(a, b);
            if (prev[n] !== -2 || !pass(n)) {
                continue;
            }
            prev[n] = c;
            dep[n] = dep[c] + 1;
            q.push(n);
            if (goal(n)) {
                m.push(n);
                if (m.length >= k) {
                    break;
                }
            }
        }
    }
    if (!m.length) {
        return null;
    }
    const g = m[rand(m.length)];

    return g === start ? [] : buildPath(prev, g, start);
}

/** What a step costs a tunnelling hero: walkable 1, earth 4, gold 6, reinforced wall 12; -1 = impassable. */
export function hcost(i) {
    if (walk(i)) {
        return 1;
    }
    const t = G.t[i];

    return t === EARTH ? 4 : t === GOLD ? 6 : t === WALL ? 12 : -1;
}

/** Cheapest path from `start` to the nearest tile where `goal` holds, or null. */
export function dijkstra(start, goal, cost = hcost) {
    const dist = new Float32Array(N).fill(1e9);
    const prev = new Int32Array(N).fill(-1);
    const hp = [];
    const push = (d, i) => {
        hp.push([d, i]);
        let c = hp.length - 1;
        while (c > 0) {
            const p = (c - 1) >> 1;
            if (hp[p][0] <= hp[c][0]) {
                break;
            }
            [hp[p], hp[c]] = [hp[c], hp[p]];
            c = p;
        }
    };
    const pop = () => {
        const top = hp[0];
        const l = hp.pop();
        if (hp.length) {
            hp[0] = l;
            let c = 0;
            for (;;) {
                const a = 2 * c + 1;
                const b = a + 1;
                let s = c;
                if (a < hp.length && hp[a][0] < hp[s][0]) {
                    s = a;
                }
                if (b < hp.length && hp[b][0] < hp[s][0]) {
                    s = b;
                }
                if (s === c) {
                    break;
                }
                [hp[s], hp[c]] = [hp[c], hp[s]];
                c = s;
            }
        }

        return top;
    };
    dist[start] = 0;
    push(0, start);
    while (hp.length) {
        const [d, c] = pop();
        if (d > dist[c]) {
            continue;
        }
        if (goal(c)) {
            return buildPath(prev, c, start);
        }
        const x = tx(c);
        const y = ty(c);
        for (const [dx, dy] of N4) {
            const a = x + dx;
            const b = y + dy;
            if (!inb(a, b)) {
                continue;
            }
            const n = ix(a, b);
            const k = cost(n);
            if (k < 0) {
                continue;
            }
            if (d + k < dist[n]) {
                dist[n] = d + k;
                prev[n] = c;
                push(d + k, n);
            }
        }
    }

    return null;
}
