/**
 * Sound, made on the fly with the Web Audio API: no sound files. sound(name, x, y) plays one effect from
 * SOUNDS; with a position it is quieter the farther it is from the middle of the view (and silent off
 * screen), so a busy dungeon does not turn into noise. Everything runs through a small cave echo. A low
 * cave drone with dripping water plays underneath while a game runs. The audio starts on the first click
 * or key press, as browsers require; the speaker button (or V) mutes it, remembered in this browser.
 */
import { store } from './storage.js';
import { view } from '../render/view.js';

let ctx = null;
let master = null;
let noiseBuffer = null;
let muted = false;
let ambient = null;
const last = {};

muted = !store.readBool('option.sound', true);

/** The audio graph, made on first use: everything -> master -> (dry + cave echo) -> speakers. */
function audio() {
    if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) {
            return null;
        }
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.8;
        const echo = ctx.createConvolver();
        echo.buffer = caveEcho();
        const wet = ctx.createGain();
        wet.gain.value = 0.28;
        master.connect(ctx.destination);
        master.connect(echo).connect(wet).connect(ctx.destination);
        noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = noiseBuffer.getChannelData(0);
        for (let i = 0; i < d.length; i++) {
            d[i] = Math.random() * 2 - 1;
        }
    }
    if (ctx.state === 'suspended') {
        ctx.resume();
    }

    return ctx;
}

/** A short, dark, decaying echo, like a stone tunnel. */
function caveEcho() {
    const len = Math.floor(ctx.sampleRate * 1.4);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
        const d = b.getChannelData(c);
        for (let i = 0; i < len; i++) {
            d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * (i < ctx.sampleRate * 0.02 ? 0 : 1);
        }
    }

    return b;
}

/** A gain envelope: up to `vol` in `attack` seconds, then down to silence over `decay`. */
function env(t, vol, attack, decay) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(master);

    return g;
}

/** Filtered noise: thuds, scrapes, cracks and whooshes. `sweep` moves the filter to that frequency. */
function noise(t, { vol, freq, q = 1, type = 'bandpass', attack = 0.004, decay = 0.15, sweep = 0 }) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuffer;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) {
        f.frequency.exponentialRampToValueAtTime(sweep, t + attack + decay);
    }
    s.connect(f).connect(env(t, vol, attack, decay));
    s.start(t, Math.random() * 0.5);
    s.stop(t + attack + decay + 0.05);
}

/** A tone: pitch from `freq` (to `to`, if set), for clinks, chimes, horns and zaps. */
function tone(t, { vol, freq, to = 0, type = 'sine', attack = 0.004, decay = 0.3, glide = 0 }) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) {
        o.frequency.exponentialRampToValueAtTime(to, t + (glide || attack + decay));
    }
    o.connect(env(t, vol, attack, decay));
    o.start(t);
    o.stop(t + attack + decay + 0.05);
}

const rnd = (a, b) => a + Math.random() * (b - a);

/**
 * Every sound: `gap` is the shortest time between two of the same (so 20 imps digging sound like a crew,
 * not a hailstorm), `play(t, v)` makes it at time t with volume v.
 */
const SOUNDS = {
    // a pick in earth: a dull thud with some grit
    dig: { gap: 0.07, play: (t, v) => {
        noise(t, { vol: 0.5 * v, freq: rnd(260, 380), q: 1.2, decay: 0.12 });
        noise(t, { vol: 0.12 * v, freq: 2400, q: 0.8, decay: 0.05 });
    } },
    // a pick on a gold seam: a thud and a bright ring
    gold: { gap: 0.07, play: (t, v) => {
        noise(t, { vol: 0.35 * v, freq: 400, q: 1.2, decay: 0.08 });
        tone(t, { vol: 0.12 * v, freq: rnd(1900, 2300), decay: 0.25 });
        tone(t, { vol: 0.06 * v, freq: rnd(3000, 3400), decay: 0.18 });
    } },
    // a pick on gems: a glassy ring
    gem: { gap: 0.07, play: (t, v) => {
        noise(t, { vol: 0.3 * v, freq: 500, q: 1.2, decay: 0.07 });
        tone(t, { vol: 0.1 * v, freq: rnd(2600, 3000), decay: 0.4 });
        tone(t, { vol: 0.06 * v, freq: rnd(3900, 4300), decay: 0.3 });
    } },
    // a hammer on a wall
    hammer: { gap: 0.08, play: (t, v) => {
        noise(t, { vol: 0.45 * v, freq: 700, q: 2, decay: 0.07 });
        tone(t, { vol: 0.08 * v, freq: rnd(900, 1100), decay: 0.09, type: 'triangle' });
    } },
    // a wall finished: a deep stone settle
    wall: { gap: 0.2, play: (t, v) => {
        noise(t, { vol: 0.5 * v, freq: 160, q: 0.8, decay: 0.35, type: 'lowpass' });
    } },
    // ground claimed: a soft magic shimmer
    claim: { gap: 0.12, play: (t, v) => {
        tone(t, { vol: 0.07 * v, freq: 660, to: 990, decay: 0.3, attack: 0.03 });
        tone(t + 0.05, { vol: 0.05 * v, freq: 1320, decay: 0.25, attack: 0.02 });
    } },
    // gold into a Treasury: a little coin jingle
    coins: { gap: 0.1, play: (t, v) => {
        for (let k = 0; k < 4; k++) {
            tone(t + k * rnd(0.03, 0.06), { vol: 0.07 * v, freq: rnd(2200, 3400), decay: 0.12 });
        }
    } },
    // a lot of gold at once (payday): a longer jingle
    payday: { gap: 1, play: (t, v) => {
        for (let k = 0; k < 14; k++) {
            tone(t + k * rnd(0.03, 0.07), { vol: 0.06 * v, freq: rnd(2000, 3600), decay: 0.15 });
        }
    } },
    // a melee blow
    hit: { gap: 0.05, play: (t, v) => {
        noise(t, { vol: 0.55 * v, freq: rnd(500, 800), q: 1.5, decay: 0.09 });
        tone(t, { vol: 0.08 * v, freq: rnd(140, 180), to: 70, decay: 0.12, type: 'triangle' });
    } },
    // a bolt or arrow flying off
    shot: { gap: 0.06, play: (t, v) => {
        noise(t, { vol: 0.25 * v, freq: 3000, q: 3, attack: 0.01, decay: 0.2, sweep: 700 });
    } },
    // a unit falls
    death: { gap: 0.1, play: (t, v) => {
        tone(t, { vol: 0.12 * v, freq: rnd(380, 460), to: 120, decay: 0.55, type: 'sawtooth', attack: 0.02 });
        noise(t + 0.25, { vol: 0.4 * v, freq: 180, decay: 0.25, type: 'lowpass' });
    } },
    // a hero knocked out: a groan and a thump
    knockout: { gap: 0.2, play: (t, v) => {
        tone(t, { vol: 0.1 * v, freq: 300, to: 160, decay: 0.4, type: 'triangle', attack: 0.03 });
        noise(t + 0.2, { vol: 0.4 * v, freq: 200, decay: 0.2, type: 'lowpass' });
    } },
    // the Heart hit
    heart: { gap: 0.25, play: (t, v) => {
        tone(t, { vol: 0.2 * v, freq: 70, to: 45, decay: 0.5, type: 'sine', attack: 0.01 });
        noise(t, { vol: 0.25 * v, freq: 300, decay: 0.15 });
    } },
    // the Heart zapping a hero
    zap: { gap: 0.1, play: (t, v) => {
        tone(t, { vol: 0.07 * v, freq: 1800, to: 220, decay: 0.18, type: 'sawtooth' });
    } },
    // a room built: stone slabs set down
    build: { gap: 0.06, play: (t, v) => {
        noise(t, { vol: 0.35 * v, freq: 260, q: 1, decay: 0.12, type: 'lowpass' });
        tone(t, { vol: 0.05 * v, freq: rnd(520, 640), decay: 0.12, type: 'triangle' });
    } },
    // tiles sold
    sell: { gap: 0.06, play: (t, v) => {
        noise(t, { vol: 0.3 * v, freq: 900, q: 1, decay: 0.15, sweep: 300 });
    } },
    // the Hand grabs a unit
    pickup: { gap: 0.05, play: (t, v) => {
        noise(t, { vol: 0.25 * v, freq: 400, q: 2, attack: 0.02, decay: 0.15, sweep: 1600 });
    } },
    // the Hand drops a unit
    drop: { gap: 0.05, play: (t, v) => {
        noise(t, { vol: 0.25 * v, freq: 1400, q: 2, attack: 0.01, decay: 0.12, sweep: 300 });
        noise(t + 0.12, { vol: 0.4 * v, freq: 220, decay: 0.12, type: 'lowpass' });
    } },
    // a slap
    slap: { gap: 0.05, play: (t, v) => {
        noise(t, { vol: 0.7 * v, freq: 2500, q: 0.7, type: 'highpass', attack: 0.001, decay: 0.06 });
        noise(t, { vol: 0.3 * v, freq: 600, decay: 0.05 });
    } },
    // something through a portal (an arrival, a dismissal, a new imp)
    portal: { gap: 0.2, play: (t, v) => {
        tone(t, { vol: 0.09 * v, freq: 220, to: 880, decay: 0.6, attack: 0.08, type: 'triangle' });
        tone(t, { vol: 0.05 * v, freq: 330, to: 1320, decay: 0.6, attack: 0.08 });
    } },
    // Heal
    heal: { gap: 0.3, play: (t, v) => {
        [523, 659, 784, 1047].forEach((f, k) => tone(t + k * 0.07, { vol: 0.08 * v, freq: f, decay: 0.5, attack: 0.01 }));
    } },
    // Lightning
    thunder: { gap: 0.2, play: (t, v) => {
        noise(t, { vol: 0.6 * v, freq: 4000, q: 0.5, type: 'highpass', attack: 0.002, decay: 0.12 });
        noise(t + 0.05, { vol: 0.7 * v, freq: 300, type: 'lowpass', attack: 0.02, decay: 1.2, sweep: 60 });
    } },
    // Call to Arms, and an invasion: a horn
    horn: { gap: 1, play: (t, v) => {
        for (const [f, d] of [[146.8, 0], [146.8 * 1.5, 0.5]]) {
            tone(t + d, { vol: 0.1 * v, freq: f, decay: 0.9, attack: 0.12, type: 'sawtooth' });
            tone(t + d, { vol: 0.06 * v, freq: f * 1.005, decay: 0.9, attack: 0.12, type: 'sawtooth' });
        }
    } },
    // research complete
    chime: { gap: 0.5, play: (t, v) => {
        [784, 988, 1175].forEach((f, k) => tone(t + k * 0.12, { vol: 0.08 * v, freq: f, decay: 0.8, attack: 0.01 }));
    } },
    // a marked block, a button: a soft tick
    tick: { gap: 0.03, play: (t, v) => {
        tone(t, { vol: 0.04 * v, freq: 1200, decay: 0.03 });
    } },
    // victory
    win: { gap: 2, play: (t, v) => {
        [392, 523, 659, 784, 1047].forEach((f, k) => tone(t + k * 0.15, { vol: 0.1 * v, freq: f, decay: 1.2, attack: 0.02, type: 'triangle' }));
    } },
    // defeat
    lose: { gap: 2, play: (t, v) => {
        [220, 207.7, 196, 146.8].forEach((f, k) => tone(t + k * 0.35, { vol: 0.12 * v, freq: f, decay: 1.2, attack: 0.05, type: 'sawtooth' }));
    } },
};

/**
 * Plays sound `name`. With a map position (tile coordinates) it fades with the distance from the middle
 * of the view; far outside the view it is not played at all.
 */
export function sound(name, x, y) {
    const s = SOUNDS[name];
    if (!s || muted || !ctx) {
        return;
    }
    let v = 1;
    if (x !== undefined) {
        const f = view.focus();
        if (!f) {
            return;
        }
        const reach = f.dist * 0.75 + 4;
        v = 1 - Math.hypot(x - f.x, y - f.z) / reach;
        if (v <= 0.05) {
            return;
        }
        v *= Math.min(1, 16 / f.dist);
    }
    const now = ctx.currentTime;
    if (last[name] !== undefined && now - last[name] < s.gap) {
        return;
    }
    last[name] = now;
    s.play(now + 0.01, v);
}

/** The cave underneath: a low, slowly breathing drone, and now and then a drop of water. */
export function startAmbient() {
    if (ambient || !audio()) {
        return;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 140;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 0.07;
    depth.gain.value = 0.025;
    lfo.connect(depth).connect(g.gain);
    src.connect(f).connect(g).connect(master);
    src.start();
    lfo.start();
    const drip = () => {
        if (!muted) {
            const t = ctx.currentTime + 0.01;
            const p = rnd(900, 1600);
            tone(t, { vol: 0.03, freq: p, to: p * 2.2, decay: 0.12, glide: 0.06 });
        }
        ambient.timer = setTimeout(drip, rnd(2500, 9000));
    };
    ambient = { timer: setTimeout(drip, 3000) };
}

export const isMuted = () => muted;

/** Sound on or off (remembered in this browser). */
export function setMuted(m) {
    muted = m;
    store.write('option.sound', !m);
    if (master) {
        master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05);
    }
}

// Browsers only allow sound after a user gesture: the first one starts it.
for (const ev of ['pointerdown', 'keydown']) {
    addEventListener(ev, () => {
        audio();
        startAmbient();
    }, { capture: true });
}
