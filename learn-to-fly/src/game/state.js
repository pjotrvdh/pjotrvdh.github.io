import config from '../config/index.js';

/*
 * The saved game: what the original kept in its SharedObject "learntofly". The names in comments
 * are the original variables.
 */

const KEY = 'learn-to-fly-save';
const KINDS = ['distance', 'altitude', 'speed', 'duration'];

export { KINDS };

/** A new game. */
export function freshState() {
    return {
        day: 0, // cday
        cash: 0,
        ramp: 1, // lvlramp: the ramp picked in the stage menu (1-5)
        levels: {
            rampHeight: 1, // lvlrh
            rampSlide: 1, // lvlrf
            aerodynamics: 1, // lvlre
            gliders: 1, // lvlgl
            rockets: 1, // lvlro
            fuel: 1, // lvlrp
        },
        // stagedis13 … stagedur53: done achievements per ramp.
        achievements: config.ramps.map(() => Object.fromEntries(KINDS.map((k) => [k, false]))),
        gameFinished: false,
        keepPlaying: false,
        // infoboard1-3: the tutorial boards seen (start, first glider, first rocket).
        boards: [false, false, false],
    };
}

export const state = freshState();

/** The settings (controls.js keeps them in localStorage `learn-to-fly-options`). */
export const options = {
    quality: 3,
    skipCutscenes: false,
    showControls: true,
    // Volumes, 0..100, set with the sound panel's sliders: music starts off, sound effects at full.
    music: 0,
    sfx: 100,
    // The volumes before M muted everything (M again brings them back).
    unmute: null,
};

export function save() {
    try {
        localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
        // Private mode or full storage: the game still plays.
    }
}

/** Loads the saved game into `state`; false when there is none. */
export function load() {
    try {
        const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
        if (!saved) {
            return false;
        }
        const fresh = freshState();
        Object.assign(state, fresh, saved, { levels: { ...fresh.levels, ...saved.levels } });
        return true;
    } catch {
        return false;
    }
}

/** resetVars(): a new game, saved straight away. */
export function reset() {
    Object.assign(state, freshState());
    save();
}

/** Total achievements done, over all ramps. */
export function achievementCount() {
    return state.achievements.reduce((n, a) => n + KINDS.filter((k) => a[k]).length, 0);
}

/** The value of an upgrade at its current level. */
export function upgradeValue(name) {
    return config.upgrades[name].values[state.levels[name] - 1];
}
