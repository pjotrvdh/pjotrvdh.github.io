import { CHARS, EXPORTS, soundUrl } from '../render/library.js';

/*
 * Sound with the Web Audio API: the original MP3s, played the way the AS2 Sound object and the
 * timelines did. A Sound (new Sound() in the scripts) attaches an exported sound by name, starts it
 * with an offset and loop count, has a volume and calls onSoundComplete. Timelines start event sounds
 * (StartSound) and streams.
 *
 * Two channels, each switched on or off in the sound panel (controls.js): `music` (the background
 * music and the cutscenes' streamed soundtracks) and `sfx` (everything else).
 */

const buffers = new Map();
let ctx = null;
/** The channels' gain nodes, by name; their on/off state is kept here until the context exists. */
const channels = { music: null, sfx: null };
const channelOn = { music: true, sfx: true };
const playing = new Set();

function context() {
    if (!ctx) {
        ctx = new AudioContext();
        for (const name of Object.keys(channels)) {
            channels[name] = ctx.createGain();
            channels[name].gain.value = channelOn[name] ? 1 : 0;
            channels[name].connect(ctx.destination);
        }
    }
    return ctx;
}

/** Resumes audio after a user gesture (browsers start it suspended). */
export function unlockAudio() {
    const c = context();
    if (c.state === 'suspended') {
        c.resume();
    }
}

function load(file) {
    let p = buffers.get(file);
    if (!p) {
        p = fetch(soundUrl(file)).then((r) => r.arrayBuffer()).then((data) => context().decodeAudioData(data)).catch(() => null);
        buffers.set(file, p);
    }
    return p;
}

/** Decodes every sound up front, so the first play has no delay. */
export function preloadSounds() {
    for (const c of Object.values(CHARS)) {
        if (c.t === 'sound') {
            load(c.file);
        } else if (c.t === 'sprite' && c.stream) {
            load(c.stream.file);
        }
    }
}

/** One playing sound: a buffer source with its own gain. */
class Voice {
    constructor(file, { offset = 0, loops = 0, volume = 1, onEnd = null, id = null, channel = 'sfx' } = {}) {
        this.file = file;
        this.id = id;
        this.stopped = false;
        this.startedAt = 0;
        this.offset = offset;
        this.gain = context().createGain();
        this.gain.gain.value = volume;
        this.gain.connect(channels[channel]);
        this.onEnd = onEnd;
        playing.add(this);
        load(file).then((buffer) => {
            if (!buffer || this.stopped) {
                return;
            }
            this.duration = buffer.duration;
            this.remaining = Math.max(0, loops);
            this.play(buffer, offset);
        });
    }

    play(buffer, offset) {
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(this.gain);
        src.onended = () => {
            if (this.stopped || this.source !== src) {
                return;
            }
            if (this.remaining > 1) {
                this.remaining--;
                this.play(buffer, 0);
                return;
            }
            this.finish();
            this.onEnd?.();
        };
        this.source = src;
        this.startedAt = ctx.currentTime - offset;
        if (offset < buffer.duration) {
            src.start(0, offset);
        } else {
            queueMicrotask(() => src.onended());
        }
    }

    /** Playing position in milliseconds. */
    get position() {
        return this.source ? (ctx.currentTime - this.startedAt) * 1000 : 0;
    }

    setVolume(v) {
        this.gain.gain.value = v;
    }

    finish() {
        this.stopped = true;
        playing.delete(this);
    }

    stop() {
        if (this.stopped) {
            return;
        }
        this.finish();
        try {
            this.source?.stop();
        } catch {
            // Not started yet.
        }
        this.gain.disconnect();
    }
}

/** The AS2 Sound object. `channel` is 'sfx' unless set to 'music' (context.js does for the music). */
export class Sound {
    constructor(channel = 'sfx') {
        this.channel = channel;
        this.file = null;
        this.volume = 100;
        this.voice = null;
        this.onSoundComplete = null;
    }

    attachSound(name) {
        const id = EXPORTS[name];
        this.file = CHARS[id]?.file ?? null;
    }

    /** start(secondOffset, loops). */
    start(offset = 0, loops = 0) {
        if (!this.file) {
            return;
        }
        this.voice?.stop();
        this.voice = new Voice(this.file, {
            offset,
            loops,
            volume: this.volume / 100,
            channel: this.channel,
            onEnd: () => this.onSoundComplete?.call(this),
        });
    }

    stop() {
        this.voice?.stop();
        this.voice = null;
    }

    setVolume(v) {
        this.volume = v;
        this.voice?.setVolume(v / 100);
    }

    get position() {
        return this.voice?.position ?? 0;
    }
}

export const audio = {
    /** A StartSound tag on a timeline. */
    timelineSound(id, info = {}) {
        const file = CHARS[id]?.file;
        if (!file) {
            return;
        }
        if (info.stop) {
            for (const v of [...playing]) {
                if (v.id === id) {
                    v.stop();
                }
            }
            return;
        }
        if (info.noMultiple && [...playing].some((v) => v.id === id)) {
            return;
        }
        new Voice(file, { loops: info.loops ?? 0, id });
    },

    /** A timeline's stream sound (a cutscene's soundtrack), from an offset in seconds; returns something with stop(). */
    playStream(file, offset) {
        return new Voice(file, { offset, channel: 'music' });
    },

    /** stopAllSounds(). */
    stopAll() {
        for (const v of [...playing]) {
            v.stop();
        }
    },

    /** Pauses or resumes every sound (the pause button). */
    pause(on) {
        const c = context();
        if (on) {
            c.suspend();
        } else {
            c.resume();
        }
    },

    /** Switches a channel ('music' or 'sfx') on or off. */
    setChannel(name, on) {
        channelOn[name] = on;
        if (channels[name]) {
            channels[name].gain.value = on ? 1 : 0;
        }
    },
};
