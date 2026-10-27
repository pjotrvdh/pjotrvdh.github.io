/**
 * Input: the pointer and the keys move your paddle; P / Esc pause, M mutes, Esc or a tap stops CPU vs
 * CPU. Leaving the page pauses (an online match for both players).
 */
import { sounds } from './audio.js';
import { $, canvas, clamp, limitX, limitY, near, renderer, state } from './context.js';
import { toMenu, toggleMute, togglePause } from './game.js';
import { pauseOnline } from './online.js';

const keys = new Set();

const MOVE_KEYS = {
    left: ['a', 'ArrowLeft'],
    right: ['d', 'ArrowRight'],
    up: ['w', 'ArrowUp'],
    down: ['s', 'ArrowDown'],
};
const ALL_MOVE_KEYS = Object.values(MOVE_KEYS).flat();

/** Is a key for this direction (left, right, up, down) held? */
export const pressed = (direction) => MOVE_KEYS[direction].some((key) => keys.has(key));

const keyName = (event) => (event.key.length === 1 ? event.key.toLowerCase() : event.key);

// A mouse puts the paddle where the pointer is. A finger drags it instead (it moves as far as the
// finger does, from wherever the finger lands), so the finger never covers the paddle and the whole
// screen, also around the tunnel, works as a touch pad.
let drag = null;

/** The pointer in tunnel coordinates (the near plane). */
function tunnelPoint(event) {
    const rect = canvas.getBoundingClientRect();

    return renderer.toTunnel(event.clientX - rect.left, event.clientY - rect.top);
}

function pointerToTarget(event) {
    if (!near.human) {
        return;
    }
    const point = tunnelPoint(event);
    if (event.pointerType === 'mouse') {
        near.target.x = clamp(point.x, limitX);
        near.target.y = clamp(point.y, limitY);
    } else if (drag && drag.id === event.pointerId) {
        near.target.x = clamp(drag.x + point.x - drag.px, limitX);
        near.target.y = clamp(drag.y + point.y - drag.py, limitY);
    }
}

function startDrag(event) {
    if (event.pointerType === 'mouse' || !near.human) {
        return;
    }
    const point = tunnelPoint(event);
    drag = { id: event.pointerId, x: near.target.x, y: near.target.y, px: point.x, py: point.y };
}

function onKey(event) {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
        return;
    }
    const key = keyName(event);
    const playing = $('overlay').hidden;
    if (ALL_MOVE_KEYS.includes(key) && playing) {
        keys.add(key);
        event.preventDefault();
    } else if (key === 'Escape' && state.kind === 'demo' && state.mode !== 'title') {
        toMenu();
    } else if (key === 'p' || key === 'Escape') {
        togglePause();
    } else if (key === 'm') {
        toggleMute();
    }
}

/** Wires the pointer, the keys and the page's focus and size. Runs once at start. */
export function initInput() {
    canvas.addEventListener('pointermove', pointerToTarget);
    for (const type of ['pointerup', 'pointercancel']) {
        canvas.addEventListener(type, (event) => {
            if (drag?.id === event.pointerId) {
                drag = null;
            }
        });
    }
    canvas.addEventListener('pointerdown', (event) => {
        // No Esc on a phone: a tap on the tunnel stops CPU vs CPU.
        if (state.kind === 'demo' && state.mode !== 'title' && event.pointerType !== 'mouse') {
            toMenu();

            return;
        }
        startDrag(event);
        pointerToTarget(event);
        sounds.unlock();
    });
    addEventListener('keydown', onKey);
    addEventListener('keyup', (event) => keys.delete(keyName(event)));
    // Online: leaving the page (another tab or window) pauses the match for both players.
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            pauseOnline(true);
        }
    });
    addEventListener('blur', () => {
        keys.clear();
        pauseOnline(true);
        if (state.kind === 'solo' && ['serve', 'play', 'wait'].includes(state.mode) && (!state.paused || state.countingDown)) {
            togglePause();
        }
    });
    addEventListener('resize', () => renderer.resize());
}
