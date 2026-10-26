/**
 * Room furnishings on top of the room floors (terrain.js): a coloured trim around each room, gold in
 * the Treasury (more as it fills), beds on claimed Lair tiles with the owner's colour, straw and
 * chickens in the Hatchery, targets and weapon racks in the Training Room, bookcases and tables in the Library,
 * iron bars around the Prison.
 */
import * as THREE from 'three';
import { HATCH, LAIR, LIB, N, N4, PRISON, TRAIN, TREAS, hash, inb, ix, tx, ty } from '../game/constants.js';
import { ASSETS, HEART_CAP, KINDS, ROOMS, TREAS_CAP } from '../game/config.js';
import { hasBed } from '../game/entities.js';
import { G } from '../game/state.js';
import { Instances, place } from './instances.js';

const m = new THREE.Matrix4();
const col = new THREE.Color();
const bars = new THREE.Matrix4();
const v = new THREE.Vector3();
const scl = new THREE.Vector3();
const q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...extra });

/** Which way a Lair bed on tile `i` lies, in quarter turns: its pillow points 0 up, 1 left, 2 down, 3 right (camera not turned). */
export const bedQuarter = (i) => Math.floor(hash(tx(i), ty(i), 12) * 4);

/** How a Lair bed on tile `i` is turned: its sleeper turns the same way (units.js, `SLEEP_FIX`). */
export const bedTurn = (i) => bedQuarter(i) * Math.PI / 2;

export class Rooms {
    constructor(scene) {
        this.group = new THREE.Group();
        scene.add(this.group);
        const P = ASSETS.props;
        this.trim = new Instances(this.group, [{ geometry: new THREE.BoxGeometry(1, 0.05, 0.07), material: std('#ffffff', { emissive: '#222222' }) }]);
        this.coins = [P.coinsSmall, P.coinsMedium, P.coinsLarge].map((file) => new Instances(this.group, file));
        this.beds = new Instances(this.group, P.bed);
        this.flags = new Instances(this.group, [{ geometry: new THREE.SphereGeometry(0.07, 8, 6), material: std('#ffffff', { emissive: '#333333' }) }]);
        this.straw = new Instances(this.group, [{ geometry: new THREE.CylinderGeometry(0.02, 0.03, 0.22, 4).rotateZ(1.2), material: std('#d8b04a') }]);
        this.chickens = new Instances(this.group, [
            { geometry: new THREE.SphereGeometry(0.09, 7, 5).scale(1.2, 1, 1).translate(0, 0.1, 0), material: std('#f2ece0') },
            { geometry: new THREE.SphereGeometry(0.05, 6, 4).translate(0.1, 0.19, 0), material: std('#f2ece0') },
            { geometry: new THREE.BoxGeometry(0.03, 0.05, 0.02).translate(0.11, 0.25, 0), material: std('#d23b2b') },
        ]);
        this.targets = new Instances(this.group, P.target);
        this.racks = new Instances(this.group, P.weaponRack);
        this.tables = new Instances(this.group, P.table);
        this.chairs = new Instances(this.group, P.chair);
        this.potions = new Instances(this.group, P.potion);
        this.bookcases = new Instances(this.group, P.bookcase);
        this.banners = new Instances(this.group, P.banner);
        this.bars = new Instances(this.group, P.bars);
        this.key = '';
        this.hatch = [];
    }

    signature() {
        let s = 0;
        for (let i = 0; i < N; i++) {
            s = (Math.imul(s, 31) + G.room[i] + (G.seen[i] << 3)) | 0;
        }
        const fill = G.rc[TREAS] ? Math.round(10 * Math.max(0, Math.min(1, (G.money - HEART_CAP) / (TREAS_CAP * G.rc[TREAS])))) : 0;
        const beds = G.ents.filter((e) => !e.dead && hasBed(e)).map((e) => e.bed + e.kind).sort().join(',');

        return s + '|' + fill + '|' + beds;
    }

    update(time) {
        const key = this.signature();
        if (key !== this.key) {
            this.key = key;
            this.rebuild();
        }
        this.drawChickens(time);
    }

    drawChickens(time) {
        this.chickens.begin();
        for (const i of this.hatch) {
            const x = tx(i);
            const y = ty(i);
            const ph = time * (0.6 + hash(x, y, 40)) + hash(x, y, 41) * 9;
            const cx = x + 0.5 + 0.28 * Math.sin(ph);
            const cy = y + 0.5 + 0.22 * Math.cos(ph * 1.3);
            const heading = Math.atan2(-0.22 * 1.3 * Math.sin(ph * 1.3), 0.28 * Math.cos(ph));
            const hop = Math.abs(Math.sin(time * 9 + i)) * 0.03;
            this.chickens.add(place(cx, hop, cy, -heading, 1, m));
        }
        this.chickens.end();
    }

    rebuild() {
        const parts = [this.trim, ...this.coins, this.beds, this.flags, this.straw, this.targets, this.racks, this.tables, this.chairs, this.potions, this.bookcases, this.banners, this.bars];
        for (const p of parts) {
            p.begin();
        }
        this.hatch = [];
        const beds = new Map(G.ents.filter((e) => !e.dead && hasBed(e)).map((e) => [e.bed, e.kind]));
        const fill = G.rc[TREAS] ? Math.max(0, Math.min(1, (G.money - HEART_CAP) / (TREAS_CAP * G.rc[TREAS]))) : 0;
        for (let i = 0; i < N; i++) {
            const r = G.room[i];
            if (!r || !G.seen[i]) {
                continue;
            }
            const x = tx(i);
            const y = ty(i);
            const h = (k) => hash(x, y, k);
            const turn = Math.floor(h(12) * 4) * Math.PI / 2;
            // trim along the room's outline
            col.set(ROOMS[r].col);
            for (const [dx, dy] of N4) {
                const a = x + dx;
                const b = y + dy;
                if (inb(a, b) && G.room[ix(a, b)] === r) {
                    continue;
                }
                this.trim.add(place(x + 0.5 + dx * 0.46, 0.04, y + 0.5 + dy * 0.46, dx ? Math.PI / 2 : 0, 1, m), col);
                if (r === PRISON) {
                    // the fence model stands 0.32 behind its origin: turn that side to the edge, at 0.7 height
                    bars.compose(v.set(x + 0.5 + dx * 0.15, 0, y + 0.5 + dy * 0.15), q.setFromAxisAngle(UP, Math.atan2(-dx, -dy)), scl.set(1, 0.7, 1));
                    this.bars.add(bars);
                }
            }
            if (r === TREAS) {
                // flat coin stacks: up to four per tile, bigger as the Treasury fills (a tile's own share
                // of the gold varies a little, so the room does not look stamped)
                const share = Math.max(0, Math.min(1, fill * (0.8 + 0.4 * h(50))));
                const n = share > 0 ? 1 + Math.floor(share * 3.99) : 0;
                const size = share < 0.35 ? 0 : share < 0.7 ? 1 : 2;
                for (let k = 0; k < n; k++) {
                    const s = Math.max(0, size - (k % 2));
                    this.coins[s].add(place(x + 0.27 + (k % 2) * 0.46 + (h(k + 30) - 0.5) * 0.08, 0, y + 0.27 + Math.floor(k / 2) * 0.46 + (h(k + 40) - 0.5) * 0.08, h(k) * 6, [0.3, 0.27, 0.2][s], m));
                }
            } else if (r === LAIR) {
                if (beds.has(i)) {
                    this.beds.add(place(x + 0.5, 0, y + 0.5, bedTurn(i), 0.3, m));
                    col.set(KINDS[beds.get(i)].col);
                    this.flags.add(place(x + 0.82, 0.12, y + 0.18, 0, 1, m), col);
                }
            } else if (r === HATCH) {
                for (let k = 0; k < 5; k++) {
                    this.straw.add(place(x + 0.15 + h(k + 31) * 0.7, 0.02, y + 0.15 + h(k + 32) * 0.7, h(k + 30) * 6, 1, m));
                }
                this.hatch.push(i);
            } else if (r === TRAIN) {
                if ((x + y) % 2 === 0) {
                    this.targets.add(place(x + 0.5, 0, y + 0.5, turn, 0.42, m));
                } else if (h(14) < 0.35) {
                    this.racks.add(place(x + 0.5, 0, y + 0.5, turn, 0.6, m));
                }
            } else if (r === LIB) {
                const v = h(16);
                if (v < 0.4) {
                    this.bookcases.add(place(x + 0.5, 0, y + 0.5, turn, 0.42, m));
                } else if (v < 0.75) {
                    this.tables.add(place(x + 0.5, 0, y + 0.5, turn, 1, m));
                    this.chairs.add(place(x + 0.5 + Math.sin(turn + Math.PI / 2) * 0.32, 0, y + 0.5 + Math.cos(turn + Math.PI / 2) * 0.32, turn + Math.PI, 0.9, m));
                    this.potions.add(place(x + 0.4 + h(17) * 0.2, 0.31, y + 0.45, 0, 0.7, m));
                } else if (v < 0.85) {
                    this.banners.add(place(x + 0.5, 0, y + 0.5, turn, 1, m));
                }
            }
        }
        for (const p of parts) {
            p.end();
        }
    }
}
