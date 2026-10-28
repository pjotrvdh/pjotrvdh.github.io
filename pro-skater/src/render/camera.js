/**
 * The follow camera (config/camera.js): behind the skater's direction of travel, swinging round
 * smoothly, a little further back and wider at speed, and pulled in front of walls that get in the way.
 * Only the local skater moves it.
 */
import { wrapAngle } from '../game/skater.js';

const STEPS = 16;

/**
 * @param {import('three').PerspectiveCamera} camera
 * @param {object} config the game config
 */
export function createFollowCamera(camera, config) {
    let yaw = null;
    let height = 0;

    return {
        /** Jumps straight to the skater (after a spawn or reset). */
        snap() {
            yaw = null;
        },

        /**
         * @param {{x: number, y: number, z: number, heading: number}} pose interpolated position and heading
         * @param {ReturnType<import('../game/skater.js').createSkater>} s the skater's state
         * @param {ReturnType<import('../game/park.js').buildPark>} park
         * @param {number} dt seconds since the last frame
         */
        update(pose, s, park, dt) {
            const c = config.camera;
            const fast = Math.min(1, Math.abs(s.grounded ? s.speed : Math.hypot(s.vx, s.vz)) / config.physics.maxSpeed);

            // Look the way the skater travels; out of a quarter pipe keep looking at the ramp.
            let want = yaw ?? pose.heading;
            if (s.grounded && Math.abs(s.speed) > 1) {
                want = pose.heading + (s.speed < 0 ? Math.PI : 0);
            } else if (s.grounded && yaw === null) {
                want = pose.heading;
            } else if (!s.grounded && !s.vert && Math.hypot(s.vx, s.vz) > 1) {
                want = Math.atan2(s.vx, s.vz);
            }
            if (yaw === null) {
                yaw = want;
                height = pose.y;
            }
            yaw = wrapAngle(yaw + wrapAngle(want - yaw) * (1 - Math.exp(-c.yawFollow * dt)));
            height += (pose.y - height) * (1 - Math.exp(-c.heightFollow * dt));

            const distance = c.distance + c.distanceFast * fast;
            const lookX = pose.x;
            const lookY = pose.y + c.lookHeight;
            const lookZ = pose.z;
            let x = lookX - Math.sin(yaw) * distance;
            let y = height + c.height;
            let z = lookZ - Math.cos(yaw) * distance;

            // Walls between the skater and the camera: move the camera in front of them.
            for (let step = 1; step <= STEPS; step++) {
                const t = step / STEPS;
                const px = lookX + (x - lookX) * t;
                const py = lookY + (y - lookY) * t;
                const pz = lookZ + (z - lookZ) * t;
                if (park.topNear(px, pz) > py - 0.2) {
                    const keep = Math.max(0, t - c.wallMargin / distance - 1 / STEPS);
                    x = lookX + (x - lookX) * keep;
                    y = lookY + (y - lookY) * keep;
                    z = lookZ + (z - lookZ) * keep;
                    break;
                }
            }
            y = Math.max(y, park.groundAt(x, z) + 0.4);

            camera.position.set(x, y, z);
            camera.lookAt(lookX, lookY, lookZ);
            const fov = c.fov + c.fovFast * fast;
            if (Math.abs(camera.fov - fov) > 0.01) {
                camera.fov = fov;
                camera.updateProjectionMatrix();
            }
        },
    };
}
