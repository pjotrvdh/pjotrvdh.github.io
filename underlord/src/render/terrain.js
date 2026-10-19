/**
 * The dungeon itself: floors, solid blocks (a dark cap with wall pieces on every side that faces open
 * ground), gold and gems in the rock, dig marks, chests and lava. Rebuilt whenever a seen tile changes.
 *
 * Walls are Kenney's modular "template-wall" pieces (4 x 4 units, scaled to one tile): the Cave Kit
 * for earth, gold, gems and rock, the Dungeon Kit for reinforced walls. A piece's front faces +Z and
 * its body fills half a tile behind it, so it is placed on the edge between the block and the open
 * tile, turned to face the open tile.
 */
import * as THREE from 'three';
import { CLAIM, EARTH, FLOOR, GATE, GEM, GOLD, HEART, LAVA, N, N4, PORTAL, ROCK, WALL, hash, inb, ix, tx, ty } from '../game/constants.js';
import { ASSETS, ROOMS, WALL_HP } from '../game/config.js';
import { G } from '../game/state.js';
import { diggable, solid } from '../game/tiles.js';
import { Instances, place } from './instances.js';

/** Height of a solid block. */
export const TOP = 1;

const m = new THREE.Matrix4();
const col = new THREE.Color();

const CAP_COLORS = { [EARTH]: '#4a3326', [GOLD]: '#4f3a22', [GEM]: '#3e3040', [ROCK]: '#1b1a20', [WALL]: '#4c4560' };
const WALL_TINT = { [EARTH]: '#ffffff', [GOLD]: '#f4e2c4', [GEM]: '#d8d0ec', [ROCK]: '#4a4752', [WALL]: '#ffffff' };

/** A canvas texture drawn by `paint(context, size)`. */
function canvasTexture(size, paint) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    paint(c.getContext('2d'), size);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;

    return t;
}

/** Claimed floor: four square stone tiles with dark joints and a light bevel (tinted per tile). */
function tileTexture() {
    return canvasTexture(256, (g, s) => {
        g.fillStyle = '#3a2a26';
        g.fillRect(0, 0, s, s);
        const h = s / 2;
        const shades = ['#cfc3bb', '#c4b6ad', '#d6cbc4', '#beb0a6'];
        for (let k = 0; k < 4; k++) {
            const x = (k % 2) * h + 5;
            const y = Math.floor(k / 2) * h + 5;
            const w = h - 10;
            g.fillStyle = shades[k];
            g.fillRect(x, y, w, w);
            g.fillStyle = 'rgba(255,255,255,.28)';
            g.fillRect(x, y, w, 5);
            g.fillRect(x, y, 5, w);
            g.fillStyle = 'rgba(0,0,0,.22)';
            g.fillRect(x, y + w - 5, w, 5);
            g.fillRect(x + w - 5, y, 5, w);
            // a few worn specks
            g.fillStyle = 'rgba(80,60,55,.18)';
            for (let d = 0; d < 6; d++) {
                g.fillRect(x + ((k * 37 + d * 53) % (w - 12)) + 6, y + ((k * 61 + d * 29) % (w - 12)) + 6, 6, 4);
            }
        }
    });
}

/** Reinforced walls: courses of bricks with dark mortar, a lighter coping course on top. */
function brickTexture() {
    return canvasTexture(256, (g, s) => {
        g.fillStyle = '#2a1e1b';
        g.fillRect(0, 0, s, s);
        const rows = 6;
        const rh = s / rows;
        const bw = s / 3;
        const tones = ['#9a7c70', '#8c6e62', '#a6887a', '#86685c', '#94766a'];
        for (let r = 0; r < rows; r++) {
            const off = r % 2 ? bw / 2 : 0;
            for (let c = -1; c < 4; c++) {
                const x = c * bw + off + 3;
                const y = r * rh + 3;
                const w = bw - 6;
                const hh = rh - 6;
                g.fillStyle = r === 0 ? '#b49a8c' : tones[(r * 7 + c * 3 + 5) % tones.length];
                g.fillRect(x, y, w, hh);
                g.fillStyle = 'rgba(255,255,255,.18)';
                g.fillRect(x, y, w, 3);
                g.fillStyle = 'rgba(0,0,0,.2)';
                g.fillRect(x, y + hh - 3, w, 3);
            }
        }
    });
}

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
 * both sides of that corner. Imps never reinforce it (it touches no floor), but it is drawn with a
 * reinforced top so the wall looks closed.
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
        this.floorCave = new Instances(this.group, A.floor);
        this.floorCaveDetail = new Instances(this.group, A.floorDetail);
        // claimed ground and rooms: a tiled floor; reinforced walls: brick (both drawn in code)
        this.floorTiles = new Instances(this.group, [{ geometry: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0.002, 0), material: new THREE.MeshStandardMaterial({ map: tileTexture(), roughness: 0.85 }) }]);
        this.wallCave = new Instances(this.group, A.wall);
        // a brick slab like Kenney's wall pieces: front face on the tile edge, body half a tile behind it
        this.wallKeeper = new Instances(this.group, [{ geometry: new THREE.BoxGeometry(1, TOP, 0.5).translate(0, TOP / 2, -0.25), material: new THREE.MeshStandardMaterial({ map: brickTexture(), roughness: 0.9 }) }]);
        this.chests = new Instances(this.group, ASSETS.props.chest);
        const capMaterial = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
        this.caps = new Instances(this.group, [{ geometry: new THREE.BoxGeometry(1, 0.08, 1).translate(0, -0.04, 0), material: capMaterial }]);
        this.gold = new Instances(this.group, [{
            geometry: new THREE.IcosahedronGeometry(0.075, 0),
            material: new THREE.MeshStandardMaterial({ color: '#f2c64a', emissive: '#7a5208', emissiveIntensity: 0.6, roughness: 0.35, metalness: 0.6, flatShading: true }),
        }]);
        this.gems = new Instances(this.group, [{
            geometry: new THREE.OctahedronGeometry(0.09, 0).scale(0.7, 1.3, 0.7),
            material: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#3b7f99', emissiveIntensity: 0.9, roughness: 0.2, flatShading: true }),
        }]);
        const markMaterial = new THREE.MeshBasicMaterial({ map: markTexture(), transparent: true, depthWrite: false });
        this.marks = new Instances(this.group, [{ geometry: new THREE.PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2), material: markMaterial }], { renderOrder: 12 }); // after the clouds (10), so marks show through them
        this.lavaMaterial = new THREE.ShaderMaterial({
            uniforms: { time: { value: 0 } },
            vertexShader: 'varying vec2 vW; void main(){ vec4 w = modelMatrix * instanceMatrix * vec4(position,1.); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
            fragmentShader: `uniform float time; varying vec2 vW;
                float n(vec2 p){ return sin(p.x*3.1+time*0.9)*sin(p.y*2.7-time*0.7)+0.5*sin((p.x+p.y)*5.3+time*1.6); }
                void main(){ float v = 0.5+0.35*n(vW); vec3 c = mix(vec3(0.55,0.08,0.01), vec3(1.0,0.62,0.12), smoothstep(0.2,0.95,v)); gl_FragColor = vec4(c,1.); }`,
        });
        this.lava = new Instances(this.group, [{ geometry: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), material: this.lavaMaterial }]);
        // your colour (assets.js `keeper`): an inlaid emblem on claimed tiles and a jewel on reinforced walls
        this.keeper = new THREE.Color(ASSETS.keeper);
        const keeperGem = new THREE.MeshStandardMaterial({ color: this.keeper, emissive: this.keeper, emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.2, flatShading: true });
        const socket = new THREE.MeshStandardMaterial({ color: '#2a1714', roughness: 0.8, flatShading: true });
        this.emblems = new Instances(this.group, [
            { geometry: new THREE.BoxGeometry(0.3, 0.012, 0.3).rotateY(Math.PI / 4).translate(0, 0.006, 0), material: socket },
            { geometry: new THREE.OctahedronGeometry(0.13, 0).scale(1, 0.16, 1).rotateY(Math.PI / 4).translate(0, 0.014, 0), material: keeperGem },
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
            s = (Math.imul(s, 31) + (t | (G.room[i] ? 16 : 0) | G.mark[i] << 5 | G.seen[i] << 6 | (G.loot[i] > 0) << 7 | (t === WALL ? G.hp[i] << 8 : 0))) | 0;
        }

        return s + '|' + G.portals.join(',');
    }

    update(time) {
        this.lavaMaterial.uniforms.time.value = time;
        const key = this.signature();
        if (key === this.key) {
            return;
        }
        this.key = key;
        this.rebuild();
    }

    rebuild() {
        const parts = [this.floorCave, this.floorCaveDetail, this.floorTiles, this.wallCave, this.wallKeeper, this.chests, this.caps, this.gold, this.gems, this.marks, this.lava, this.emblems, this.jewels];
        for (const p of parts) {
            p.begin();
        }
        const s4 = 0.25; // Kenney's modular kits use 4-unit tiles
        for (let i = 0; i < N; i++) {
            const x = tx(i);
            const y = ty(i);
            const t = G.t[i];
            if (G.mark[i] && diggable(i) || G.mark[i] && !G.seen[i]) {
                this.marks.add(place(x + 0.5, G.seen[i] ? TOP + 0.02 : TOP + 0.12, y + 0.5, 0, 1, m));
            }
            if (!G.seen[i]) {
                continue;
            }
            const turn = Math.floor(hash(x, y, 3) * 4) * Math.PI / 2;
            if (solid(i)) {
                const damaged = t === WALL && G.hp[i] < WALL_HP ? 0.7 + 0.3 * G.hp[i] / WALL_HP : 1;
                const keeperWall = t === WALL || wallCorner(x, y);
                col.set(CAP_COLORS[keeperWall ? WALL : t]).multiplyScalar((0.85 + 0.3 * hash(x, y, 5)) * damaged);
                this.caps.add(place(x + 0.5, TOP + 0.01, y + 0.5, 0, 1, m), col);
                if (keeperWall) {
                    this.jewels.add(place(x + 0.5, TOP + 0.01, y + 0.5, Math.PI / 4, 1, m));
                }
                for (const [dx, dy] of N4) {
                    const a = x + dx;
                    const b = y + dy;
                    if (!inb(a, b)) {
                        continue;
                    }
                    const j = ix(a, b);
                    if (solid(j) || !G.seen[j]) {
                        continue;
                    }
                    // on the edge towards the open tile, facing it
                    const rot = Math.atan2(dx, dy);
                    col.set(WALL_TINT[t]).multiplyScalar(damaged);
                    if (t === WALL) {
                        this.wallKeeper.add(place(x + 0.5 + dx * 0.5, 0, y + 0.5 + dy * 0.5, rot, 1, m), col);
                    } else {
                        this.wallCave.add(place(x + 0.5 + dx * 0.5, 0, y + 0.5 + dy * 0.5, rot, s4, m), col);
                    }
                    if (t === GOLD || t === GEM) {
                        for (let k = 0; k < 3; k++) {
                            const along = (hash(x * 7 + dx, y * 7 + dy, k) - 0.5) * 0.8;
                            const up = 0.18 + hash(x * 5 + dx, y * 5 + dy, k + 9) * 0.65;
                            const px = x + 0.5 + dx * 0.53 + (dy !== 0 ? along : 0);
                            const pz = y + 0.5 + dy * 0.53 + (dx !== 0 ? along : 0);
                            if (t === GOLD) {
                                this.gold.add(place(px, up, pz, hash(x, y, k) * 6, 0.8 + hash(x, y, k + 4) * 0.6, m));
                            } else {
                                col.set(k % 2 ? '#c27cf5' : '#56d6ea');
                                this.gems.add(place(px, up, pz, hash(x, y, k) * 6, 1, m), col);
                            }
                        }
                    }
                }
                if (t === GOLD) {
                    for (let k = 0; k < 3; k++) {
                        this.gold.add(place(x + 0.2 + hash(x, y, k + 11) * 0.6, TOP + 0.02, y + 0.2 + hash(x, y, k + 21) * 0.6, hash(x, y, k) * 6, 0.7, m));
                    }
                } else if (t === GEM) {
                    for (let k = 0; k < 2; k++) {
                        col.set(k ? '#c27cf5' : '#56d6ea');
                        this.gems.add(place(x + 0.3 + k * 0.35, TOP + 0.08, y + 0.35 + hash(x, y, k) * 0.3, hash(x, y, k) * 6, 1.3, m), col);
                    }
                }
                continue;
            }
            if (t === LAVA) {
                this.lava.add(place(x + 0.5, -0.04, y + 0.5, 0, 1, m));
                continue;
            }
            if (t === CLAIM || t === HEART) {
                if (G.room[i]) {
                    col.set(ROOMS[G.room[i]].col).lerp(new THREE.Color(1, 1, 1), 0.55);
                    this.floorTiles.add(place(x + 0.5, 0, y + 0.5, turn, 1, m), col);
                } else {
                    // stone in your colour, with your emblem in the middle (not under the Heart)
                    col.setRGB(1, 1, 1).lerp(this.keeper, 0.6);
                    col.multiplyScalar(0.92 + 0.16 * hash(x, y, 1));
                    this.floorTiles.add(place(x + 0.5, 0, y + 0.5, turn, 1, m), col);
                    if (t === CLAIM) {
                        this.emblems.add(place(x + 0.5, 0.005, y + 0.5, 0, 1, m));
                    }
                }
            } else if (t === FLOOR || t === GATE || t === PORTAL) {
                (hash(x, y, 1) < 0.3 ? this.floorCaveDetail : this.floorCave).add(place(x + 0.5, 0, y + 0.5, turn, s4, m));
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
