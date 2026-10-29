import { audio, g, music } from './context.js';
import { clearData } from './menu.js';
import { freshState, options, state } from './state.js';

/*
 * The start: the root's first frames go straight to init (frame 4), which places the scene fades,
 * and on to the main menu (frame 6). The menu opens finished, with Play and Clear Saved Data, not
 * with its title animation.
 */

const MENU_FRAME = 6;
const CLEAR_DATA_FRAME = 15;
const MENU_DONE = 'menu2';

/** Called by the player on every root frame change (see index.js). */
export function enterRootFrame(frame) {
    if (frame === CLEAR_DATA_FRAME) {
        // This frame only has a stop() in the SWF, so its screen is opened from here.
        clearData(g.root);
        return;
    }
    if (frame !== MENU_FRAME) {
        return;
    }
    const menu = g.root.get('titlescreen');
    if (menu) {
        menu.gotoAndPlay(MENU_DONE);
        music.attach('shop.wav');
    }
}

export default {
    frames: {
        root: {
            1: (root) => root.gotoAndPlay('init'),
            2: (root) => root.gotoAndPlay('init'),
            4: (root) => {
                Object.assign(state, freshState());
                audio.setVolume(options.mute ? 0 : 100);
                root.gotoAndPlay('mainmenu');
            },
        },
    },
};
