import { g, music } from './context.js';
import { clearData } from './menu.js';
import { freshState, load, state } from './state.js';

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
                // The original's init: fresh values. localStorage holds the game as it is now, so it
                // is read straight back (the original only read it on Play), or the twice-a-second
                // sync would write the fresh values over it.
                Object.assign(state, freshState());
                load();
                root.gotoAndPlay('mainmenu');
            },
        },
    },
};
