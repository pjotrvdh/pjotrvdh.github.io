import GAME from '../config/game.js';
import { g } from './context.js';
import { f } from './flight.js';
import { state, upgradeValue } from './state.js';

/*
 * The flight HUD and the score board in HTML, in place of the dials (hudc) and chalk board (fboard)
 * of the SWF. They read the flight (`f` in flight.js) and the values the score board's timeline counts
 * up (`rdis`, `ralt`, `rdur`, `rtotal` on the root). Clicks go through to the game. On a touch
 * screen (body class `touch`, see input.js) the touch pad shows with the HUD. Every skip on the water
 * shows a call for a moment, and the board a Water skips row (the skip bonus, not in the original).
 */

/** How long the skip call stays, in ms. */
const SKIP_CALL = 1200;

const FLIGHT_FRAME = 11;
/** Control reminders after the jump: [from tick, to tick, text], as long as the canvas's did. */
const HINTS = {
    noGlider: [0, 137, 'Use ← → to adjust your angle'],
    glider: [0, 137, 'Use ← → to control the flight'],
    rocket: [137, 302, 'Press Space to use your rockets'],
};
/** The same reminders for the touch pad. */
const TOUCH_HINTS = {
    noGlider: [0, 137, 'Hold ◀ ▶ to adjust your angle'],
    glider: [0, 137, 'Hold ◀ ▶ to control the flight'],
    rocket: [137, 302, 'Hold the rocket button to use your rockets'],
};
const $ = (id) => document.getElementById(id);
const els = {};
let shown = { hud: false, board: false, hint: false, pad: false, skip: false, skipRow: false };

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
    /** Lets go of the touch pad's buttons (set by index.js from setupInput()). */
    releasePad: () => {},
    update() {
        if (!els.hud) {
            for (const id of ['hint', 'hud', 'board', 'pad', 'hSpeed', 'hSpeedBar', 'hAlt', 'hDist', 'hRes', 'hFuel', 'hFuelBar', 'bDist', 'bAlt', 'bDur', 'bTotal', 'skipCall', 'bSkipRow', 'bSkips', 'bSkip']) {
                els[id] = $(id);
            }
        }
        const root = g.root;
        const inFlight = root?.frame === FLIGHT_FRAME && f.vmag !== undefined;
        const board = root?.get('fboard');
        const boardUp = inFlight && f.finished && !f.finishclick && (board?.currentFrame ?? 0) >= 20;
        show(els.hud, 'hud', inFlight && !f.finished);
        const padUp = inFlight && !f.finished;
        if (shown.pad && !padUp) {
            this.releasePad();
        }
        show(els.pad, 'pad', padUp);
        let hint = '';
        if (inFlight && f.hintTick !== null && f.hintTick !== undefined && !f.finished) {
            const t = g.player.tickCount - f.hintTick;
            const hints = document.body.classList.contains('touch') ? TOUCH_HINTS : HINTS;
            const list = [state.levels.gliders > 1 ? hints.glider : hints.noGlider, ...(state.levels.rockets > 1 ? [hints.rocket] : [])];
            hint = list.find(([from, to]) => t >= from && t < to)?.[2] ?? '';
        }
        show(els.hint, 'hint', !!hint);
        if (hint) {
            setText(els.hint, hint);
        }
        const skipUp = inFlight && !f.finished && performance.now() - f.skipAt < SKIP_CALL;
        show(els.skipCall, 'skip', skipUp);
        if (skipUp) {
            const bonus = `+${Math.round(f.skips * GAME.skipBonus * 100)}% cash`;
            setText(els.skipCall, f.skips > 1 ? `Water skip ×${f.skips}! ${bonus}` : `Water skip! ${bonus}`);
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
            els.pad.classList.toggle('rocket', hasRocket);
            if (hasRocket) {
                els.hFuelBar.style.setProperty('--v', Math.max(0, f.rocketfuel / upgradeValue('fuel')).toFixed(3));
                els.pad.classList.toggle('empty', f.rocketfuel <= 0);
            }
        }
        if (boardUp) {
            setText(els.bDist, String(rv.rdis ?? '$0'));
            setText(els.bAlt, String(rv.ralt ?? '$0'));
            setText(els.bDur, String(rv.rdur ?? 'X0.0').replace(/^X/, '×'));
            setText(els.bTotal, String(rv.rtotal ?? '$0'));
            show(els.bSkipRow, 'skipRow', f.skips > 0);
            setText(els.bSkips, `×${f.skips}`);
            setText(els.bSkip, String(rv.rskip ?? '$0'));
        }
    },
};
