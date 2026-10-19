/**
 * Laser sound effects, made on the fly with the Web Audio API: no sound files. Each one is a "pew": a
 * fast, deep pitch drop on two slightly detuned oscillators, ending in a low rumble that fades out.
 * The audio context starts on the first click or key press, as browsers require.
 */
let context = null;
let muted = false;

function ensureContext() {
    if (!context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) {
            return null;
        }
        context = new AudioContext();
    }
    if (context.state === 'suspended') {
        context.resume();
    }

    return context;
}

/**
 * One laser "pew": the pitch falls fast and deep (most of the drop in the first tenth of a second),
 * stays loud until the drop is done, then fades out in a long low tail.
 *
 * @param {number} from Hz at the start.
 * @param {number} to Hz at the end of the sweep.
 * @param {number} duration Seconds, tail included.
 * @param {{sweep?: number, type?: OscillatorType, volume?: number, delay?: number, detune?: number, wobble?: number}} options
 *   sweep: seconds the pitch takes to fall (default: 40% of the duration); detune: cents between the
 *   two oscillators; wobble: how fast the pitch trembles, in Hz (0 = none)
 */
function zap(from, to, duration, { sweep = duration * 0.4, type = 'sawtooth', volume = 0.05, delay = 0, detune = 18, wobble = 0 } = {}) {
    const audio = muted ? null : ensureContext();
    if (!audio) {
        return;
    }

    const start = audio.currentTime + delay;
    const swept = start + sweep;
    const end = start + duration;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.setValueAtTime(volume, swept * 0.5 + start * 0.5);
    gain.gain.exponentialRampToValueAtTime(volume * 0.9, swept);
    // The tail: a gentle fade first, so the rumble lingers, then out.
    gain.gain.exponentialRampToValueAtTime(volume * 0.35, swept + (end - swept) * 0.45);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    // A low-pass filter that closes with the sweep: bright at the start, a dark rumble in the tail.
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 6;
    filter.frequency.setValueAtTime(Math.min(16000, from * 3), start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(150, to * 4), swept);
    filter.connect(gain).connect(audio.destination);

    // An optional wobble: a slow oscillator that nudges the pitch up and down.
    let trembleDepth = null;
    if (wobble) {
        const tremble = audio.createOscillator();
        trembleDepth = audio.createGain();
        tremble.frequency.value = wobble;
        trembleDepth.gain.value = to * 0.3;
        tremble.connect(trembleDepth);
        tremble.start(start);
        tremble.stop(end + 0.02);
    }

    for (const cents of [-detune / 2, detune / 2]) {
        const oscillator = audio.createOscillator();
        oscillator.type = type;
        oscillator.detune.value = cents;
        // Exponential: the drop is fastest at the start, like a real "pew".
        oscillator.frequency.setValueAtTime(from, start);
        oscillator.frequency.exponentialRampToValueAtTime(to, swept);
        if (trembleDepth) {
            trembleDepth.connect(oscillator.frequency);
        }
        oscillator.connect(filter);
        oscillator.start(start);
        oscillator.stop(end + 0.02);
    }
}

export const sounds = {
    unlock: ensureContext,
    /** Off the wall: a tiny, high pew. */
    wall: () => zap(4200, 900, 0.09, { sweep: 0.05, type: 'square', volume: 0.02, detune: 6 }),
    /** Your shot: the full pew, from a bright crack down to a low rumble. */
    playerHit: () => zap(3600, 60, 0.75, { sweep: 0.25, volume: 0.05 }),
    /** The opponent's shot: the same pew a little lower and darker. */
    opponentHit: () => zap(2600, 45, 0.75, { sweep: 0.28, volume: 0.045, detune: 26 }),
    /** A bonus: two quick, short pews, the second higher. */
    bonus: () => {
        zap(3000, 400, 0.14, { sweep: 0.08, type: 'square', volume: 0.025 });
        zap(4400, 600, 0.16, { sweep: 0.09, type: 'square', volume: 0.025, delay: 0.1 });
    },
    /** You missed: a long, deep pew that rumbles out. */
    miss: () => zap(3000, 30, 1.0, { sweep: 0.55, volume: 0.05, wobble: 14 }),
    /** You scored: a pew turned around, charging up. */
    point: () => zap(90, 3200, 0.4, { sweep: 0.3, type: 'square', volume: 0.03 }),
    /** Level cleared: four rising pews. */
    levelClear: () => [140, 200, 280, 400].forEach((frequency, step) => zap(frequency, frequency * 12, 0.22, { sweep: 0.16, type: 'square', volume: 0.028, delay: step * 0.13 })),
    /** Game over: three deep pews, each lower than the last. */
    gameOver: () => [3200, 2200, 1500].forEach((frequency, step) => zap(frequency, 35, 0.7, { sweep: 0.35, volume: 0.045, delay: step * 0.32 })),
};

export function setMuted(value) {
    muted = value;
}

export function isMuted() {
    return muted;
}
