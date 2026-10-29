import { ChevronLeft, ChevronRight, createElement, Rocket } from 'lucide';

/*
 * Mouse, touch and keyboard to the player, in stage coordinates (`toStage` maps window pixels to the
 * 640 × 480 stage, see the layout in index.js). A tap is a click. On a touch screen the body gets
 * the class `touch` and a flight shows the touch pad (`#pad`, shown by hud.js): ◀ ▶ in the bottom
 * left corner hold the arrow keys, the rocket in the bottom right holds Space. A finger can slide
 * from one button to another; several fingers work at once.
 */

/** The keys the original reads (Key.isDown): arrows and Space. Their default scrolling is blocked. */
const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);
/** The touch pad's buttons: [key, label, icon, side]. */
const PAD = [
    ['ArrowLeft', 'Tilt left', ChevronLeft, 'left'],
    ['ArrowRight', 'Tilt right', ChevronRight, 'left'],
    ['Space', 'Rocket', Rocket, 'right'],
];

/** Touch mode: on with a touch, off with a mouse (a pen leaves it as it is). */
function setTouch(e) {
    if (e.pointerType === 'touch' || e.pointerType === 'mouse') {
        document.body.classList.toggle('touch', e.pointerType === 'touch');
    }
}

function setupPad(player, unlock) {
    const pad = document.getElementById('pad');
    const buttons = new Map();
    const sides = { left: document.createElement('div'), right: document.createElement('div') };
    for (const [code, label, node, side] of PAD) {
        const b = document.createElement('button');
        b.type = 'button';
        b.tabIndex = -1;
        b.className = 'pad-btn';
        b.dataset.key = code;
        b.setAttribute('aria-label', label);
        const svg = createElement(node);
        svg.setAttribute('aria-hidden', 'true');
        b.append(svg);
        buttons.set(code, b);
        sides[side].append(b);
    }
    sides.left.className = 'pad-side left';
    sides.right.className = 'pad-side right';
    pad.append(sides.left, sides.right);

    // pointer id → the key its finger holds; a key stays down while any finger holds it.
    const held = new Map();
    const isHeld = (code) => [...held.values()].includes(code);
    const keyAt = (e) => document.elementFromPoint(e.clientX, e.clientY)?.closest?.('#pad [data-key]')?.dataset.key ?? null;
    const hold = (id, code) => {
        const old = held.get(id) ?? null;
        if (old === code) {
            return;
        }
        held.delete(id);
        if (old && !isHeld(old)) {
            buttons.get(old).classList.remove('down');
            player.pushEvent('keyup', { code: old });
        }
        if (code) {
            if (!isHeld(code)) {
                buttons.get(code).classList.add('down');
                player.pushEvent('keydown', { code });
            }
            held.set(id, code);
        }
    };

    pad.addEventListener('pointerdown', (e) => {
        unlock();
        setTouch(e);
        hold(e.pointerId, keyAt(e));
        e.preventDefault();
    });
    pad.addEventListener('pointermove', (e) => {
        if (held.has(e.pointerId)) {
            hold(e.pointerId, keyAt(e));
        }
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        pad.addEventListener(type, (e) => hold(e.pointerId, null));
    }
    pad.addEventListener('contextmenu', (e) => e.preventDefault());
    /** Lets go of every button (the pad is hidden, or the window lost focus). */
    return () => {
        for (const id of [...held.keys()]) {
            hold(id, null);
        }
    };
}

export function setupInput(player, canvas, mapToStage, unlock) {
    const toStage = (e) => mapToStage(e.clientX, e.clientY);
    if (window.matchMedia?.('(pointer: coarse)').matches) {
        document.body.classList.add('touch');
    }
    const releasePad = setupPad(player, unlock);

    canvas.addEventListener('pointerdown', (e) => {
        unlock();
        setTouch(e);
        canvas.setPointerCapture?.(e.pointerId);
        const p = toStage(e);
        player.pushEvent('mousemove', p);
        player.pushEvent('mousedown', p);
        e.preventDefault();
    });
    canvas.addEventListener('pointermove', (e) => {
        player.pushEvent('mousemove', toStage(e));
    });
    const up = (e) => player.pushEvent('mouseup', toStage(e));
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
        if (e.target instanceof HTMLElement && e.target.closest('.controls')) {
            return;
        }
        unlock();
        if (GAME_KEYS.has(e.code)) {
            e.preventDefault();
        }
        if (!e.repeat) {
            player.pushEvent('keydown', { code: e.code });
        }
    });
    window.addEventListener('keyup', (e) => {
        player.pushEvent('keyup', { code: e.code });
    });
    window.addEventListener('blur', () => {
        releasePad();
        for (const code of [...player.keys]) {
            player.pushEvent('keyup', { code });
        }
    });
    return { releasePad };
}
