/**
 * The camera: Dungeon Keeper's tilted top-down view. It looks at a point on the ground (`target`)
 * from a fixed pitch, at a distance (zoom), and can be turned in quarter turns (Q / E). World units are
 * tiles: tile (x, y) covers x..x+1 on X and y..y+1 on Z, with the ground at Y = 0.
 */
import * as THREE from 'three';
import { H, W } from '../game/constants.js';

const PITCH = 0.98; // radians above the horizon (about 56 degrees)
const MIN_DIST = 5;
const MAX_DIST = 140;

export class CameraRig {
    constructor() {
        this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300);
        this.target = new THREE.Vector3(W / 2, 0, H / 2);
        this.yaw = 0;
        this.yawGoal = 0;
        this.dist = 14;
        this.width = 1;
        this.height = 1;
        this.anchor = null;
        this.ray = new THREE.Raycaster();
        this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.apply();
    }

    resize(w, h) {
        this.width = w;
        this.height = h;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.apply();
    }

    apply() {
        const c = Math.cos(PITCH) * this.dist;
        this.camera.position.set(this.target.x + Math.sin(this.yaw) * c, Math.sin(PITCH) * this.dist, this.target.z + Math.cos(this.yaw) * c);
        this.camera.lookAt(this.target);
        this.camera.updateMatrixWorld();
    }

    /** Eases quarter turns; call every frame. */
    update(dt) {
        if (this.yaw !== this.yawGoal) {
            const d = this.yawGoal - this.yaw;
            const s = Math.min(1, dt * 8);
            this.yaw = Math.abs(d) < 0.002 ? this.yawGoal : this.yaw + d * s;
            this.apply();
        }
    }

    clamp() {
        this.target.x = Math.max(0, Math.min(W, this.target.x));
        this.target.z = Math.max(0, Math.min(H, this.target.z));
        this.dist = Math.max(MIN_DIST, Math.min(MAX_DIST, this.dist));
        this.apply();
    }

    /** A ray through screen point (sx, sy) in CSS pixels. */
    rayAt(sx, sy) {
        this.ray.setFromCamera(new THREE.Vector2(sx / this.width * 2 - 1, -(sy / this.height) * 2 + 1), this.camera);

        return this.ray.ray;
    }

    /** Where screen point (sx, sy) meets the plane Y = `y`, or null. */
    groundAt(sx, sy, y = 0) {
        this.ground.constant = -y;
        const p = new THREE.Vector3();

        return this.rayAt(sx, sy).intersectPlane(this.ground, p) ? p : null;
    }

    centerOn(x, y) {
        this.target.set(x + 0.5, 0, y + 0.5);
        this.clamp();
    }

    zoomAt(factor, sx, sy) {
        const before = this.groundAt(sx, sy);
        this.dist /= factor;
        this.clamp();
        const after = this.groundAt(sx, sy);
        if (before && after) {
            this.target.x += before.x - after.x;
            this.target.z += before.z - after.z;
            this.clamp();
        }
    }

    zoomBy(factor) {
        this.zoomAt(factor, this.width / 2, this.height / 2);
    }

    /** Shows the whole map. */
    fit() {
        const t = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
        this.target.set(W / 2, 0, H / 2);
        this.dist = Math.max((W / 2 + 1) / (t * this.camera.aspect), (H / 2 + 1) * Math.sin(PITCH) / t);
        this.clamp();
    }

    /** A quarter turn left (-1) or right (+1). */
    rotate(dir) {
        this.yawGoal += dir * Math.PI / 2;
    }

    /** Starts dragging the ground: the point under (sx, sy) stays under the pointer while panTo() moves it. */
    panStart(sx, sy) {
        this.anchor = this.groundAt(sx, sy);
    }

    panTo(sx, sy) {
        const p = this.groundAt(sx, sy);
        if (!this.anchor || !p) {
            return;
        }
        this.target.x += this.anchor.x - p.x;
        this.target.z += this.anchor.z - p.z;
        this.clamp();
    }

    /** Scrolls with the keys: `right` and `down` are -1, 0 or 1 in screen directions. */
    panKeys(right, down, dt) {
        const v = this.dist * 0.9 * dt;
        const s = Math.sin(this.yaw);
        const c = Math.cos(this.yaw);
        this.target.x += (right * c + down * s) * v;
        this.target.z += (-right * s + down * c) * v;
        this.clamp();
    }

    /** The ground area in view, as four points in tile coordinates (for the minimap). */
    groundView() {
        const corners = [[0, 0], [this.width, 0], [this.width, this.height], [0, this.height]];

        return corners.map(([sx, sy]) => {
            let p = this.groundAt(sx, sy);
            if (!p || p.distanceTo(this.camera.position) > 120) {
                // a ray above the horizon: use a far point in its direction
                const r = this.rayAt(sx, sy);
                p = r.origin.clone().addScaledVector(new THREE.Vector3(r.direction.x, 0, r.direction.z).normalize(), 60);
            }

            return [p.x, p.z];
        });
    }

    /** Screen position (CSS pixels) of a world point, and whether it is in front of the camera. */
    toScreen(v) {
        const p = v.clone().project(this.camera);

        return { x: (p.x + 1) / 2 * this.width, y: (1 - p.y) / 2 * this.height, ok: p.z < 1 };
    }
}
