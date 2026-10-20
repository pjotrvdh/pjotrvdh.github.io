/**
 * The dungeon itself, in blocks (KayKit Block Bits, one block per tile, see src/config/assets.js): full
 * blocks for earth, gold, gems, rock and reinforced walls, floor blocks sunk below the ground for open
 * tiles, plus dig marks, chests, the keeper emblem on claimed tiles and the jewel on reinforced walls.
 * Rebuilt whenever a seen tile changes.
 */
import * as THREE from 'three';
import { CLAIM, EARTH, FLOOR, GATE, GEM, GOLD, HEART, LAVA, N, PORTAL, ROCK, WALL, hash, inb, ix, tx, ty } from '../game/constants.js';
import { ASSETS, ROOMS, WALL_HP } from '../game/config.js';
import { G } from '../game/state.js';
import { diggable, solid } from '../game/tiles.js';
import { Instances, place } from './instances.js';

/** Height of a solid block. */
export const TOP = 1;

const m = new THREE.Matrix4();
const col = new THREE.Color();

/** Block Bits blocks are 2 units on every side: half scale is one tile. */
const BLOCK = 0.5;
const WHITE = new THREE.Color(1, 1, 1);
/** Brightness per block type: earth darker than the floors, so walls and floors read apart from above. */
const SHADE = { [EARTH]: 0.62, [GOLD]: 0.85, [GEM]: 0.85, [ROCK]: 0.8, [WALL]: 1 };

function markTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(227,178,60,.28)';
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = 'rgba(255,214,110,.95)';
    g.lineWidth = 4;
    g.strokeRect(4, 4, 56, 56);
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(20, 46);
    g.lineTo(44, 22);
    g.moveTo(34, 15);
    g.lineTo(50, 31);
    g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;

    return t;
}

/**
 * A block in the inner corner of a reinforced wall: diagonal to open ground, with reinforced walls on
 * both sides of that corner. Imps never reinforce it (it touches no floor), but it is drawn as a
 * reinforced block so the wall looks closed.
 */
function wallCorner(x, y) {
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        if (!inb(x + dx, y + dy) || solid(ix(x + dx, y + dy)) || !G.seen[ix(x + dx, y + dy)]) {
            continue;
        }
        if (inb(x + dx, y) && inb(x, y + dy) && G.t[ix(x + dx, y)] === WALL && G.t[ix(x, y + dy)] === WALL) {
            return true;
        }
    }

    return false;
}

export class Terrain {
    constructor(scene) {
        this.group = new THREE.Group();
        scene.add(this.group);
        const A = ASSETS.tiles;
        this.blocks = {
            [EARTH]: new Instances(this.group, A.earth),
            [GOLD]: new Instances(this.group, A.gold),
            [GEM]: new Instances(this.group, A.gem),
            [ROCK]: new Instances(this.group, A.rock),
            [WALL]: new Instances(this.group, A.wall),
        };
        this.floor = new Instances(this.group, A.floor);
        this.claimed = new Instances(this.group, A.claimed);
        this.lava = new Instances(this.group, A.lava);
        this.chests = new Instances(this.group, ASSETS.props.chest);
        this.piles = [ASSETS.props.coinsSmall, ASSETS.props.coinsMedium, ASSETS.props.coinsLarge].map((file) => new Instances(this.group, file));
        const markMaterial = new THREE.MeshBasicMaterial({ map: markTexture(), transparent: true, depthWrite: false });
        this.marks = new Instances(this.group, [{ geometry: new THREE.PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2), material: markMaterial }], { renderOrder: 12 }); // after the clouds (10), so marks show through them
        // your colour (assets.js `keeper`): an inlaid emblem on claimed tiles and a jewel on reinforced walls
        this.keeper = new THREE.Color(ASSETS.keeper);
        const keeperGem = new THREE.MeshStandardMaterial({ color: this.keeper, emissive: this.keeper, emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.2, flatShading: true });
        const socket = new THREE.MeshStandardMaterial({ color: '#2a1714', roughness: 0.8, flatShading: true });
        this.emblems = new Instances(this.group, [
            { geometry: new THREE.BoxGeometry(0.3, 0.012, 0.3).rotateY(Math.PI / 4).translate(0, 0.026, 0), material: socket },
            { geometry: new THREE.OctahedronGeometry(0.13, 0).scale(1, 0.16, 1).rotateY(Math.PI / 4).translate(0, 0.034, 0), material: keeperGem },
        ]);
        this.jewels = new Instances(this.group, [
            { geometry: new THREE.CylinderGeometry(0.13, 0.16, 0.06, 6).translate(0, 0.03, 0), material: socket },
            { geometry: new THREE.OctahedronGeometry(0.12, 0).scale(1, 1.4, 1).translate(0, 0.2, 0), material: keeperGem },
        ]);
        this.key = '';
    }

    /** A change-detection key over everything this layer draws. */
    signature() {
        let s = 0;
        for (let i = 0; i < N; i++) {
            const t = G.t[i];
            s = (Math.imul(s, 31) + (t | (G.room[i] ? 16 : 0) | G.mark[i] << 5 | G.seen[i] << 6 | (G.loot[i] > 0) << 7 | Math.min(3, Math.ceil(G.pile[i] / 100)) << 9 | (t === WALL ? G.hp[i] << 8 : 0))) | 0;
        }

        return s + '|' + G.portals.join(',');
    }

    update() {
        const key = this.signature();
        if (key === this.key) {
            return;
        }
        this.key = key;
        this.rebuild();
    }

    rebuild() {
        const parts = [...Object.values(this.blocks), this.floor, this.claimed, this.lava, this.chests, ...this.piles, this.marks, this.emblems, this.jewels];
        for (const p of parts) {
            p.begin();
        }
        for (let i = 0; i < N; i++) {
            const x = tx(i);
            const y = ty(i);
            const t = G.t[i];
            if (G.mark[i] && diggable(i) || G.mark[i] && !G.seen[i]) {
                this.marks.add(place(x + 0.5, G.seen[i] ? TOP + 0.04 : TOP + 0.12, y + 0.5, 0, 1, m));
            }
            if (!G.seen[i]) {
                continue;
            }
            // a quarter turn per tile, so the blocks do not repeat
            const turn = Math.floor(hash(x, y, 3) * 4) * Math.PI / 2;
            if (solid(i)) {
                const keeperWall = t === WALL || wallCorner(x, y);
                const damaged = t === WALL && G.hp[i] < WALL_HP ? 0.7 + 0.3 * G.hp[i] / WALL_HP : 1;
                const kind = keeperWall ? WALL : t;
                col.copy(WHITE).multiplyScalar(SHADE[kind] * (0.92 + 0.12 * hash(x, y, 5)) * damaged);
                this.blocks[kind].add(place(x + 0.5, TOP / 2, y + 0.5, turn, BLOCK, m), col);
                if (keeperWall) {
                    this.jewels.add(place(x + 0.5, TOP + 0.02, y + 0.5, Math.PI / 4, 1, m));
                }
                continue;
            }
            // open ground: a block sunk so its top is the floor
            if (t === LAVA) {
                this.lava.add(place(x + 0.5, -0.55, y + 0.5, turn, BLOCK, m));
            } else if (t === CLAIM || t === HEART) {
                if (G.room[i]) {
                    col.set(ROOMS[G.room[i]].col).lerp(WHITE, 0.5);
                } else {
                    // in your colour, with your emblem in the middle (not under the Heart)
                    col.copy(WHITE).lerp(this.keeper, 0.5).multiplyScalar(0.94 + 0.12 * hash(x, y, 1));
                    if (t === CLAIM) {
                        this.emblems.add(place(x + 0.5, 0, y + 0.5, 0, 1, m));
                    }
                }
                this.claimed.add(place(x + 0.5, -TOP / 2, y + 0.5, turn, BLOCK, m), col);
            } else if (t === FLOOR || t === GATE || t === PORTAL) {
                col.copy(WHITE).multiplyScalar(0.9 + 0.15 * hash(x, y, 1));
                this.floor.add(place(x + 0.5, -TOP / 2, y + 0.5, turn, BLOCK, m), col);
            }
            // gold dropped at a seam, waiting for an imp: a bigger stack for more
            if (G.pile[i] > 0) {
                const size = G.pile[i] < 100 ? 0 : G.pile[i] < 200 ? 1 : 2;
                this.piles[size].add(place(x + 0.5, 0, y + 0.5, hash(x, y, 9) * 6, [0.3, 0.27, 0.2][size], m));
            }
            if (G.loot[i] > 0) {
                this.chests.add(place(x + 0.5, 0, y + 0.5, hash(x, y, 8) * 6.28, 1.1, m));
            }
        }
        for (const p of parts) {
            p.end();
        }
    }
}
