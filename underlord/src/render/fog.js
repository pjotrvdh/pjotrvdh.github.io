/**
 * The clouds over undiscovered ground: a drifting cloud layer just above the blocks, opaque over every
 * unseen tile with soft edges. Gold and gems glint, through it and once discovered, and invading heroes in undiscovered
 * ground show as white dots on top of it (Dungeon Keeper style).
 */
import * as THREE from 'three';
import { GEM, GOLD, H, N, W, hash, tx, ty } from '../game/constants.js';
import { ASSETS } from '../game/config.js';
import { G } from '../game/state.js';
import { unknownHeroes } from '../game/world.js';
import { glowTexture } from './effects.js';
import { TOP } from './terrain.js';

export const FOG_Y = TOP + 0.1;

/** A four-pointed sparkle (long rays across, short ones diagonal, a bright core) for the glints on gold and gems. */
function starTexture() {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const h = size / 2;
    const ray = (angle, len, width) => {
        g.save();
        g.translate(h, h);
        g.rotate(angle);
        const gr = g.createLinearGradient(0, 0, len, 0);
        gr.addColorStop(0, 'rgba(255,255,255,1)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(0, -width);
        g.lineTo(len, 0);
        g.lineTo(0, width);
        g.closePath();
        g.fill();
        g.restore();
    };
    for (let k = 0; k < 4; k++) {
        ray(k * Math.PI / 2, h, 3.2);
        ray(Math.PI / 4 + k * Math.PI / 2, h * 0.45, 2);
    }
    const core = g.createRadialGradient(h, h, 0, h, h, h * 0.35);
    core.addColorStop(0, 'rgba(255,255,255,1)');
    core.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = core;
    g.fillRect(0, 0, size, size);

    return new THREE.CanvasTexture(c);
}
/** Most glints and hero dots drawn at once (a big map has a few hundred gold tiles). */
const MAX_DOTS = 1024;
const glint = new THREE.Color();

export class Fog {
    constructor(scene) {
        this.mask = new Uint8Array(W * H * 4);
        this.texture = new THREE.DataTexture(this.mask, W, H, THREE.RGBAFormat);
        this.texture.magFilter = THREE.LinearFilter;
        this.texture.minFilter = THREE.LinearFilter;
        this.material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: { mask: { value: this.texture }, time: { value: 0 }, size: { value: new THREE.Vector2(W, H) } },
            vertexShader: 'varying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
            fragmentShader: `uniform sampler2D mask; uniform float time; uniform vec2 size; varying vec2 vW;
                float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
                float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
                    return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
                float fbm(vec2 p){ float v = 0., a = .5; for (int k = 0; k < 4; k++) { v += a*n(p); p *= 2.03; a *= .5; } return v; }
                void main(){
                    float m = texture2D(mask, vW / size).r;
                    if (m < 0.01) discard;
                    vec2 p = vW * 0.45 + vec2(time * 0.12, time * 0.03);
                    float c = fbm(p);
                    vec3 col = mix(vec3(0.047,0.039,0.06), vec3(0.24,0.21,0.31), smoothstep(0.35, 0.9, c));
                    gl_FragColor = vec4(col, smoothstep(0.05, 0.6, m));
                }`,
        });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(W + 2, H + 2).rotateX(-Math.PI / 2).translate(W / 2, FOG_Y, H / 2), this.material);
        plane.renderOrder = 10;
        scene.add(plane);
        this.plane = plane;
        const dots = (size, map = glowTexture()) => {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * MAX_DOTS), 3));
            geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(3 * MAX_DOTS), 3));
            const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map, size, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
            pts.renderOrder = 11;
            pts.frustumCulled = false;
            scene.add(pts);

            return pts;
        };
        this.glints = dots(1.2, starTexture());
        this.heroes = dots(0.9);
        this.game = null;
    }

    update(time) {
        this.material.uniforms.time.value = time;
        if (G.fogDirty || this.game !== G) {
            for (let i = 0; i < N; i++) {
                this.mask[i * 4] = G.seen[i] ? 0 : 255;
            }
            this.texture.needsUpdate = true;
            G.fogDirty = false;
            this.game = G;
        }
        // gold and gems glint, through the clouds and on discovered seams alike
        let n = 0;
        const gp = this.glints.geometry.attributes.position;
        const gc = this.glints.geometry.attributes.color;
        for (let i = 0; i < N && n < MAX_DOTS; i++) {
            const t = G.t[i];
            if (t !== GOLD && t !== GEM) {
                continue;
            }
            const x = tx(i);
            const y = ty(i);
            // through the clouds a steady twinkle; on a discovered seam now and then a short sparkle
            const wave = Math.sin(time * (G.seen[i] ? 1.1 + hash(x, y, 31) : 2.2) + hash(x, y) * 40);
            const tw = G.seen[i] ? Math.max(0, wave - 0.93) / 0.07 : 0.45 + 0.55 * Math.max(0, wave);
            if (tw <= 0) {
                continue;
            }
            gp.setXYZ(n, x + 0.3 + hash(x, y, 11) * 0.4, FOG_Y + 0.05, y + 0.3 + hash(x, y, 21) * 0.4);
            const c = glint.set(t === GOLD ? ASSETS.goldColor : ASSETS.gemColor).multiplyScalar(t === GOLD ? 1.15 : 1.6);
            gc.setXYZ(n, c.r * tw, c.g * tw, c.b * tw);
            n++;
        }
        this.glints.geometry.setDrawRange(0, n);
        gp.needsUpdate = true;
        gc.needsUpdate = true;
        // invading heroes in undiscovered ground: white dots
        n = 0;
        const hp = this.heroes.geometry.attributes.position;
        const hc = this.heroes.geometry.attributes.color;
        for (const e of unknownHeroes()) {
            if (n >= MAX_DOTS) {
                break;
            }
            const p = 0.6 + 0.4 * Math.sin(time * 5 + e.id);
            hp.setXYZ(n, e.x, FOG_Y + 0.1, e.y);
            hc.setXYZ(n, p, p, p);
            n++;
        }
        this.heroes.geometry.setDrawRange(0, n);
        hp.needsUpdate = true;
        hc.needsUpdate = true;
    }
}
