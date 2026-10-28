/**
 * One skater's movement: rolling, steering, pushing, ollies, flying, landing and bailing, on a park
 * from src/game/park.js. Arcade rules, tuned in config/physics.js; a fixed time step (world.tickRate).
 *
 * - On the ground the board rolls where it points (`heading`, 0 = +z), at a signed `speed` (negative =
 *   fakie). Slopes pull along the board; edges higher than `stepUp` are walls.
 * - Rolling off an edge, popping an ollie or flying out of a transition makes it airborne: then it
 *   flies with velocity (vx, vy, vz) and steering spins the body.
 * - It lands when it reaches the ground: lined up with the direction of travel (forwards or fakie) it
 *   rolls on, otherwise it bails.
 *
 * Plain data and maths only: this module doesn't use three.js, so it can run anywhere (tests, later a server).
 */

const TAU = Math.PI * 2;

/** An angle in (−π, π]. */
export const wrapAngle = (angle) => angle - TAU * Math.floor((angle + Math.PI) / TAU);

const towardZero = (value, amount) => (value > 0 ? Math.max(0, value - amount) : Math.min(0, value + amount));

/**
 * A new skater standing still at a spawn point.
 *
 * @param {{x: number, y: number, z: number, heading: number}} spawn
 */
export function createSkater(spawn) {
    return {
        x: spawn.x, y: spawn.y, z: spawn.z, heading: spawn.heading,
        speed: 0, vx: 0, vy: 0, vz: 0,
        grounded: true,
        /** Smoothed steering input, −1 (left) … 1 (right). */
        steer: 0,
        /** Seconds the jump button has been held (ollie charge). */
        charge: 0,
        jumpHeld: false,
        pushing: false,
        /** Seconds since the wheels last touched the ground. */
        airTime: 0,
        /** Whether this air started with an ollie (no second ollie until landing). */
        ollied: false,
        /** Radians turned in this air (signed, positive = left). */
        spin: 0,
        /** The transition flown out of, as [x, z] (the way it faces), or null. */
        vert: null,
        /** Seconds left of a bail, 0 when riding. */
        bail: 0,
        /** What happened this step, for sound, effects and the HUD: 'ollie', 'air', 'land', 'bail', 'wall'. */
        events: [],
    };
}

/** Puts a skater back on its feet at a spawn point. */
export function resetSkater(skater, spawn) {
    Object.assign(skater, createSkater(spawn), { events: skater.events });
}

/**
 * Advances a skater by one time step.
 *
 * @param {ReturnType<typeof createSkater>} s
 * @param {{steer: number, push: boolean, brake: boolean, jump: boolean}} input
 * @param {ReturnType<import('./park.js').buildPark>} park
 * @param {object} p config.physics
 * @param {number} dt seconds
 */
export function stepSkater(s, input, park, p, dt) {
    const steer = s.bail > 0 ? 0 : input.steer;
    s.steer += (steer - s.steer) * Math.min(1, p.steerResponse * dt);

    if (s.bail > 0) {
        s.bail = Math.max(0, s.bail - dt);
        s.speed = towardZero(s.speed, p.bailDecel * dt);
        s.charge = 0;
        s.jumpHeld = input.jump;
        roll(s, park, p, dt, false);

        return;
    }

    if (s.grounded) {
        ride(s, input, park, p, dt);
    } else {
        fly(s, input, park, p, dt);
    }
}

/** Upward speed of an ollie after holding jump for `charge` seconds. */
const ollieSpeed = (p, charge) => p.ollieSpeed + (p.ollieChargedSpeed - p.ollieSpeed) * Math.min(1, charge / p.ollieChargeTime);

function ride(s, input, park, p, dt) {
    const turnRate = p.turnRate + (p.turnRateFast - p.turnRate) * Math.min(1, Math.abs(s.speed) / p.maxSpeed);
    s.heading = wrapAngle(s.heading - s.steer * turnRate * dt);

    const fx = Math.sin(s.heading);
    const fz = Math.cos(s.heading);
    const g = park.slope(s.x, s.z, fx, fz);
    const cos = 1 / Math.sqrt(1 + g * g);
    const sin = g * cos;

    s.pushing = input.push && s.speed < p.pushSpeed;
    s.speed += (-p.gravity * p.slopeGravity * sin + (s.pushing ? p.pushAccel : 0)) * dt;
    s.speed = towardZero(s.speed, (p.coastDrag + (input.brake ? p.brakeDecel : 0)) * dt);
    s.speed = Math.max(-p.maxSpeed, Math.min(p.maxSpeed, s.speed));

    // Hold jump to crouch and charge, let go to pop.
    const released = s.jumpHeld && !input.jump;
    s.jumpHeld = input.jump;
    if (input.jump) {
        s.charge = Math.min(p.ollieChargeTime, s.charge + dt);
    }
    if (released) {
        takeOff(s, fx * s.speed * cos, s.speed * sin + ollieSpeed(p, s.charge), fz * s.speed * cos);
        s.ollied = true;
        s.charge = 0;
        s.events.push('ollie');

        return;
    }

    // Riding up a transition: at its steep top (or where its deck starts) fly straight up out of it.
    const facing = park.vertAt(s.x, s.z);
    const direction = Math.sign(s.speed);
    if (facing && s.speed * g > 0 && (fx * facing[0] + fz * facing[1]) * direction < -0.3) {
        const ahead = park.cell * 1.5 * direction;
        if (Math.abs(g) > p.vertLaunchSlope || !park.vertAt(s.x + fx * ahead, s.z + fz * ahead)) {
            const hx = fx * s.speed * cos;
            const hz = fz * s.speed * cos;
            const along = hx * facing[0] + hz * facing[1];
            takeOff(s, hx - facing[0] * along, Math.abs(s.speed) * p.vertBoost, hz - facing[1] * along);
            s.vert = facing;

            return;
        }
    }

    roll(s, park, p, dt, true);
}

/** Moves a grounded skater along the board: walls, edges to roll off, and following the ground. */
function roll(s, park, p, dt, canBail) {
    const fx = Math.sin(s.heading);
    const fz = Math.cos(s.heading);
    const g = park.slope(s.x, s.z, fx, fz);
    const cos = 1 / Math.sqrt(1 + g * g);
    const direction = Math.sign(s.speed) || 1;
    const mx = fx * direction;
    const mz = fz * direction;
    let distance = Math.abs(s.speed) * dt * cos;
    let nx = s.x + mx * distance;
    let nz = s.z + mz * distance;

    if (blocked(s, park, p, nx, nz, mx, mz)) {
        const xFree = Math.abs(mx) > 0.01 && !blocked(s, park, p, s.x + mx * distance, s.z, Math.sign(mx), 0);
        const zFree = Math.abs(mz) > 0.01 && !blocked(s, park, p, s.x, s.z + mz * distance, 0, Math.sign(mz));
        const along = (xFree && (!zFree || Math.abs(mx) >= Math.abs(mz))) ? [Math.sign(mx), 0] : zFree ? [0, Math.sign(mz)] : null;
        const share = along ? Math.abs(mx * along[0] + mz * along[1]) : 0;
        if (share < 0.35) {
            // Head-on: bounce back, or bail when going fast.
            if (canBail && Math.abs(s.speed) > p.wallBailSpeed) {
                bail(s, p, 0.3);
            } else {
                s.speed = -s.speed * p.wallBounce;
            }
            s.events.push('wall');

            return;
        }
        // At an angle: slide along the wall, turned to run parallel to it.
        s.speed *= share;
        s.heading = Math.atan2(along[0] * direction, along[1] * direction);
        distance *= share;
        nx = s.x + along[0] * distance;
        nz = s.z + along[1] * distance;
    }

    const ground = park.groundAt(nx, nz);
    const climb = s.speed * g * cos;
    const ballistic = s.y + climb * dt;
    // Transitions are curved but sampled in straight bits: stick to them instead of hopping off every kink.
    const curved = park.vertAt(nx, nz) !== null;
    const snap = curved ? p.vertStick : p.dropSnap;
    // Over a crest (a kicker's lip, the top of a funbox) the ground bends away faster than gravity can follow.
    const g2 = park.slope(nx, nz, Math.sin(s.heading), Math.cos(s.heading));
    const crest = !curved && (s.speed * g2 / Math.sqrt(1 + g2 * g2) - climb) / dt < -p.gravity * p.crest;
    if (crest || ballistic - ground > snap) {
        // The ground falls away faster than the board drops: off the edge.
        const speed = s.speed * cos;
        s.x = nx;
        s.z = nz;
        takeOff(s, Math.sin(s.heading) * speed, climb, Math.cos(s.heading) * speed);
        s.y = Math.max(ballistic, ground);

        return;
    }
    s.x = nx;
    s.z = nz;
    s.y = ground;
}

/**
 * Whether rolling to (x, z), moving in direction (mx, mz), runs into something too high to roll onto:
 * at the board's centre (compared with where it is now) or `probe` ahead of it, the nose (compared with
 * the ground one sample before, so a ramp ahead is a slope and a box ahead a wall).
 */
function blocked(s, park, p, x, z, mx, mz) {
    // Riding up a transition, the deck ahead is where you fly out (see ride()), not a wall.
    const facing = park.vertAt(s.x, s.z);
    const climbing = facing && mx * facing[0] + mz * facing[1] < -0.2;
    for (const reach of climbing ? [0] : [0, p.probe]) {
        const px = x + mx * reach;
        const pz = z + mz * reach;
        const from = reach ? park.groundNear(px - mx * park.cell, pz - mz * park.cell) : s.y;
        if (park.topNear(px, pz) - from <= p.stepUp) {
            continue;
        }
        // Up a transition from its front is riding, not a wall.
        const transition = park.vertAt(px, pz);
        if (transition && park.groundNear(px, pz) === park.topNear(px, pz) && mx * transition[0] + mz * transition[1] < -0.2) {
            continue;
        }

        return true;
    }

    return false;
}

function takeOff(s, vx, vy, vz) {
    s.grounded = false;
    s.vx = vx;
    s.vy = vy;
    s.vz = vz;
    s.airTime = 0;
    s.spin = 0;
    s.ollied = false;
    s.vert = null;
    s.pushing = false;
    s.events.push('air');
}

function fly(s, input, park, p, dt) {
    s.airTime += dt;

    // Late ollie just after rolling off an edge.
    const released = s.jumpHeld && !input.jump;
    s.jumpHeld = input.jump;
    if (!s.ollied && s.airTime < p.coyoteTime) {
        if (input.jump) {
            s.charge = Math.min(p.ollieChargeTime, s.charge + dt);
        } else if (released) {
            s.vy = Math.max(s.vy, 0) + ollieSpeed(p, s.charge);
            s.ollied = true;
            s.charge = 0;
            s.events.push('ollie');
        }
    }

    const turn = s.steer * p.spinRate * dt;
    s.heading = wrapAngle(s.heading - turn);
    s.spin -= turn;

    s.vy -= p.gravity * dt;
    let nx = s.x + s.vx * dt;
    let nz = s.z + s.vz * dt;
    const ny = s.y + s.vy * dt;

    // Something in the way at the new spot: an edge to land on, a transition to drop into, or a wall.
    const top = park.topNear(nx, nz);
    if (top > ny) {
        const ground = park.groundNear(nx, nz);
        const facing = park.vertAt(nx, nz);
        const ontoEdge = ground === top && ground - ny <= (s.vy <= 0 ? p.stepUp * 2 : p.stepUp);
        const intoTransition = facing && ground === top && s.vx * facing[0] + s.vz * facing[1] < 0;
        if (!ontoEdge && !intoTransition) {
            s.vx *= -p.wallBounce;
            s.vz *= -p.wallBounce;
            nx = s.x;
            nz = s.z;
            s.events.push('wall');
        }
    }

    s.x = nx;
    s.z = nz;
    s.y = ny;
    const ground = park.groundAt(nx, nz);
    if (s.y <= ground) {
        // Just off a lip and still rising, the ramp under the wheels lifts the board instead of landing it.
        if (s.vy > 0 && s.airTime < p.liftTime) {
            s.y = ground;
        } else {
            land(s, park, p, ground);
        }
    }
}

function land(s, park, p, ground) {
    const horizontal = Math.hypot(s.vx, s.vz);
    s.y = ground;
    s.grounded = true;
    s.charge = 0;

    if (s.vert) {
        // Back into the transition: line up straight up or down it, if close enough.
        const down = Math.atan2(s.vert[0], s.vert[1]);
        const offDown = Math.abs(wrapAngle(s.heading - down));
        const offUp = Math.abs(wrapAngle(s.heading - down - Math.PI));
        if (Math.min(offDown, offUp) * 180 / Math.PI > p.vertLandAngle) {
            return bail(s, p, Math.abs(s.vy) * 0.3, s.heading);
        }
        s.heading = wrapAngle(offDown < offUp ? down : down + Math.PI);
    } else if (horizontal > p.landAnySpeed) {
        const lined = (Math.sin(s.heading) * s.vx + Math.cos(s.heading) * s.vz) / horizontal;
        if (Math.abs(lined) < Math.cos(p.landAngle * Math.PI / 180)) {
            return bail(s, p, horizontal * 0.5, Math.atan2(s.vx, s.vz));
        }
        const travel = Math.atan2(s.vx, s.vz);
        s.heading = wrapAngle(lined > 0 ? travel : travel + Math.PI);
    }

    const fx = Math.sin(s.heading);
    const fz = Math.cos(s.heading);
    const g = park.slope(s.x, s.z, fx, fz);
    s.speed = (s.vx * fx + s.vy * g + s.vz * fz) / Math.sqrt(1 + g * g) * p.landKeep;
    s.vert = null;
    s.events.push('land');
}

/** Falls off the board, then slides `slide` m/s on along `heading` until getting up. */
function bail(s, p, slide, heading = s.heading) {
    s.heading = heading;
    s.grounded = true;
    s.vert = null;
    s.speed = slide;
    s.bail = p.bailTime;
    s.pushing = false;
    s.events.push('bail');
}
