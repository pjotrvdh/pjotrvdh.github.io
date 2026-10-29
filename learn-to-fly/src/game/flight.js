import config from '../config/index.js';
import { Sound } from './audio.js';
import { fade, flashfade, g, music, pending } from './context.js';
import { KINDS, options, state, upgradeValue } from './state.js';

/*
 * The flight (root frame 11, "game"), ported line by line from the original's getRamp(), getAir(),
 * getSea(), movecam() and getCloud(). The penguin slides down the ramp (hit-testing the ramp
 * shapes), jumps off its end, glides and fires its rocket, and bounces on or dives into the sea.
 * The camera moves the world, not the penguin. See .docs/flight.md.
 *
 * `f` holds the original's frame variables (curheight, speed, …); the HUD clips read it.
 */

const { physics: P, game: GAME } = config;
const DEG = Math.PI / 180;
const FOOT = P.pixelsPerFoot;

export const f = { curheight: 0, speed: 0 };

let keyListener = null;

const glider = () => upgradeValue('gliders');

/** The ramp part under x (ramp1-4), 'jump' past the end, or null before the start. */
function rampAt(root, x) {
    for (let i = 1; i <= 4; i++) {
        const r = root.get(`ramp${i}`);
        if (r && x > r.x && x < r.x + r.width - 1) {
            return r;
        }
    }
    const last = root.get('ramp4');
    return last && x > last.x + last.width - 1 ? 'jump' : null;
}

/** Moves y up out of the ramp, or down onto it, in half-pixel steps (at most 250). */
function settle(ramp, x, y) {
    if (!ramp || ramp === 'jump') {
        return y;
    }
    let j = 0;
    if (ramp.hitTest(x, y, true)) {
        while (ramp.hitTest(x, y, true) && j++ <= 250) {
            y -= 0.5;
        }
    } else {
        while (!ramp.hitTest(x, y, true) && j++ <= 250) {
            y += 0.5;
        }
    }
    return y;
}

function getRamp(root) {
    const player = root.c('player');
    const ramp2 = root.c('ramp2');
    f.slidesfx?.setVolume(Math.min(100, f.speed / 2 + 40));
    player.x += Math.cos(f.vdir) * f.vmag;
    const over = rampAt(root, player.x);
    if (over === ramp2) {
        player.y = ramp2.y - ramp2.height + ((player.x - ramp2.x) / ramp2.width) * ramp2.width;
    } else {
        player.y = settle(over, player.x, player.y);
    }
    const farx = player.x + P.lookAhead;
    const next = rampAt(root, farx);
    const fary = settle(next, farx, player.y);
    if (next !== 'jump') {
        const drop = fary - player.y;
        f.vdir = Math.atan(drop / P.lookAhead);
        f.vmag += drop > 0 ? drop * f.slide : P.flatSlide * f.slide;
        player.rotation = f.vdir / DEG + 90;
    } else if (!f.jumped) {
        // Off the ramp: the speed becomes velocity, the angle turns into degrees with the glider's sink.
        f.vx = Math.cos(f.vdir) * f.vmag;
        f.vy = Math.sin(f.vdir) * f.vmag;
        f.vdir = f.vdir / DEG + f.sink;
        f.jumped = true;
        if (options.showControls) {
            // The control reminders (hud.js) count from here.
            f.hintTick = g.player.tickCount;
        }
        f.slidesfx?.stop();
        f.slidesfx = null;
        music.start();
        const jump = new Sound();
        jump.attachSound('jump.wav');
        jump.setVolume(Math.min(65, f.speed / 2 - 15));
        jump.start(0, 0);
    }
}

/** The rocket's jet sound (the original's _root.rocketsfx), looping while Space is held. */
function jet(on) {
    if (on && !f.jet) {
        f.jet = new Sound();
        f.jet.attachSound('jet.wav');
        f.jet.setVolume(40 + state.levels.rockets * 15);
        f.jet.onSoundComplete = () => f.jet?.start(0, 0);
        f.jet.start(0, 0);
    } else if (!on && f.jet) {
        f.jet.onSoundComplete = null;
        f.jet.stop();
        f.jet = null;
    }
}

/** The glide: the part of the speed along the penguin's angle (glideratio) and the free fall (vx, vy). */
function glideMove(player) {
    player.x += Math.cos(f.vdir * DEG) * f.vmag * f.glideratio;
    player.y += Math.sin(f.vdir * DEG) * f.vmag * f.glideratio;
    player.x += f.vx * (1 - f.glideratio);
    player.y += f.vy;
}

function getAir(root) {
    const player = root.c('player');
    const sea = root.c('sea');
    const gl = glider();
    if (f.distance >= GAME.finishDistance && !state.gameFinished && !state.keepPlaying) {
        // Through the iceberg: the game is won.
        state.cash += GAME.finishBonus;
        flashfade('outro');
        state.gameFinished = true;
        music.stop();
        glideMove(player);
        return;
    }
    if (state.gameFinished && !state.keepPlaying) {
        glideMove(player);
        return;
    }
    f.duration += P.duration.perFrame;
    if (f.kickthrust > 0) {
        player.x += f.vx;
        player.y += f.vy;
        f.kickthrust--;
    } else {
        const turn = () => Math.max(0, P.extraSpin - (3 * f.vmag) / gl.criticalSpeed);
        if (g.player.isDown('ArrowLeft') && f.vdir > -P.maxAngle) {
            const t = turn();
            player.rotation -= P.spin + t;
            f.vdir -= P.spin + t;
        }
        if (g.player.isDown('ArrowRight') && f.vdir < P.maxAngle) {
            const t = turn();
            player.rotation += P.spin + t;
            f.vdir += P.spin + t;
        }
        if (g.player.isDown('Space') && f.rocketfuel > 0) {
            player.c('fuel').gotoAndStop(50 - Math.round((f.rocketfuel / upgradeValue('fuel')) * 50 - 0.5));
            jet(true);
            player.c('rocketflare').visible = true;
            f.vmag += f.rocketpower;
            f.vx += Math.cos(f.vdir * DEG) * f.rocketpower;
            f.vy += Math.sin(f.vdir * DEG) * f.rocketpower;
            f.rocketfuel--;
        } else {
            jet(false);
            player.c('rocketflare').visible = false;
        }
        f.drag = (f.sink - f.vdir) / 90;
        if (f.speed > gl.criticalSpeed) {
            f.drag += ((f.speed - gl.criticalSpeed) / gl.criticalSpeed) * 1.5;
        }
        f.vmag *= 1 - f.airfriction * f.drag * f.glideratio;
        f.vmag -= P.gravity * f.drag;
        let target = (f.vmag - gl.fallSpeed) / (gl.glideSpeed - gl.fallSpeed) - f.glideratio;
        if (target > P.glideAdjust) {
            target = P.glideAdjust;
        } else if (target < -P.glideAdjust) {
            target = -P.glideAdjust;
        }
        f.glideratio += target;
        if (f.glideratio > 1) {
            f.glideratio = 1;
        } else if (f.glideratio < P.minGlide) {
            f.glideratio = P.minGlide;
        }
        f.vy += P.gravity;
        f.vy *= 1 - 0.1 * f.glideratio;
        f.vy *= 1 - f.airfriction / 15;
        f.vx *= f.vx > f.vmag ? 1 - f.airfriction : 1 - f.airfriction / 10;
        glideMove(player);
    }

    f.curheight = (sea.y - player.y) / FOOT;
    if (f.curheight > 0) {
        return;
    }
    const splash = root.c('splash');
    const B = P.bounce;
    if (f.speed >= B.minSpeed && player.rotation >= B.minAngle && player.rotation <= B.maxAngle) {
        // Skimming the water: bounce back up.
        player.y = sea.y;
        f.vx *= B.friction;
        f.vmag *= B.friction;
        f.vy = ((f.vx + f.vmag) / 2) * B.power;
        splash.x = player.x;
        splash.y = player.y;
        splash.xscale = 100 + f.speed / 3;
        splash.yscale = 100 + f.speed / 3;
        splash.gotoAndPlay(1);
        if (f.vy < B.max) {
            f.vy = B.max;
        }
        player.rotation = 70;
        f.vdir = player.rotation - 90;
        return;
    }
    // Into the sea.
    splash.x = player.x;
    splash.y = sea.y;
    splash.xscale = 100 + f.speed / 3;
    splash.yscale = f.speed;
    splash.gotoAndPlay(1);
    jet(false);
    f.duration = Math.round(f.duration - 0.5);
    let tmod = 1 + f.distance / 1000;
    if (tmod > 2) {
        tmod = 2 - (f.distance - 1000) / 1500;
    }
    if (tmod < 0.5) {
        tmod = 0.5;
    }
    f.distance *= 0.4 * tmod;
    tmod = Math.min(2, 1 + f.maxaltitude / 50);
    f.maxaltitude *= 2 * tmod;
    f.vmag *= 0.7;
    f.vx = f.vx * (1 - f.glideratio) + Math.cos(f.vdir * DEG) * f.vmag * f.glideratio;
    f.vy = f.vy * (1 - f.glideratio) + Math.sin(f.vdir * DEG) * f.vmag * f.glideratio;
    f.landed = true;
    player.c('rocketflare').visible = false;
}

function getSea(root) {
    const player = root.c('player');
    f.vx *= P.sea.friction;
    f.vy *= P.sea.friction;
    f.vy += P.sea.buoyancy;
    player.x += f.vx;
    player.y += f.vy;
    player.rotation = Math.atan2(f.vy, f.vx) / DEG + 90;
}

/** The camera: everything but the penguin's screen position moves by camvx/camvy. */
function movecam(root, right, buffer, speed, friction) {
    const player = root.c('player');
    const sea = root.c('sea');
    f.camvx *= friction;
    f.camvy *= friction;
    if (player.x > right) {
        f.camvx -= speed * ((player.x - right) / buffer);
    } else if (f.camvx > -0.1 && f.camvx < 0.1) {
        f.camvx = 0;
    }
    if (player.y > 250 && sea.y > 400) {
        f.camvy -= speed * ((player.y - 250) / buffer);
    } else if (player.y < 150) {
        f.camvy += speed * ((150 - player.y) / buffer);
    } else if (f.camvy > -0.1 && f.camvy < 0.1) {
        f.camvy = 0;
    }
    player.x += f.camvx;
    player.y += f.camvy;
    const [r1, r2, r3, r4] = [1, 2, 3, 4].map((i) => root.c(`ramp${i}`));
    r1.x += f.camvx;
    r1.y += f.camvy;
    layoutRamps(r1, r2, r3, r4);
    for (let i = 1; i <= 4; i++) {
        const gfx = root.c(`gfxramp${i}`);
        const ramp = root.c(`ramp${i}`);
        gfx.x = ramp.x;
        gfx.y = ramp.y - 4020;
    }
    sea.x += f.camvx;
    sea.y += f.camvy;
    if (sea.x < -2000) {
        sea.x += 2000;
    }
    const skybg = root.c('skybg');
    skybg.x += f.camvx;
    skybg.y = player.y;
    if (skybg.x < -2000) {
        skybg.x += 2000;
    }
    const seagfx = root.c('seagfx');
    seagfx.x = sea.x;
    seagfx.y = sea.y;
    for (let j = 1; j < 7; j++) {
        const cloud = root.c(`cloud${j}`);
        cloud.x += f.camvx - 1;
        cloud.y += f.camvy;
    }
    const splash = root.c('splash');
    splash.x += f.camvx;
    splash.y += f.camvy;
}

/** The ramp parts join end to end; the third one is the 45° slope down. */
function layoutRamps(r1, r2, r3, r4) {
    r2.x = r1.x + r1.width - 1.5;
    r2.y = r1.y;
    r3.x = r2.x + r2.width - 1.5;
    r3.y = r2.y + r2.width - 1.5;
    r4.x = r3.x + r3.width - 1.5;
    r4.y = r3.y;
}

/** One cloud per frame that is far away is moved ahead of the penguin, in its direction of flight. */
function getCloud(root) {
    const player = root.c('player');
    const sea = root.c('sea');
    const tangle = Math.atan2(player.y - f.oldy, player.x - f.oldx) / DEG - 90;
    const cloud = root.c(`cloud${f.cloudcount}`);
    if (Math.hypot(cloud.x - player.x, cloud.y - player.y) > 1000) {
        cloud.x = 320 + 700 * Math.sin(-1 * (tangle + Math.random() * 90 - 45) * DEG);
        cloud.y = 240 + 700 * Math.cos((tangle + Math.random() * 90 - 45) * DEG);
        const r = Math.random();
        cloud.alpha = 40 + r * 70;
        cloud.xscale = 90 + r * 45;
        cloud.yscale = 90 + r * 45;
        if (cloud.y + 100 > sea.y) {
            cloud.y = sea.y + Math.random() * 380 + 100;
        }
    }
    f.cloudcount = f.cloudcount < 6 ? f.cloudcount + 1 : 1;
}

/** The flight is over (the penguin floats): achievements for this ramp, then the score board. */
function finish(root) {
    const player = root.c('player');
    player.vars.finished = true;
    f.finished = true;
    root.c('hudc').gotoAndPlay('hide');
    root.c('fboard').gotoAndPlay(1);
    const ramp = config.ramps[state.ramp - 1];
    const done = state.achievements[state.ramp - 1];
    const reached = {
        distance: f.distance,
        altitude: f.maxaltitude / 2,
        speed: f.maxspeed,
        duration: (f.duration - P.duration.start) / 0.6,
    };
    for (const kind of KINDS) {
        if (!done[kind] && !(reached[kind] < ramp[kind][0])) {
            pending[kind] = true;
            done[kind] = true;
        }
    }
    f.distance *= 0.4;
}

function frame(root) {
    const rv = root.vars;
    const player = root.c('player');
    const sea = root.c('sea');
    // The slide sound loops its middle part.
    if (f.slidesfx && f.slidesfx.position > 3150) {
        f.slidesfx.stop();
        f.slidesfx.start(0.65, 0);
    }
    root.c('skybg').alpha = (100 * f.speed) / 200;
    f.oldx = player.x;
    f.oldy = player.y;
    f.curheight = (sea.y - player.y) / FOOT;
    root.c('sky').gotoAndStop(Math.round(f.curheight * 0.75) - 50);
    if (f.speed > f.maxspeed) {
        f.maxspeed = f.speed;
    }
    const rampEnd = () => {
        const r4 = root.c('ramp4');
        return r4.x + r4.width;
    };
    if (!f.jumped) {
        getRamp(root);
    } else if (!f.landed) {
        getAir(root);
        f.distance = (player.x - rampEnd()) / FOOT;
        if (f.curheight > f.maxaltitude) {
            f.maxaltitude = f.curheight;
        }
    } else if (!f.finished) {
        getSea(root);
        f.distance = (player.x - rampEnd()) / FOOT;
        if (!(f.curheight < 0)) {
            player.y = sea.y;
            if (!(f.vx > P.sea.stopSpeed)) {
                finish(root);
            }
        }
    }
    getCloud(root);
    if (!f.finished) {
        f.speed = Math.hypot(player.x - f.oldx, player.y - f.oldy);
        rv.spehud = Math.round(f.speed);
        let alt = Math.round(f.curheight * 10) / 10;
        if (String(alt).indexOf('.') < 0) {
            alt = `${alt}.0`;
        }
        rv.althud = alt;
        rv.dishud = Math.round(f.distance);
    }
    rv.reshud = !(f.drag < 0) ? `${Math.round(f.drag * 99.5)}%` : '0%';
    movecam(root, 220, 2.5, 0.7, 0.6);
}

/** Any key or click on the score board: pay out and go to the shop. */
function collect() {
    if (!f.finished || f.finishclick) {
        return;
    }
    state.cash += Math.round(((Math.round(f.distance) + Math.round(f.maxaltitude)) * Math.round(f.duration)) / GAME.scoreDivisor);
    f.finishclick = true;
    fade(true, true, 'shop');
}

function startFlight(root) {
    const rv = root.vars;
    root.stop();
    const gl = glider();
    Object.assign(f, {
        cloudcount: 1,
        camvx: 0,
        camvy: 0,
        duration: P.duration.start,
        maxaltitude: 0,
        maxspeed: 0,
        finishclick: false,
        oldx: 0,
        oldy: 0,
        distance: 0,
        speed: 0,
        curheight: 0,
        slide: upgradeValue('rampSlide'),
        kickthrust: 0,
        sink: Math.atan(gl.sink) / DEG,
        drag: 0,
        airfriction: upgradeValue('aerodynamics'),
        glideratio: 0,
        rocketfuel: upgradeValue('fuel'),
        rocketpower: upgradeValue('rockets'),
        vx: 0,
        vy: 0,
        vdir: 0,
        vmag: P.startSpeed,
        jumped: false,
        landed: false,
        finished: false,
        jet: null,
        hintTick: null,
    });
    Object.assign(rv, { rdis: '$0', rdis2: 0, rdur: '0.00', rdur2: 0, rdur3: 0, ralt: '$0', ralt2: 0, rtotal: '$0', rtotal2: 0, rtotal3: 0 });
    Object.assign(rv, { spehud: 0, reshud: 0, althud: 0, dishud: 0 });
    for (const kind of KINDS) {
        pending[kind] = false;
    }

    const player = root.c('player');
    const sea = root.c('sea');
    player.x = 0;
    player.y = 200;
    for (let j = 1; j < 7; j++) {
        const cloud = root.c(`cloud${j}`);
        cloud.x = Math.random() * 900 - 300;
        cloud.y = Math.random() * 1000 - 600;
        cloud.alpha = 40 + Math.random() * 70;
        if (cloud.y > sea.y) {
            cloud.y = sea.y + Math.random() * 600 + 50;
        }
    }
    root.c('ramp2').gotoAndStop(state.ramp);
    root.c('gfxramp2').gotoAndStop(state.ramp);
    const [r1, r2, r3, r4] = [1, 2, 3, 4].map((i) => root.c(`ramp${i}`));
    r1.x = player.x - 300;
    r1.y = player.y + 4525;
    layoutRamps(r1, r2, r3, r4);
    sea.x = r1.x;
    sea.y = r3.y - r3.height + 150 + upgradeValue('rampHeight');
    root.c('fboard').gotoAndStop(1);
    root.c('hudc').c('hud').gotoAndStop(state.levels.gliders + 1);
    root.c('splash').stop();
    root.c('sky').stop();
    root.c('hint').visible = false;

    f.slidesfx = new Sound();
    f.slidesfx.attachSound('slide3.wav');
    f.slidesfx.start(0, 0);
    music.attach('beat', false);

    root.onEnterFrame = () => frame(root);
    root.onMouseDown = collect;
    if (keyListener) {
        g.player.keyListeners.delete(keyListener);
    }
    keyListener = { onKeyDown: collect };
    g.player.keyListeners.add(keyListener);
}

/** Leaving the flight (any other root frame): stop its sounds and handlers. */
export function endFlight() {
    f.slidesfx?.stop();
    f.slidesfx = null;
    jet(false);
    if (keyListener) {
        g.player.keyListeners.delete(keyListener);
        keyListener = null;
    }
}

/** HUD meters (one HUD per glider level): altitude and speed needles are frames of their clips. */
const altMeter = (frames) => ({
    enterFrame(c) {
        c.gotoAndStop(Math.min(frames, Math.round((frames * f.curheight) / glider().altitudeScale)));
    },
});
const speedMeter = (cap, jitter) => ({
    enterFrame(c) {
        let t = (200 * f.speed) / glider().criticalSpeed;
        if (t > cap) {
            t = jitter ? cap + Math.random() * 3 : cap;
        }
        c.gotoAndStop(Math.round(t));
    },
});

/** The score board (sprite 579): distance, altitude and the duration multiplier count up, then the total. */
function countUp(board, value, key) {
    board.onEnterFrame = () => {
        const rv = g.root.vars;
        rv[`${key}2`] += value() / 19;
        if (!(rv[`${key}2`] < value())) {
            rv[`${key}2`] = value();
        }
        rv[key] = `$${Math.round(rv[`${key}2`])}`;
    };
}

export default {
    frames: {
        root: { 11: startFlight },
        // The canvas's control reminders (sprite 569) stay hidden; hud.js shows them as text.
        569: { 138: (c) => c.stop(), 275: (c) => c.stop() },
        579: {
            2: () => music.stop(),
            19: () => {
                g.root.vars.boarddone = true;
            },
            20: (c) => countUp(c, () => f.distance, 'rdis'),
            41: (c) => countUp(c, () => f.maxaltitude, 'ralt'),
            61: (c) => {
                const localdur = Math.min(f.duration, GAME.maxBoardDuration);
                c.vars.rdur2 = 0;
                c.onEnterFrame = () => {
                    const rv = g.root.vars;
                    c.vars.rdur2 += localdur / 19;
                    rv.rdur3 = c.vars.rdur2 < localdur ? Math.round(rv.rdur2) / 10 : Math.round(localdur) / 10;
                    let text = String(rv.rdur3);
                    if (!(text.indexOf('.', 0) > 0)) {
                        text = `${text}.0`;
                    }
                    rv.rdur = `X${text}`;
                };
            },
            84: () => {
                const rv = g.root.vars;
                rv.rtotal3 = (Math.round(rv.rdis2) + Math.round(rv.ralt2)) * rv.rdur3;
                rv.rtotal = `$${Math.round(rv.rtotal3)}`;
            },
        },
    },
    clips: {
        '596:2': altMeter(200),
        '596:13': speedMeter(200, true),
        '618:2': altMeter(600),
        '618:15': speedMeter(208, false),
        '642:16': speedMeter(225, false),
    },
};
