import { fade, g, music } from './context.js';
import { load, reset, state } from './state.js';
import { h, hideClips, registerScreen, showScreen } from './ui.js';

/*
 * The main menu (root frame 6, the title screen sprite 317; start.js opens it at its end, menu2):
 * PLAY (or Space or Enter) and CLEAR SAVED DATA; and the "clear all saved data?" question (frame 15).
 */

const MENU_FRAME = 6;
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

/** Play: continue a saved game (once the first tutorial board was seen), else start a new one. */
function play(menu) {
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
}

/** Space or Enter in the main menu plays too (once the menu shows its buttons). */
window.addEventListener('keydown', (e) => {
    if ((e.code !== 'Space' && e.code !== 'Enter') || e.repeat || g.root?.frame !== MENU_FRAME) {
        return;
    }
    if (e.target instanceof HTMLElement && e.target.closest('button, input, .controls')) {
        return;
    }
    const menu = g.root.get('titlescreen');
    if (menu && menu.currentFrame >= menu.resolveFrame('menu2')) {
        e.preventDefault();
        play(menu);
    }
});

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
        // Play.
        315: (_btn, menu) => play(menu),
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
