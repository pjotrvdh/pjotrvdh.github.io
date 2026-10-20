/**
 * Room furnishings on top of the room floors (terrain.js): a coloured trim around each room, gold in
 * the Treasury (more as it fills), nests on claimed Lair beds with the owner's colour, straw and
 * chickens in the Hatchery, dummies and weapons in the Training Room, shelves and tables in the Library.
 */
import * as THREE from 'three';
import { HATCH, LAIR, LIB, N, N4, TRAIN, TREAS, hash, inb, ix, tx, ty } from '../game/constants.js';
import { ASSETS, HEART_CAP, KINDS, ROOMS, TREAS_CAP } from '../game/config.js';
import { hasBed } from '../game/entities.js';
import { G } from '../game/state.js';
import { Instances, place } from './instances.js';

const m = new THREE.Matrix4();
const col = new THREE.Color();
const BOOKS = ['#7a2b2b', '#2d5a7a', '#6b5a2a', '#3d6b3a', '#5a3a7a'];

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...extra });

export class Rooms {
    constructor(scene) {
        this.group = new THREE.Group();
        scene.add(this.group);
        const P = ASSETS.props;
        this.trim = new Instances(this.group, [{ geometry: new THREE.BoxGeometry(1, 0.05, 0.07), material: std('#ffffff', { emissive: '#222222' }) }]);
        this.coins = new Instances(this.group, P.coin);
        this.nests = new Instances(this.group, [{ geometry: new THREE.TorusGeometry(0.27, 0.09, 5, 10).rotateX(Math.PI / 2), material: std('#9a7a3e') }]);
        this.nestBeds = new Instances(this.group, [{ geometry: new THREE.CylinderGeometry(0.24, 0.24, 0.04, 10), material: std('#3a2a20') }]);
        this.flags = new Instances(this.group, [{ geometry: new THREE.SphereGeometry(0.07, 8, 6), material: std('#ffffff', { emissive: '#333333' }) }]);
        this.straw = new Instances(this.group, [{ geometry: new THREE.CylinderGeometry(0.02, 0.03, 0.22, 4).rotateZ(1.2), material: std('#d8b04a') }]);
        this.chickens = new Instances(this.group, [
            { geometry: new THREE.SphereGeometry(0.09, 7, 5).scale(1.2, 1, 1).translate(0, 0.1, 0), material: std('#f2ece0') },
            { geometry: new THREE.SphereGeometry(0.05, 6, 4).translate(0.1, 0.19, 0), material: std('#f2ece0') },
            { geometry: new THREE.BoxGeometry(0.03, 0.05, 0.02).translate(0.11, 0.25, 0), material: std('#d23b2b') },
        ]);
        this.dummies = new Instances(this.group, P.dummy);
        this.shields = new Instances(this.group, P.shield);
        this.swords = new Instances(this.group, P.sword);
        this.spears = new Instances(this.group, P.spear);
        this.tables = new Instances(this.group, P.table);
        this.chairs = new Instances(this.group, P.chair);
        this.potions = new Instances(this.group, P.potion);
        this.shelves = new Instances(this.group, [{ geometry: new THREE.BoxGeometry(0.82, 0.9, 0.26).translate(0, 0.45, 0), material: std('#5a3a24') }]);
        this.books = new Instances(this.group, [{ geometry: new THREE.BoxGeometry(0.12, 0.22, 0.2), material: std('#ffffff') }]);
        this.banners = new Instances(this.group, P.banner);
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
        const parts = [this.trim, this.coins, this.nests, this.nestBeds, this.flags, this.straw, this.dummies, this.shields, this.swords, this.spears, this.tables, this.chairs, this.potions, this.shelves, this.books, this.banners];
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
            }
            if (r === TREAS) {
                const n = Math.round(fill * 5);
                for (let k = 0; k < n; k++) {
                    this.coins.add(place(x + 0.25 + h(k + 30) * 0.5, 0, y + 0.25 + h(k + 40) * 0.5, h(k) * 6, 0.45 + 0.25 * fill, m));
                }
            } else if (r === LAIR) {
                if (beds.has(i)) {
                    this.nestBeds.add(place(x + 0.5, 0.02, y + 0.5, 0, 1, m));
                    this.nests.add(place(x + 0.5, 0.05, y + 0.5, h(3) * 6, 1, m));
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
                    this.dummies.add(place(x + 0.5, 0, y + 0.5, turn, 0.9, m));
                    this.shields.add(place(x + 0.5, 0.45, y + 0.5, turn, 0.8, m));
                } else if (h(14) < 0.35) {
                    (h(15) < 0.5 ? this.swords : this.spears).add(place(x + 0.5, 0, y + 0.5, turn, 0.9, m));
                }
            } else if (r === LIB) {
                const v = h(16);
                if (v < 0.4) {
                    this.shelves.add(place(x + 0.5, 0, y + 0.5, turn, 1, m));
                    const c = Math.cos(turn);
                    const s = Math.sin(turn);
                    for (let row = 0; row < 3; row++) {
                        for (let b = 0; b < 5; b++) {
                            const lx = -0.3 + b * 0.15;
                            const lz = 0.04;
                            col.set(BOOKS[(b + row + x + y) % 5]);
                            this.books.add(place(x + 0.5 + lx * c + lz * s, 0.15 + row * 0.28, y + 0.5 - lx * s + lz * c, turn, 1, m), col);
                        }
                    }
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
