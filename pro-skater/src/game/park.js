/**
 * The park: the pieces placed by a map (config/parks) and the collision grid the skater rides on.
 *
 * The grid holds `world.samples` × `world.samples` height samples per tile, measured from the models'
 * own triangles, so the ramps you ride have exactly the shape you see:
 * - `ground`: the surface you roll and land on (every piece except `solid` ones);
 * - `top`: the highest point, solid pieces included (rails, benches): what you have to jump over;
 * - `vert`: 1 where a `vert` piece slopes (a transition), with the way its low side faces in `facingX`/`facingZ`.
 *
 * World coordinates are metres: x east, z south, y up; tile (col, row) spans
 * [col × tile, (col + 1) × tile] on x and the same for row on z. Outside the park everything is a wall.
 * Plain data and maths only: this module doesn't use three.js.
 */
import { PIECE_CODES, TURNS } from '../config/parks/index.js';

/**
 * Turns a map into tiles.
 *
 * @param {string} map Rows of two-character tokens (see config/parks/index.js).
 * @param {Record<string, {runs?: string}>} pieces config.pieces
 * @returns {{cols: number, rows: number, tiles: {piece: string, col: number, row: number, turn: number}[]}}
 */
export function parseMap(map, pieces) {
    const lines = map.trim().split('\n').map((line) => line.trim().split(/\s+/));
    const cols = lines[0].length;
    const tiles = [];
    lines.forEach((tokens, row) => {
        if (tokens.length !== cols) {
            throw new Error(`Park map row ${row} has ${tokens.length} tiles, expected ${cols}.`);
        }
        tokens.forEach((token, col) => {
            const piece = PIECE_CODES[token[0]];
            if (!piece || token.length !== 2) {
                throw new Error(`Unknown park token "${token}" at column ${col}, row ${row}.`);
            }
            let turn = TURNS[token[1]];
            if (token[1] === '|' || token[1] === '-') {
                turn = (pieces[piece].runs === (token[1] === '|' ? 'z' : 'x')) ? 0 : 1;
            }
            if (turn === undefined) {
                throw new Error(`Unknown direction in park token "${token}" at column ${col}, row ${row}.`);
            }
            tiles.push({ piece, col, row, turn });
        });
    });

    return { cols, rows: lines.length, tiles };
}

/**
 * The highest point of a triangle soup straight below (x, z), or NaN when nothing is there.
 *
 * @param {Float32Array} triangles x, y, z of three corners per triangle, in model units
 */
function heightAt(triangles, x, z) {
    let best = NaN;
    for (let t = 0; t < triangles.length; t += 9) {
        const ax = triangles[t], ay = triangles[t + 1], az = triangles[t + 2];
        const bx = triangles[t + 3], by = triangles[t + 4], bz = triangles[t + 5];
        const cx = triangles[t + 6], cy = triangles[t + 7], cz = triangles[t + 8];
        const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        if (Math.abs(d) < 1e-9) {
            continue;
        }
        const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d;
        const l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
        const l3 = 1 - l1 - l2;
        if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) {
            continue;
        }
        const y = l1 * ay + l2 * by + l3 * cy;
        if (!(y <= best)) {
            best = y;
        }
    }

    return best;
}

/** A model's heights at the sample centres of one tile, row by row (NaN where the model has nothing). */
function sampleModel(triangles, samples) {
    const grid = new Float32Array(samples * samples);
    for (let j = 0; j < samples; j++) {
        for (let i = 0; i < samples; i++) {
            grid[j * samples + i] = heightAt(triangles, (i + 0.5) / samples - 0.5, (j + 0.5) / samples - 0.5);
        }
    }

    return grid;
}

/** Turns (x, z) a number of quarter turns about +y, from +z towards +x (as three.js's rotation.y). */
export function turnVector(x, z, turns) {
    for (let k = 0; k < ((turns % 4) + 4) % 4; k++) {
        [x, z] = [z, -x];
    }

    return [x, z];
}

/**
 * Builds a park.
 *
 * @param {{map: string, spawns: {col: number, row: number, facing: string}[]}} park a config/parks entry
 * @param {object} config the game config (config/index.js)
 * @param {Record<string, Float32Array>} triangles each model's triangles, by model name (see src/render/models.js)
 */
export function buildPark(park, config, triangles) {
    const { scale, samples: n, cliff } = config.world;
    const { cols, rows, tiles } = parseMap(park.map, config.pieces);
    const width = cols * n;
    const depth = rows * n;
    const cell = scale / n;
    const ground = new Float32Array(width * depth);
    const top = new Float32Array(width * depth);
    const vert = new Uint8Array(width * depth);
    const facingX = new Float32Array(width * depth);
    const facingZ = new Float32Array(width * depth);

    const grids = new Map();
    for (const { piece, col, row, turn } of tiles) {
        const { model, kind, facing } = config.pieces[piece];
        if (!triangles[model]) {
            throw new Error(`The park needs models/${model}.glb, which did not load.`);
        }
        if (!grids.has(model)) {
            grids.set(model, sampleModel(triangles[model], n));
        }
        const grid = grids.get(model);
        const [fx, fz] = facing ? turnVector(facing[0], facing[1], turn) : [0, 0];
        for (let j = 0; j < n; j++) {
            for (let i = 0; i < n; i++) {
                // The world sample's centre relative to the tile centre, turned back into the model's own frame.
                const [lx, lz] = turnVector((i + 0.5) / n - 0.5, (j + 0.5) / n - 0.5, -turn);
                const li = Math.min(n - 1, Math.max(0, Math.round((lx + 0.5) * n - 0.5)));
                const lj = Math.min(n - 1, Math.max(0, Math.round((lz + 0.5) * n - 0.5)));
                const h = grid[lj * n + li] * scale;
                if (Number.isNaN(h)) {
                    continue;
                }
                const index = (row * n + j) * width + col * n + i;
                top[index] = Math.max(top[index], h);
                if (kind !== 'solid') {
                    ground[index] = Math.max(ground[index], h);
                }
                if (kind === 'vert') {
                    vert[index] = 1;
                    facingX[index] = fx;
                    facingZ[index] = fz;
                }
            }
        }
    }

    // A transition's flat deck and floor are ordinary ground: only its slope counts as vert.
    for (let index = 0; index < vert.length; index++) {
        if (!vert[index]) {
            continue;
        }
        const x = index % width;
        const z = (index - x) / width;
        let rise = 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (x + dx >= 0 && x + dx < width && z + dz >= 0 && z + dz < depth) {
                rise = Math.max(rise, Math.abs(ground[index + dz * width + dx] - ground[index]));
            }
        }
        if (rise < 0.03) {
            vert[index] = 0;
        }
    }

    /** The sample index at (x, z), or -1 outside the park. */
    function indexAt(x, z) {
        const i = Math.floor(x / cell);
        const j = Math.floor(z / cell);

        return (i < 0 || j < 0 || i >= width || j >= depth) ? -1 : j * width + i;
    }

    /** The ground height of the sample under (x, z); outside the park: Infinity (a wall). */
    function groundNear(x, z) {
        const index = indexAt(x, z);

        return index < 0 ? Infinity : ground[index];
    }

    /** The highest point (solid pieces included) of the sample under (x, z); outside the park: Infinity. */
    function topNear(x, z) {
        const index = indexAt(x, z);

        return index < 0 ? Infinity : top[index];
    }

    /**
     * The smooth ground height at (x, z): interpolated between sample centres, except across edges
     * (more than `world.cliff` higher or lower than the sample under the point), which stay sharp.
     * Transitions are always smooth, however steep.
     */
    function groundAt(x, z) {
        const own = groundNear(x, z);
        if (own === Infinity) {
            return 0;
        }
        const u = Math.min(width - 1, Math.max(0, x / cell - 0.5));
        const v = Math.min(depth - 1, Math.max(0, z / cell - 0.5));
        const i = Math.min(width - 2, Math.floor(u));
        const j = Math.min(depth - 2, Math.floor(v));
        const fu = u - i;
        const fv = v - j;
        const ownVert = vert[indexAt(x, z)];
        const h = (di, dj) => {
            const index = (j + dj) * width + i + di;

            return Math.abs(ground[index] - own) > cliff && !(ownVert && vert[index]) ? own : ground[index];
        };

        return (h(0, 0) * (1 - fu) + h(1, 0) * fu) * (1 - fv) + (h(0, 1) * (1 - fu) + h(1, 1) * fu) * fv;
    }

    /** Rise per metre of the ground at (x, z) in direction (dx, dz) (a unit vector); edges (not transitions) are ignored. */
    function slope(x, z, dx, dz) {
        const here = groundAt(x, z);
        const ahead = groundAt(x + dx * cell, z + dz * cell);
        const behind = groundAt(x - dx * cell, z - dz * cell);
        const curved = vertAt(x, z) !== null;
        const aheadOk = curved || Math.abs(ahead - here) <= cliff;
        const behindOk = curved || Math.abs(here - behind) <= cliff;
        if (aheadOk && behindOk) {
            return (ahead - behind) / (2 * cell);
        }
        if (aheadOk) {
            return (ahead - here) / cell;
        }

        return behindOk ? (here - behind) / cell : 0;
    }

    /** The ground's unit normal at (x, z), as [x, y, z]. */
    function normal(x, z) {
        const gx = slope(x, z, 1, 0);
        const gz = slope(x, z, 0, 1);
        const length = Math.hypot(gx, 1, gz);

        return [-gx / length, 1 / length, -gz / length];
    }

    /** The direction a transition at (x, z) faces, as [x, z], or null where there is none. */
    function vertAt(x, z) {
        const index = indexAt(x, z);

        return index >= 0 && vert[index] ? [facingX[index], facingZ[index]] : null;
    }

    /** A spawn point in world coordinates, with the heading (radians, 0 = +z) to face. */
    function spawn(index) {
        const { col, row, facing } = park.spawns[((index % park.spawns.length) + park.spawns.length) % park.spawns.length];
        const heading = { S: 0, E: Math.PI / 2, N: Math.PI, W: -Math.PI / 2 }[facing];
        const x = (col + 0.5) * scale;
        const z = (row + 0.5) * scale;

        return { x, y: groundAt(x, z), z, heading };
    }

    return {
        name: park.name, cols, rows, tile: scale, cell, tiles, width: cols * scale, depth: rows * scale,
        groundAt, groundNear, topNear, slope, normal, vertAt, spawn,
    };
}
