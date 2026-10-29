/**
 * The simulation: paddles (a human's follows its target, the computer reads the ball, see cpus.js), the
 * ball (spin curves it, walls bounce it) and the hit sparks. Hits and misses go to the rules in game.js.
 */
import { sounds } from './audio.js';
import { R, T, clamp, far, levelData, limitX, limitY, near, renderer, state } from './context.js';
import { launch, missed } from './game.js';
import { pressed } from './input.js';
import { emit } from './online.js';

/** The palette colour of a side ('near' or 'far'), as "r, g, b" for the hit sparks. */
export function accent(side) {
    return renderer.palette()[side === 'near' ? 'nearRgb' : 'farRgb'];
}

export function spark(ball, color) {
    state.sparks.push({ x: ball.x, y: ball.y, z: ball.z, age: 0, life: 0.45, color });
}

/** Moves a human's paddle towards its target: the pointer or the keys here, or the network online. */
export function moveHuman(side, dt, useKeys) {
    if (useKeys) {
        const keySpeed = 2.6 * dt;
        if (pressed('left')) side.target.x -= keySpeed;
        if (pressed('right')) side.target.x += keySpeed;
        if (pressed('up')) side.target.y -= keySpeed;
        if (pressed('down')) side.target.y += keySpeed;
        side.target.x = clamp(side.target.x, limitX);
        side.target.y = clamp(side.target.y, limitY);
    }

    const oldX = side.x;
    const oldY = side.y;
    const follow = Math.min(1, dt * 30);
    side.x += (side.target.x - side.x) * follow;
    side.y += (side.target.y - side.y) * follow;
    // The paddle's speed, smoothed a little, is what puts spin on the ball.
    const smoothing = Math.min(1, dt * 18);
    side.vx += ((side.x - oldX) / dt - side.vx) * smoothing;
    side.vy += ((side.y - oldY) / dt - side.vy) * smoothing;
}

/** The computer: reads the ball on its way in (better on later levels) and moves at a capped speed. */
function moveCpu(side, dt) {
    const ball = state.ball;
    const level = levelData();
    const incoming = side === near ? ball.vz < 0 : ball.vz > 0;
    let aimX = 0;
    let aimY = 0;
    if (state.mode === 'play' && incoming) {
        const time = Math.abs((side.z - ball.z) / ball.vz);
        const predictedX = clamp(ball.x + ball.vx * time, T.halfWidth);
        const predictedY = clamp(ball.y + ball.vy * time, T.halfHeight);
        const read = Math.max(0, Math.min(1, level.opponentAim + side.cpu.aim));
        aimX = ball.x + (predictedX - ball.x) * read;
        aimY = ball.y + (predictedY - ball.y) * read;
    } else if (state.mode === 'play') {
        aimX = ball.x * side.cpu.follow;
        aimY = ball.y * side.cpu.follow;
    }
    const step = level.opponentSpeed * side.cpu.speed * dt;
    const oldX = side.x;
    const oldY = side.y;
    side.x = clamp(side.x + clamp(aimX - side.x, step), limitX);
    side.y = clamp(side.y + clamp(aimY - side.y, step), limitY);
    side.vx = (side.x - oldX) / dt;
    side.vy = (side.y - oldY) / dt;
}

/** Both paddles: yours from the pointer and keys, the far one from the network online, else the computer. */
export function movePaddles(dt) {
    if (near.human) {
        moveHuman(near, dt, true);
    } else {
        moveCpu(near, dt);
    }
    if (far.human) {
        moveHuman(far, dt, false);
    } else {
        moveCpu(far, dt);
    }
}

function hits(side, ball) {
    return Math.abs(ball.x - side.x) <= T.paddleHalfWidth + T.ballRadius
        && Math.abs(ball.y - side.y) <= T.paddleHalfHeight + T.ballRadius;
}

/** One small step of the ball: spin, walls, and a paddle's hit or miss at either end. */
export function moveBall(dt) {
    const ball = state.ball;
    ball.vx += ball.sx * dt;
    ball.vy += ball.sy * dt;
    const decay = Math.pow(R.spinDecayPerSecond, dt);
    ball.sx *= decay;
    ball.sy *= decay;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.z += ball.vz * dt;

    // Walls: bounce, and the curve turns around with the ball.
    const maxX = T.halfWidth - T.ballRadius;
    const maxY = T.halfHeight - T.ballRadius;
    let bounced = false;
    if (Math.abs(ball.x) > maxX) {
        ball.x = Math.sign(ball.x) * maxX;
        ball.vx = -ball.vx;
        ball.sx = -ball.sx;
        bounced = true;
    }
    if (Math.abs(ball.y) > maxY) {
        ball.y = Math.sign(ball.y) * maxY;
        ball.vy = -ball.vy;
        ball.sy = -ball.sy;
        bounced = true;
    }
    if (bounced) {
        sounds.wall();
        emit({ e: 'wall' });
    }

    if (ball.vz < 0 && ball.z <= near.z) {
        if (hits(near, ball)) {
            launch(near, true);
        } else {
            missed(near);
        }
    } else if (ball.vz > 0 && ball.z >= far.z) {
        if (hits(far, ball)) {
            launch(far, true);
        } else {
            missed(far);
        }
    }
}

/** Sparks age and fade; the flash behind the far paddle after a point dies down. */
export function ageEffects(dt) {
    for (const item of state.sparks) {
        item.age += dt;
    }
    state.sparks = state.sparks.filter((item) => item.age < item.life);
    state.backFlash = Math.max(0, state.backFlash - dt * 2.5);
}
