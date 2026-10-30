import { STAGE } from '../render/library.js';
import { Player } from '../render/player.js';
import { audio, preloadSounds, unlockAudio } from './audio.js';
import { setupCheats } from './cheats.js';
import { setupControls } from './controls.js';
import { g, pending } from './context.js';
import { endFlight, f } from './flight.js';
import { hud } from './hud.js';
import { setupInput } from './input.js';
import { dressPenguin } from './pirate-hat.js';
import scripts from './scripts.js';
import { enterRootFrame } from './start.js';
import { load, save, state } from './state.js';
import { has, watch } from './storage.js';
import { oneTab } from '../../../shared/one-tab.js';
import { hideScreens, stateChanged } from './ui.js';

/*
 * Boots the game. The canvas fills the window: every scene is drawn edge to edge, with its
 * backgrounds scaled up to the window and, in flight, more of the world around (see Renderer.render()). The game runs at the original 33 frames per second; drawing follows the
 * display's refresh rate, interpolating positions in between.
 */

/** Root frame of the flight: the only scene drawn as a wide world. */
const FLIGHT_FRAME = 11;
/** Scene fades (fadeoutc, fadeinc, flashfader): always drawn over the whole window. */
const OVERLAYS = [108, 109, 119];
/** Replaced by HTML: the original options menu (148), flight HUD (644) and score board (579). */
const REPLACED = [148, 644, 579];
/**
 * The ramp menu's picture (457) sits below its old top bar: that area covers the window instead,
 * its top just below the window's top edge (the penguin of the high ramps stands at its very top);
 * the sky (423, one colour) goes on up to the window's top edge.
 */
const COVERED = new Map([[457, { rect: [0, 101, 640, 481], top: 24 }]]);
/**
 * In the ramp menu the ice under the penguin ends in a cliff mid-picture: on the 5' and 10' ramps
 * the iceberg shapes (431, 436), on the others the whole picture (440, 443, 446). A clean slice of
 * it (snow on top, ice below, no penguin) continues it to the window's left edge, drawn over the
 * cliff's first pixels so its edge line doesn't show. The sky (423)
 * continues up to the top edge.
 */
const EXTENDED = new Map([
    [423, { from: 0, slice: [0, 2], up: true }],
    [431, { from: 285.4, slice: [362, 364], overlap: 6 }],
    [436, { from: 247, slice: [326, 328], overlap: 6 }],
    [440, { from: 235, slice: [300, 302], overlap: 6 }],
    [443, { from: 239, slice: [281, 283], overlap: 6 }],
    [446, { from: 234, slice: [270, 272], overlap: 6 }],
]);
/** The sky gradient (520) is 640 × 480: stretched over the window in flight. */
const STRETCHED = [520];

const canvas = document.getElementById('stage');
const fx = document.getElementById('fx');
const player = new Player(canvas, scripts, audio);
player.renderer.fxCanvas = fx;
g.player = player;
g.root = player.root;
player.renderer.overlays = new Set(OVERLAYS);
player.onPlaced = dressPenguin;
player.renderer.skip = new Set(REPLACED);
player.renderer.stretch = new Set(STRETCHED);
player.renderer.coverRects = COVERED;
player.renderer.extend = EXTENDED;

/** On every scene change the root's handlers from the previous scene go (AS2 kept them, to no effect). */
player.onRootFrame = (frame) => {
    const root = player.root;
    hideScreens();
    root.onEnterFrame = null;
    root.onMouseDown = null;
    root.onMouseUp = null;
    root.onMouseMove = null;
    if (frame !== FLIGHT_FRAME) {
        endFlight();
    }
    enterRootFrame(frame);
};

/** The layout: CSS px per stage px (`s`) and where the stage's top left is (`ox`, `oy`). */
const view = { mode: 'scene', dpr: 1, s: 1, ox: 0, oy: 0, width: 0, height: 0 };

function layout() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (w !== view.width || h !== view.height || dpr !== view.dpr) {
        view.width = w;
        view.height = h;
        view.dpr = dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        fx.style.width = `${w}px`;
        fx.style.height = `${h}px`;
        fx.width = canvas.width;
        fx.height = canvas.height;
    }
    view.mode = player.root.frame === FLIGHT_FRAME ? 'world' : 'scene';
    // The stage as large as fits; the renderer fills the rest of the window (backgrounds scaled up, or
    // in flight the world around it). In flight the extra width goes ahead of the penguin.
    view.s = Math.min(w / STAGE.width, h / STAGE.height);
    const wide = w / h > STAGE.width / STAGE.height;
    view.ox = view.mode === 'world' && wide ? 0 : (w - STAGE.width * view.s) / 2;
    view.oy = (h - STAGE.height * view.s) / 2;
}

if (import.meta.env.DEV) {
    // For poking at the display list from the console; draw() redraws with the current layout.
    window.learnToFly = { player, g, view, state, pending, flight: f, draw: () => { layout(); player.draw(view); } };
}

/** Window (CSS px) to stage coordinates, for input. */
const toStage = (x, y) => ({ x: (x - view.ox) / view.s, y: (y - view.oy) / view.s });

hud.releasePad = setupInput(player, canvas, toStage, unlockAudio).releasePad;
const controls = setupControls(player);
setupCheats();

// localStorage holds the game as it is now: it is loaded at start, a value changed there by hand
// shows at once (the settings, or the game with the open screen, the HUD and the penguins' pirate
// hats), and twice a second what the game changed is written back (once a game was started: a new
// game saves straight away). Outside changes are taken in first, so they are not overwritten.
load();
const check = watch((keys) => {
    if (keys.some((k) => k.startsWith('option.'))) {
        controls.reloadOptions();
    }
    if (keys.some((k) => !k.startsWith('option.')) && load()) {
        stateChanged();
        player.eachClip(dressPenguin);
    }
});
// Only one tab keeps the game (shared/one-tab.js): another one shows a modal and writes nothing.
// Taken back, this tab reads what the other one left; when it is taken away, the game pauses.
let owner = false;
oneTab('learn-to-fly.game', {
    game: 'Learn to Fly',
    onOwner(again) {
        owner = true;
        if (again && load()) {
            stateChanged();
            player.eachClip(dressPenguin);
        }
    },
    onLost() {
        owner = false;
        controls.setPaused(true);
    },
});
setInterval(() => {
    check();
    if (owner && has('day')) {
        save();
    }
}, 500);

const step = 1000 / STAGE.fps;
let last = performance.now();
let acc = 0;

function loop(now) {
    acc += Math.min(250, now - last);
    last = now;
    let ticks = 0;
    while (acc >= step && ticks < 4) {
        if (!controls.paused) {
            player.tick();
        }
        acc -= step;
        ticks++;
    }
    if (ticks === 4) {
        acc = 0;
    }
    layout();
    player.draw(view, controls.paused ? 1 : acc / step);
    hud.update();
    requestAnimationFrame(loop);
}

preloadSounds();
player.start();
layout();
player.draw(view);
document.body.classList.add('ready');
requestAnimationFrame(loop);
