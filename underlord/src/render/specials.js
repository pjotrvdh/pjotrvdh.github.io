/**
 * The landmarks: the Dungeon Heart (columns around a floating crystal that pulses, dims as the Heart weakens and flashes when hit), the portals
 * (an arch with a swirl, brighter once claimed), the Hero Gate (only once seen) and the Call to Arms flag.
 */
import * as THREE from 'three';
import { tx, ty } from '../game/constants.js';
import { ASSETS } from '../game/config.js';
import { G } from '../game/state.js';
import { glowTexture } from './effects.js';
import { clone } from './models.js';

function swirlMaterial() {
    return new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { time: { value: 0 }, power: { value: 1 }, colA: { value: new THREE.Color('#ff6ad5') }, colB: { value: new THREE.Color('#5b2a8a') } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
        fragmentShader: `uniform float time; uniform float power; uniform vec3 colA; uniform vec3 colB; varying vec2 vUv;
            void main(){ vec2 p = vUv*2.-1.; float r = length(p); if (r > 1.) discard;
              float a = atan(p.y,p.x); float s = 0.5+0.5*sin(a*3. + r*9. - time*3.*power);
              vec3 c = mix(colB, colA, s*(1.-r*0.6)); gl_FragColor = vec4(c, (0.35+0.6*power)*(1.-smoothstep(0.75,1.,r))); }`,
    });
}

/**
 * A crystal shard: a long six-sided point on a short one, its corners nudged a little (fixed seed) so
 * the facets are uneven, like the shard of The Dark Crystal.
 */
function shardGeometry(radius, up, down, seed) {
    const top = new THREE.ConeGeometry(radius, up, 6, 1).translate(0, up / 2, 0);
    const bottom = new THREE.ConeGeometry(radius, down, 6, 1).rotateX(Math.PI).translate(0, -down / 2, 0);
    const pos = [...top.toNonIndexed().attributes.position.array, ...bottom.toNonIndexed().attributes.position.array];
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(pos);
    // nudge every corner the same way wherever it repeats, so the facets stay closed
    const jitter = (v, k) => Math.sin(v * 91.7 + k * 13.1 + seed * 7.3) * radius * 0.18;
    for (let i = 0; i < arr.length; i += 3) {
        const [x, y, z] = [arr[i], arr[i + 1], arr[i + 2]];
        if (Math.abs(y - up) < 1e-4 || Math.abs(y + down) < 1e-4) {
            continue;
        }
        const key = Math.round(Math.atan2(z, x) * 100);
        arr[i] = x + jitter(key, 1);
        arr[i + 2] = z + jitter(key, 2);
        arr[i + 1] = y + jitter(key, 3) * 0.6;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    geo.computeVertexNormals();

    return geo;
}

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true, ...extra });

export class Specials {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        scene.add(this.group);
        this.game = null;
    }

    /** Builds the landmarks for the current map (on a new game or load). */
    build() {
        this.group.clear();
        const P = ASSETS.props;
        // Heart
        const heart = new THREE.Group();
        heart.position.set(G.hx + 0.5, 0, G.hy + 0.5);
        for (const [dx, dz] of [[-1.25, -1.25], [1.25, -1.25], [-1.25, 1.25], [1.25, 1.25]]) {
            const c = clone(P.heartColumn);
            if (c) {
                c.scale.setScalar(0.25);
                c.position.set(dx, 0, dz);
                heart.add(c);
            }
        }
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.1, 0.22, 8), std('#2a1a1c'));
        base.position.y = 0.11;
        heart.add(base);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.05, 6, 24).rotateX(Math.PI / 2), std('#2a1a30', { emissive: '#1a0626' }));
        ring.position.y = 0.24;
        heart.add(ring);
        // the Heart as a crystal shard (The Dark Crystal): a tall tilted point with smaller shards, a glowing
        // core and a faint shaft of light from above
        // in your colour (assets.js `keeper`): a dark body, glowing in the keeper colour
        this.keeper = new THREE.Color(ASSETS.keeper);
        this.crystalMaterial = std(this.keeper.clone().multiplyScalar(0.3), { emissive: this.keeper, emissiveIntensity: 0.6, roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.92 });
        this.heartCore = new THREE.Group();
        this.heartCore.position.y = 0.95;
        const main = new THREE.Mesh(shardGeometry(0.36, 1.4, 0.55, 1), this.crystalMaterial);
        main.rotation.z = 0.16;
        this.heartCore.add(main);
        for (let k = 0; k < 5; k++) {
            const a = k / 5 * Math.PI * 2 + 0.4;
            const s = new THREE.Mesh(shardGeometry(0.11, 0.48 + (k % 2) * 0.18, 0.15, k + 2), this.crystalMaterial);
            s.position.set(Math.cos(a) * 0.28, -0.14, Math.sin(a) * 0.28);
            s.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
            this.heartCore.add(s);
        }
        this.heartGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: this.keeper.clone().lerp(new THREE.Color(1, 1, 1), 0.25), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.heartGlow.scale.setScalar(1.3);
        this.heartGlow.position.y = 0.25;
        this.heartCore.add(this.heartGlow);
        heart.add(this.heartCore);
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.75, 6, 16, 1, true).translate(0, 3.4, 0), new THREE.MeshBasicMaterial({ color: this.keeper.clone().lerp(new THREE.Color(1, 1, 1), 0.75), transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
        heart.add(beam);
        this.heartLight = new THREE.PointLight(this.keeper, 6, 7, 1.6);
        this.heartLight.position.y = 1.3;
        heart.add(this.heartLight);
        this.group.add(heart);
        // Portals
        this.portals = G.portals.map((p) => {
            const g = new THREE.Group();
            g.position.set(tx(p) + 0.5, 0, ty(p) + 0.5);
            const arch = clone(P.portalArch);
            if (arch) {
                arch.scale.setScalar(0.27);
                g.add(arch);
            }
            const swirl = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), swirlMaterial());
            swirl.position.y = 0.5;
            g.add(swirl);
            const light = new THREE.PointLight('#c24bd6', 2, 4, 1.8);
            light.position.set(0, 0.6, 0.4);
            g.add(light);
            this.group.add(g);

            return { i: p, g, swirl, light };
        });
        // Hero Gate
        this.gate = new THREE.Group();
        this.gate.position.set(tx(G.gate) + 0.5, 0, ty(G.gate) + 0.5);
        const bars = clone(P.heroGate);
        if (bars) {
            bars.scale.setScalar(0.27);
            this.gate.add(bars);
        }
        const gl = new THREE.PointLight('#bcd2f0', 3, 5, 1.6);
        gl.position.set(0, 0.8, 0.5);
        this.gate.add(gl);
        this.gateLight = gl;
        this.group.add(this.gate);
        // Call to Arms flag
        this.flag = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 6).translate(0, 0.55, 0), std('#c9b28a'));
        this.flag.add(pole);
        const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.28).translate(0.21, 0, 0), std('#b3261e', { side: THREE.DoubleSide, emissive: '#3a0a06' }));
        cloth.position.y = 0.92;
        this.cloth = cloth;
        this.flag.add(cloth);
        this.group.add(this.flag);
        this.game = G;
    }

    update(time) {
        if (this.game !== G) {
            this.build();
        }
        // the heart beats, darkens as it weakens and flashes white when hit
        const beat = Math.pow(Math.max(0, Math.sin(time * 2.6)), 8);
        const hp = G.heartHP / G.heartMax;
        this.heartCore.scale.setScalar(1 + 0.05 * beat);
        this.heartCore.rotation.y = time * 0.25;
        this.heartCore.position.y = 0.9 + Math.sin(time * 1.3) * 0.06;
        const flash = Math.max(0, G.heartFlash) * 4;
        this.crystalMaterial.emissive.copy(this.keeper).lerp(new THREE.Color(1, 1, 1), Math.min(1, flash));
        this.crystalMaterial.emissiveIntensity = (0.2 + 0.6 * hp) * (0.75 + 0.45 * beat) + flash;
        this.heartGlow.material.opacity = (0.25 + 0.6 * hp) * (0.7 + 0.5 * beat) + flash;
        this.heartLight.intensity = (2 + 5 * hp) * (0.8 + 0.4 * beat) + flash * 6;
        for (const p of this.portals) {
            const own = !!G.pown[p.i];
            p.swirl.material.uniforms.time.value = time;
            p.swirl.material.uniforms.power.value = own ? 1 : 0.35;
            p.light.intensity = own ? 2.5 : 0.8;
        }
        this.gate.visible = !!G.seen[G.gate];
        this.gateLight.intensity = 2.5 + Math.sin(time * 2) * 0.6;
        const rally = G.rally && G.time < G.rally.until;
        this.flag.visible = !!rally;
        if (rally) {
            this.flag.position.set(tx(G.rally.i) + 0.5, 0, ty(G.rally.i) + 0.5);
            this.cloth.rotation.y = Math.sin(time * 4) * 0.25;
        }
    }

    /** Turns billboard-like parts (portal swirls, the gate) towards the camera's quarter. */
    face(yaw) {
        for (const p of this.portals ?? []) {
            p.g.rotation.y = Math.round(yaw / (Math.PI / 2)) * Math.PI / 2;
        }
        if (this.gate) {
            this.gate.rotation.y = Math.round(yaw / (Math.PI / 2)) * Math.PI / 2;
        }
    }
}
