import { audio, Sound } from './audio.js';
import { KINDS } from './state.js';

/*
 * What the scripts share: the player and root clip (set at boot), the background music, the fades
 * between scenes (the original's fade() and flashfade()) and the achievements won in the last flight.
 */

export const g = {
    /** @type {import('../render/player.js').Player} */
    player: null,
    /** @type {import('../render/display.js').MovieClip} */
    root: null,
};

/** Achievements won in the last flight, not yet shown (the original's _root.achdis … achdur). */
export const pending = Object.fromEntries(KINDS.map((k) => [k, false]));

export const anyPending = () => KINDS.some((k) => pending[k]);

/** The background music (the original's _root.bgm.theme): one looping export at a time. */
export const music = {
    sound: null,
    /** Attaches a sound; `play` starts it now (the flight's beat starts at the jump instead). */
    attach(name, play = true) {
        this.stop();
        const s = new Sound();
        s.attachSound(name);
        s.onSoundComplete = () => s.start(0, 0);
        this.sound = s;
        if (play) {
            s.start(0, 0);
        }
    },
    start() {
        this.sound?.start(0, 0);
    },
    stop() {
        if (this.sound) {
            this.sound.onSoundComplete = null;
            this.sound.stop();
            this.sound = null;
        }
    },
};

/** Goes to the achievements screen first when there are any, else to `label`. */
function gotoScene(label) {
    g.root.gotoAndPlay(anyPending() ? 'achievements' : label);
}

/**
 * fade(fout, fin, fadeto): with `fout` the snow sweeps in (fadeoutc) and the scene changes when it
 * covers the screen; with only `fin` the scene changes now and the snow sweeps away (fadeinc).
 */
export function fade(fout, fin, label) {
    const root = g.root;
    if (fout) {
        const f = root.c('fadeoutc');
        f.vars.fadeto = label;
        f.vars.fin = fin;
        f.gotoAndPlay(2);
        return;
    }
    root.c('fadeinc').gotoAndPlay(2);
    gotoScene(label);
}

/** flashfade(fadeto): the white flash before the outro. */
export function flashfade(label) {
    const f = g.root.c('flashfader');
    f.vars.fadeto = label;
    f.gotoAndPlay(2);
}

export { audio, gotoScene };
