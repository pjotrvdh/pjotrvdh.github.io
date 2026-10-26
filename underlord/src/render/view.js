/**
 * The 3D view (three.js, WebGL). `view` is what the rest of the game uses: init() once, render() every
 * frame, pick() / pickUnit() to find what is under a screen point, and the camera controls.
 *
 * World units are tiles: tile (x, y) covers x..x+1 on X and y..y+1 on Z, the floor is Y = 0 and solid
 * blocks are TOP high. See camera.js for the camera.
 */
import * as THREE from 'three';
import { inb, ix } from '../game/constants.js';
import { ASSETS } from '../game/config.js';
import { G, app } from '../game/state.js';
import { CameraRig } from './camera.js';
import { Cursor, surface } from './cursor.js';
import { Effects } from './effects.js';
import { FOG_Y, Fog } from './fog.js';
import { loadModels } from './models.js';
import { Overlay } from './overlay.js';
import { Rooms } from './rooms.js';
import { Specials } from './specials.js';
import { Terrain } from './terrain.js';
import { Units } from './units.js';

let renderer;
let scene;
let parts = null;
const rig = new CameraRig();
const tmp = new THREE.Vector3();
/** Every model file the assets config names. */
function modelFiles() {
    const files = [...Object.values(ASSETS.tiles), ...Object.values(ASSETS.props), ...ASSETS.rigs];
    for (const u of Object.values(ASSETS.units)) {
        files.push(...[u.model, u.right, u.left].filter((f) => f && f.endsWith('.glb')));
    }

    return files;
}

export const view = {
    /** Sets up the renderer and loads the models; `onProgress(done, total)` reports loading. */
    async init(canvas, stage, labels, onProgress) {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        scene = new THREE.Scene();
        scene.background = new THREE.Color('#050404');
        scene.add(new THREE.AmbientLight('#8c7c94', 1.1));
        scene.add(new THREE.HemisphereLight('#d8c8ff', '#2a1a10', 0.7));
        const sun = new THREE.DirectionalLight('#ffe6c8', 1.6);
        sun.position.set(-8, 14, 10);
        scene.add(sun);
        const resize = () => {
            const r = stage.getBoundingClientRect();
            const w = Math.max(100, r.width);
            const h = Math.max(80, r.height);
            renderer.setSize(w, h, false);
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';
            rig.resize(w, h);
        };
        new ResizeObserver(resize).observe(stage);
        resize();
        await loadModels(modelFiles(), onProgress);
        const terrain = new Terrain(scene);
        const units = new Units(scene);
        parts = {
            terrain,
            rooms: new Rooms(scene),
            specials: new Specials(scene),
            units,
            effects: new Effects(scene),
            fog: new Fog(scene),
            overlay: new Overlay(labels, rig, units),
            cursor: new Cursor(scene),
        };
    },

    get ready() {
        return !!parts;
    },

    render(dt, time) {
        if (!parts || !G) {
            return;
        }
        rig.update(dt);
        parts.terrain.update();
        parts.rooms.update(time);
        parts.specials.update(time);
        parts.specials.face(rig.yaw);
        parts.units.update(dt, time, { x: app.hover.fx, z: app.hover.fy });
        parts.effects.update();
        parts.fog.update(time);
        parts.overlay.update(time);
        parts.cursor.update();
        renderer.render(scene, rig.camera);
    },

    /**
     * The tile under screen point (sx, sy): the first block top, cloud or floor the view ray meets.
     * Returns { fx, fy, x, y } in tile coordinates (x, y may be off the map), or null above the horizon.
     */
    pick(sx, sy) {
        if (!G) {
            return null;
        }
        const r = rig.rayAt(sx, sy);
        if (r.direction.y >= -1e-4) {
            return null;
        }
        const t0 = (FOG_Y + 0.01 - r.origin.y) / r.direction.y;
        const t1 = -r.origin.y / r.direction.y;
        const len = Math.hypot(r.direction.x, r.direction.z) * (t1 - t0);
        const steps = Math.ceil(len * 12) + 1;
        for (let k = 0; k <= steps; k++) {
            r.at(t0 + (t1 - t0) * k / steps, tmp);
            const x = Math.floor(tmp.x);
            const y = Math.floor(tmp.z);
            if (inb(x, y) && tmp.y <= surface(ix(x, y)) + 1e-4) {
                return { fx: tmp.x, fy: tmp.z, x, y };
            }
        }
        r.at(t1, tmp);

        return { fx: tmp.x, fy: tmp.z, x: Math.floor(tmp.x), y: Math.floor(tmp.z) };
    },

    /** The drawn unit nearest to screen point (sx, sy) for which `filter` holds, or null. */
    pickUnit(sx, sy, filter = () => true) {
        if (!parts || !G) {
            return null;
        }
        let best = null;
        let bd = Infinity;
        for (const { e, height } of parts.units.targets()) {
            if (!filter(e)) {
                continue;
            }
            const a = rig.toScreen(tmp.set(e.x, 0, e.y));
            const b = rig.toScreen(tmp.set(e.x, height, e.y));
            if (!a.ok) {
                continue;
            }
            const w = Math.max(10, Math.abs(a.y - b.y) * 0.45);
            // distance from the point to the unit's upright line on screen
            const vx = b.x - a.x;
            const vy = b.y - a.y;
            const l2 = vx * vx + vy * vy || 1;
            const t = Math.max(0, Math.min(1, ((sx - a.x) * vx + (sy - a.y) * vy) / l2));
            const d = Math.hypot(sx - (a.x + vx * t), sy - (a.y + vy * t));
            if (d < w && d < bd) {
                bd = d;
                best = e;
            }
        }

        return best;
    },

    centerOn: (x, y) => rig.centerOn(x, y),
    zoomAt: (f, sx, sy) => rig.zoomAt(f, sx, sy),
    zoomBy: (f) => rig.zoomBy(f),
    fit: () => rig.fit(),
    rotate: (dir) => rig.rotate(dir),
    panStart: (sx, sy) => rig.panStart(sx, sy),
    panTo: (sx, sy) => rig.panTo(sx, sy),
    panKeys: (right, down, dt) => rig.panKeys(right, down, dt),
    panPixels: (dx, dy) => rig.panPixels(dx, dy),
    groundView: () => rig.groundView(),
    /** The middle of the view on the map and how far the camera is from it (for sound volume). */
    focus: () => (parts ? { x: rig.target.x, z: rig.target.z, dist: rig.dist } : null),
};
