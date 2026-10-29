import { g } from './context.js';
import { f } from './flight.js';
import { state, upgradeValue } from './state.js';

/*
 * The flight HUD and the score board in HTML, in place of the dials (hudc) and chalk board (fboard)
 * of the SWF. They read the flight (`f` in flight.js) and the values the score board's timeline counts
 * up (`rdis`, `ralt`, `rdur`, `rtotal` on the root). Clicks go through to the game.
 */

const FLIGHT_FRAME = 11;
/** Control reminders after the jump: [from tick, to tick, text], as long as the canvas's did. */
const HINTS = {
    noGlider: [0, 137, 'Use ← → to adjust your angle'],
    glider: [0, 137, 'Use ← → to control the flight'],
    rocket: [137, 302, 'Press Space to use your rockets'],
};
const $ = (id) => document.getElementById(id);
const els = {};
let shown = { hud: false, board: false, hint: false };

function setText(el, text) {
    if (el.textContent !== text) {
        el.textContent = text;
    }
}

function show(el, key, on) {
    if (shown[key] !== on) {
        shown[key] = on;
        el.hidden = !on;
    }
}

export const hud = {
    update() {
        if (!els.hud) {
            for (const id of ['hint', 'hud', 'board', 'hSpeed', 'hSpeedBar', 'hAlt', 'hDist', 'hRes', 'hFuel', 'hFuelBar', 'bDist', 'bAlt', 'bDur', 'bTotal']) {
                els[id] = $(id);
            }
        }
        const root = g.root;
        const inFlight = root?.frame === FLIGHT_FRAME && f.vmag !== undefined;
        const board = root?.get('fboard');
        const boardUp = inFlight && f.finished && !f.finishclick && (board?.currentFrame ?? 0) >= 20;
        show(els.hud, 'hud', inFlight && !f.finished);
        let hint = '';
        if (inFlight && f.hintTick !== null && f.hintTick !== undefined && !f.finished) {
            const t = g.player.tickCount - f.hintTick;
            const list = [state.levels.gliders > 1 ? HINTS.glider : HINTS.noGlider, ...(state.levels.rockets > 1 ? [HINTS.rocket] : [])];
            hint = list.find(([from, to]) => t >= from && t < to)?.[2] ?? '';
        }
        show(els.hint, 'hint', !!hint);
        if (hint) {
            setText(els.hint, hint);
        }
        show(els.board, 'board', boardUp);
        if (!inFlight) {
            return;
        }
        const rv = root.vars;
        if (!f.finished) {
            const critical = upgradeValue('gliders').criticalSpeed;
            setText(els.hSpeed, String(rv.spehud ?? 0));
            const frac = Math.min(1, (f.speed || 0) / (critical * 1.25));
            els.hSpeedBar.style.setProperty('--v', frac.toFixed(3));
            els.hSpeedBar.style.setProperty('--red', (1 / 1.25).toFixed(3));
            els.hSpeedBar.classList.toggle('over', f.speed > critical);
            setText(els.hAlt, String(rv.althud ?? '0.0'));
            setText(els.hDist, String(rv.dishud ?? 0));
            setText(els.hRes, String(rv.reshud ?? '0%'));
            const hasRocket = state.levels.rockets > 1;
            els.hFuel.hidden = !hasRocket;
            if (hasRocket) {
                els.hFuelBar.style.setProperty('--v', Math.max(0, f.rocketfuel / upgradeValue('fuel')).toFixed(3));
            }
        }
        if (boardUp) {
            setText(els.bDist, String(rv.rdis ?? '$0'));
            setText(els.bAlt, String(rv.ralt ?? '$0'));
            setText(els.bDur, String(rv.rdur ?? 'X0.0').replace(/^X/, '×'));
            setText(els.bTotal, String(rv.rtotal ?? '$0'));
        }
    },
};
