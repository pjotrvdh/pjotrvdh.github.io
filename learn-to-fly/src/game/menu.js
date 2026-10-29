import { fade, music } from './context.js';
import { load, reset, state } from './state.js';
import { h, hideClips, registerScreen, showScreen } from './ui.js';

/*
 * The main menu (root frame 6, the title screen sprite 317; start.js opens it at its end, menu2)
 * and the "clear all saved data?" question (frame 15).
 */

const ui = {};

/** Clear data (root frame 15): a chalk question instead of the canvas's (sprite 797). */
export function clearData(root) {
    root.stop();
    hideClips(root.children.find((c) => c.id === 797));
    if (!ui.screen) {
        let done = false;
        const answer = (yes) => () => {
            if (done) {
                return;
            }
            done = true;
            if (yes) {
                reset();
            }
            fade(true, true, 'mainmenu');
        };
        ui.screen = registerScreen('confirm', h('section', { class: 'confirm-screen', role: 'alertdialog', 'aria-label': 'Clear saved data' },
            h('div', { class: 'chalkboard confirm-card' },
                h('h2', {}, 'Do you want to clear all saved data?'),
                h('div', { class: 'end-buttons' },
                    h('button', { type: 'button', class: 'chalk-button', onclick: answer(true) }, 'Yes'),
                    h('button', { type: 'button', class: 'chalk-button', 'data-autofocus': true, onclick: answer(false) }, 'No')))));
        ui.reset = () => { done = false; };
    }
    ui.reset();
    showScreen('confirm');
}

export default {
    frames: {
        317: {
            119: (c) => {
                const btn = c.get('clearbtn');
                if (btn) {
                    btn.enabled = false;
                }
            },
            150: (c) => {
                c.stop();
                const btn = c.get('clearbtn');
                if (btn) {
                    btn.enabled = true;
                }
            },
        },
    },
    buttons: {
        // Play: continue a saved game (once the first tutorial board was seen), else start a new one.
        315: (_btn, menu) => {
            if (menu.vars.menuexit) {
                return;
            }
            load();
            music.stop();
            if (state.boards[0]) {
                fade(true, true, 'shop');
            } else {
                reset();
                fade(true, true, 'dayintro');
            }
            menu.vars.menuexit = true;
        },
        // Clear data.
        316: (_btn, menu) => {
            if (menu.vars.menuexit) {
                return;
            }
            music.stop();
            fade(true, true, 'cleardata');
            menu.vars.menuexit = true;
        },
    },
};
