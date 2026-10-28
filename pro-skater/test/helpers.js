/**
 * Test helpers: the real park, built from the .glb files in models/ without three.js, and a way to
 * run a skater for a while with fixed input.
 */
import { readFileSync } from 'node:fs';
import config from '../src/config/index.js';
import { buildPark } from '../src/game/park.js';
import { createSkater, stepSkater } from '../src/game/skater.js';

const COMPONENTS = { SCALAR: 1, VEC3: 3, VEC4: 4 };

/** A .glb file's triangles in model units (node translation, rotation and scale applied; no hierarchy). */
function glbTriangles(file) {
    const bytes = readFileSync(file);
    const jsonLength = bytes.readUInt32LE(12);
    const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
    const bin = bytes.subarray(20 + jsonLength + 8);
    const read = (index) => {
        const accessor = json.accessors[index];
        const view = json.bufferViews[accessor.bufferView];
        const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
        const out = [];
        for (let k = 0; k < accessor.count * COMPONENTS[accessor.type]; k++) {
            switch (accessor.componentType) {
                case 5126: out.push(bin.readFloatLE(offset + k * 4)); break;
                case 5125: out.push(bin.readUInt32LE(offset + k * 4)); break;
                case 5123: out.push(bin.readUInt16LE(offset + k * 2)); break;
                default: out.push(bin.readUInt8(offset + k));
            }
        }

        return out;
    };
    const out = [];
    for (const node of json.nodes) {
        if (node.mesh === undefined) {
            continue;
        }
        const [tx, ty, tz] = node.translation ?? [0, 0, 0];
        const [qx, qy, qz, qw] = node.rotation ?? [0, 0, 0, 1];
        const [sx, sy, sz] = node.scale ?? [1, 1, 1];
        for (const primitive of json.meshes[node.mesh].primitives) {
            const positions = read(primitive.attributes.POSITION);
            const indices = primitive.indices === undefined ? positions.map((_, k) => k).slice(0, positions.length / 3) : read(primitive.indices);
            for (const index of indices) {
                const x = positions[index * 3] * sx;
                const y = positions[index * 3 + 1] * sy;
                const z = positions[index * 3 + 2] * sz;
                // Rotate by the quaternion: v + 2w(q × v) + 2q × (q × v).
                const cx = qy * z - qz * y;
                const cy = qz * x - qx * z;
                const cz = qx * y - qy * x;
                out.push(
                    x + 2 * (qw * cx + qy * cz - qz * cy) + tx,
                    y + 2 * (qw * cy + qz * cx - qx * cz) + ty,
                    z + 2 * (qw * cz + qx * cy - qy * cx) + tz,
                );
            }
        }
    }

    return new Float32Array(out);
}

/** The test park (config/parks/warehouse.js), built from the real models. */
export function warehouse() {
    const models = [...new Set(Object.values(config.pieces).map((piece) => piece.model))];
    const triangles = Object.fromEntries(models.map((model) => [model, glbTriangles(new URL(`../models/${model}.glb`, import.meta.url))]));

    return buildPark(config.parks.warehouse, config, triangles);
}

/** World position of a tile's centre. */
export const tileCentre = (park, col, row) => [(col + 0.5) * park.tile, (row + 0.5) * park.tile];

/** A skater at tile (col, row), facing `heading` (radians, 0 = south), moving at `speed`. */
export function skaterAt(park, col, row, heading, speed = 0) {
    const [x, z] = tileCentre(park, col, row);
    const skater = createSkater({ x, y: park.groundAt(x, z), z, heading });
    skater.speed = speed;

    return skater;
}

export const NORTH = Math.PI;
export const SOUTH = 0;
export const EAST = Math.PI / 2;
export const WEST = -Math.PI / 2;

/**
 * Runs a skater for `seconds` with fixed input (or a function of time returning input), and returns
 * what happened: every event, the highest point and the time in the air.
 */
export function run(skater, park, seconds, input = {}) {
    const step = 1 / config.world.tickRate;
    const events = [];
    let highest = skater.y;
    let air = 0;
    for (let t = 0; t < seconds; t += step) {
        const now = typeof input === 'function' ? input(t) : input;
        stepSkater(skater, { steer: 0, push: false, brake: false, jump: false, ...now }, park, config.physics, step);
        events.push(...skater.events);
        skater.events.length = 0;
        highest = Math.max(highest, skater.y);
        air += skater.grounded ? 0 : step;
    }

    return { events, highest, air };
}

export { config };
