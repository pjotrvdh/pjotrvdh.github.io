import { createElement, Sparkles } from 'lucide';
import config from '../config/index.js';
import { g } from './context.js';
import { f } from './flight.js';
import { KINDS, save, state } from './state.js';
import { stateChanged } from './ui.js';

/*
 * The Cheats panel: hidden until someone types the cheat code (iliketocheat), for the current page
 * load only. A button in the control bar opens it: cash, every upgrade, every ramp, endless rocket
 * fuel and winning the game on the spot.
 */

const CODE = 'iliketocheat';
const FLIGHT_FRAME = 11;

/** Cheats that last while the page is open (read by flight.js). */
export const cheats = { endlessFuel: false };

const addCash = (n) => () => {
    state.cash += n;
    return `+$${n.toLocaleString('en-US')}`;
};

const CHEATS = [
    ['+$1,000', addCash(1000)],
    ['+$10,000', addCash(10000)],
    ['Max out all upgrades', () => {
        for (const [name, upgrade] of Object.entries(config.upgrades)) {
            state.levels[name] = upgrade.values.length;
        }
        return 'every upgrade at its top level';
    }],
    ['Unlock all ramps', () => {
        // Ramps open by achievements: all of them are marked done (without their rewards).
        for (const ramp of state.achievements) {
            for (const kind of KINDS) {
                ramp[kind] = true;
            }
        }
        return 'every ramp open';
    }],
    [() => (cheats.endlessFuel ? 'Endless fuel: on' : 'Endless fuel: off'), () => {
        cheats.endlessFuel = !cheats.endlessFuel;
        return cheats.endlessFuel ? 'the rocket never runs dry' : 'fuel back to normal';
    }],
    ['Win the game', () => {
        if (g.root.frame !== FLIGHT_FRAME || !f.jumped || f.landed) {
            return 'only while flying';
        }
        // Past the finish line: the flight's own rules play the ending.
        f.distance = config.game.finishDistance;
        state.keepPlaying = false;
        state.gameFinished = false;
        return 'through the iceberg!';
    }],
];

const label = (l) => (typeof l === 'function' ? l() : l);

export function setupCheats() {
    const bar = document.getElementById('controls');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ctl';
    button.title = 'Cheats';
    button.setAttribute('aria-label', 'Cheats');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'cheats');
    const svg = createElement(Sparkles);
    svg.setAttribute('aria-hidden', 'true');
    button.append(svg);
    button.hidden = true;

    const panel = document.createElement('div');
    panel.id = 'cheats';
    panel.className = 'settings cheats';
    panel.hidden = true;
    const status = document.createElement('p');
    status.className = 'cheat-status';
    status.setAttribute('aria-live', 'polite');
    const buttons = CHEATS.map(([text, run]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label(text);
        b.addEventListener('click', () => {
            status.textContent = run();
            save();
            stateChanged();
            buttons.forEach((x, i) => {
                x.textContent = label(CHEATS[i][0]);
            });
        });
        return b;
    });
    const title = document.createElement('h2');
    title.textContent = 'Cheats';
    panel.append(title, ...buttons, status);

    bar.prepend(button);
    bar.append(panel);

    button.addEventListener('click', () => {
        panel.hidden = !panel.hidden;
        button.setAttribute('aria-expanded', String(!panel.hidden));
        status.textContent = '';
    });
    document.addEventListener('pointerdown', (e) => {
        if (!panel.hidden && !panel.contains(e.target) && !button.contains(e.target)) {
            panel.hidden = true;
            button.setAttribute('aria-expanded', 'false');
        }
    });

    // The code can be typed anywhere, at any time; the last letters typed are compared with it.
    let typed = '';
    window.addEventListener('keydown', (e) => {
        if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) {
            return;
        }
        typed = (typed + e.key.toLowerCase()).slice(-CODE.length);
        if (typed === CODE && button.hidden) {
            button.hidden = false;
            panel.hidden = false;
            button.setAttribute('aria-expanded', 'true');
            status.textContent = 'Cheats unlocked';
        }
    });
}
