/**
 * Short visual effects queued by the game with fx() (G.fx): shots, dust, rings, healing, lightning.
 * Floating text is drawn by the overlay (overlay.js) and deaths by units.js.
 */
import * as THREE from 'three';
import { hash } from '../game/constants.js';
import { G } from '../game/state.js';

let glow = null;

/** A soft round glow texture, made once. */
export function glowTexture() {
    if (glow) {
        return glow;
    }
    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.3, 'rgba(255,255,255,.5)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
    glow = new THREE.CanvasTexture(c);

    return glow;
}

const glowSprite = (color, size) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(size);

    return s;
};

function make(f) {
    const g = new THREE.Group();
    if (f.type === 'proj') {
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: f.col }));
        g.add(core, glowSprite(f.col, 0.45));
    } else if (f.type === 'dust') {
        const mat = new THREE.MeshBasicMaterial({ color: f.col, transparent: true });
        for (let k = 0; k < 5; k++) {
            const d = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), mat);
            d.userData.a = k * 1.3 + f.x * 3;
            g.add(d);
        }
    } else if (f.type === 'ring' || f.type === 'heal') {
        const r = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: f.type === 'heal' ? '#7fe08a' : f.col, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
        g.add(r);
    } else if (f.type === 'bolt') {
        const pts = [];
        for (let k = 0; k <= 10; k++) {
            const y = 7 * (1 - k / 10);
            const j = k > 0 && k < 10 ? 0.7 : 0;
            pts.push(new THREE.Vector3((hash(k, f.seed) - 0.5) * j, y, (hash(k, f.seed, 3) - 0.5) * j));
        }
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#dfe9ff', transparent: true })));
        g.add(glowSprite('#c8dcff', 3.2));
        const light = new THREE.PointLight('#c8dcff', 30, 8, 1.5);
        light.position.y = 1.5;
        g.add(light);
    } else {
        return null;
    }

    return g;
}

export class Effects {
    constructor(scene) {
        this.scene = scene;
        this.objects = new Map();
    }

    update() {
        const live = new Set(G.fx);
        for (const [f, o] of this.objects) {
            if (!live.has(f)) {
                if (o) {
                    this.scene.remove(o);
                }
                this.objects.delete(f);
            }
        }
        for (const f of G.fx) {
            if (f.type === 'text' || f.type === 'death') {
                continue;
            }
            let o = this.objects.get(f);
            if (o === undefined) {
                o = make(f);
                this.objects.set(f, o);
                if (o) {
                    this.scene.add(o);
                }
            }
            if (!o) {
                continue;
            }
            const p = Math.min(1, f.t / f.dur);
            if (f.type === 'proj') {
                const h = f.heart ? 1.0 - 0.6 * p : 0.45;
                o.position.set(f.x + (f.x1 - f.x) * p, h, f.y + (f.y1 - f.y) * p);
            } else if (f.type === 'dust') {
                o.position.set(f.x, 0.25, f.y);
                o.children.forEach((d) => {
                    const a = d.userData.a;
                    d.position.set(Math.cos(a) * p * 0.35, p * 0.25 - p * p * 0.2, Math.sin(a) * p * 0.35);
                    d.material.opacity = 1 - p;
                });
            } else if (f.type === 'ring' || f.type === 'heal') {
                const r = f.type === 'heal' ? (f.r || 2.5) * p : 0.2 + p * 0.7;
                o.position.set(f.x, 0.04, f.y);
                o.scale.setScalar(Math.max(0.01, r));
                o.children[0].material.opacity = 1 - p;
            } else if (f.type === 'bolt') {
                o.position.set(f.x, 0, f.y);
                o.children[0].material.opacity = 1 - p;
                o.children[1].material.opacity = 1 - p;
                o.children[2].intensity = 30 * (1 - p);
            }
        }
    }

    clear() {
        for (const o of this.objects.values()) {
            if (o) {
                this.scene.remove(o);
            }
        }
        this.objects.clear();
    }
}
