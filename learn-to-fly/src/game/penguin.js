import { state } from './state.js';

/*
 * The penguin (sprite 95, "player"): its parts show the glider and rocket you own. The original did
 * this in onClipEvent(load) handlers on the parts.
 */

const glider = { load: (c) => c.gotoAndStop(state.levels.gliders + 1) };
const rocket = { load: (c) => c.gotoAndStop(state.levels.rockets + 1) };

export default {
    clips: {
        '95:6': glider,
        '95:8': {
            load(c) {
                c.gotoAndStop(state.levels.rockets + 1);
                c.visible = false;
            },
        },
        '95:12': rocket,
        '95:15': {
            load(c) {
                c.visible = state.levels.rockets !== 1;
            },
        },
        '95:20': glider,
    },
};
