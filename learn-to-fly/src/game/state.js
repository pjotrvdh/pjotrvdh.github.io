import config from '../config/index.js';
import { dropOldKey, has, readBool, readNumber, write } from './storage.js';

/*
 * The saved game: what the original kept in its SharedObject "learntofly", one localStorage key per
 * value (storage.js): learn-to-fly.day, .cash, .ramp, .level.<upgrade>, .achievement.<ramp 1-5>.<kind>,
 * .gameFinished, .keepPlaying, .cheated and .board.<1-3>. The names in comments are the original
 * variables.
 */

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
        // Set (and saved) once any cheat is used in this game; a new game clears it.
        cheated: false,
    };
}

export const state = freshState();

/** The settings (controls.js keeps them in localStorage, as learn-to-fly.option.*). */
export const options = {
    quality: 3,
    skipCutscenes: false,
    showControls: true,
    // Volumes, 0..100, set with the sound panel's sliders: music starts off, sound effects at full.
    music: 0,
    sfx: 100,
    // The volumes before M muted everything (M again brings them back); saved too.
    unmute: null,
};

export function save() {
    write('day', state.day);
    write('cash', state.cash);
    write('ramp', state.ramp);
    for (const [name, level] of Object.entries(state.levels)) {
        write(`level.${name}`, level);
    }
    state.achievements.forEach((done, i) => {
        for (const kind of KINDS) {
            write(`achievement.${i + 1}.${kind}`, done[kind]);
        }
    });
    write('gameFinished', state.gameFinished);
    write('keepPlaying', state.keepPlaying);
    write('cheated', state.cheated);
    state.boards.forEach((seen, i) => write(`board.${i + 1}`, seen));
}

/** Loads the saved game into `state`; false when there is none. Values that don't read keep their defaults. */
export function load() {
    if (!has('day')) {
        return false;
    }
    const fresh = freshState();
    state.day = readNumber('day', fresh.day, 0);
    state.cash = readNumber('cash', fresh.cash, 0);
    state.ramp = readNumber('ramp', fresh.ramp, 1, config.ramps.length);
    for (const name of Object.keys(fresh.levels)) {
        state.levels[name] = readNumber(`level.${name}`, fresh.levels[name], 1, config.upgrades[name].values.length);
    }
    state.achievements = fresh.achievements.map((done, i) => Object.fromEntries(KINDS.map((kind) => [kind, readBool(`achievement.${i + 1}.${kind}`, done[kind])])));
    state.gameFinished = readBool('gameFinished', fresh.gameFinished);
    state.keepPlaying = readBool('keepPlaying', fresh.keepPlaying);
    state.cheated = readBool('cheated', fresh.cheated);
    state.boards = fresh.boards.map((seen, i) => readBool(`board.${i + 1}`, seen));
    return true;
}

// The earlier format kept the game as JSON under learn-to-fly-save (the same fields): converted once.
dropOldKey('learn-to-fly-save', (text) => {
    const saved = JSON.parse(text);
    const fresh = freshState();
    Object.assign(state, fresh, saved, { levels: { ...fresh.levels, ...saved.levels } });
    save();
    Object.assign(state, freshState());
});

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
