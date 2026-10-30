import { Graphic } from '../render/display.js';
import { state } from './state.js';

/*
 * The pirate hat a penguin wears once its game has used a cheat (`state.cheated`, cheats.js): a black
 * tricorn with a gold trim and a skull and crossbones, drawn as a vector shape in the penguin's own
 * coordinates (sprite 95: upright, facing right, the top of the head at y ≈ -38). It is added to every
 * penguin as it is placed (the day intro, the flight and the ending), above its other parts.
 */

const PENGUIN = 95;
const HAT_DEPTH = 100;

/** The hat, in the format of the exported shapes (see .docs/engine.md). */
export const HAT = {
    t: 'shape',
    b: [-31, -62, 30, -25],
    fills: [
        { k: 's', c: [28, 28, 32, 255] },
        { k: 's', c: [52, 52, 58, 255] },
        { k: 's', c: [246, 244, 236, 255] },
    ],
    lines: [
        { w: 2.2, c: [226, 177, 60, 255], cap: 'round', join: 'round' },
        { w: 2.4, c: [246, 244, 236, 255], cap: 'round', join: 'round' },
    ],
    paths: [
        // The crown, and the brim turned up at both ends.
        ['f', 0, 'M-19 -33Q-20 -54 -2 -58Q16 -59 19 -36Z'],
        ['f', 0, 'M-31 -27Q-27 -43 -14 -39Q-4 -36 0 -37Q8 -40 18 -42Q30 -44 30 -30Q16 -34 2 -31Q-14 -28 -31 -27Z'],
        // A sheen on the crown.
        ['f', 1, 'M-14 -37Q-15 -51 -4 -54Q-11 -47 -10 -37Z'],
        // The gold trim along the brim.
        ['l', 0, 'M-29 -28Q-14 -29 2 -32Q16 -35 29 -31'],
        // Skull and crossbones.
        ['l', 1, 'M-6 -36L6 -42M-6 -42L6 -36'],
        ['f', 2, 'M0 -53Q5 -53 5 -48.5Q5 -46 3 -45L3 -43L-3 -43L-3 -45Q-5 -46 -5 -48.5Q-5 -53 0 -53Z'],
        ['f', 0, 'M-2.6 -49.5A1.3 1.3 0 1 0 -2.59 -49.5ZM2.6 -49.5A1.3 1.3 0 1 0 2.61 -49.5Z'],
    ],
};

/** Gives a penguin the hat when the game has used a cheat, and takes it off when not (called for every placed clip). */
export function dressPenguin(clip) {
    if (clip.id !== PENGUIN) {
        return;
    }
    if (!state.cheated) {
        clip.get('piratehat')?.removeMovieClip();
        return;
    }
    if (clip.get('piratehat')) {
        return;
    }
    const hat = new Graphic(clip.player, 'pirate-hat', HAT);
    hat.name = 'piratehat';
    clip.addChild(hat, HAT_DEPTH);
}
