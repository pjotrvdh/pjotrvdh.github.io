/**
 * Mouse, touch and keyboard on the map. The renderer turns screen points into tiles and units
 * (view.pick(), view.pickUnit()) and moves the camera; this file decides what a click does.
 */
import { CLAIM, H, W, inb, ix } from './constants.js';
import { ROOMS, SPELLS } from './config.js';
import { applyRect, cast, dismissHeld, dropHeld, pickUp, slap } from './actions.js';
import { G, app } from './state.js';
import { diggable, ownPortal } from './tiles.js';
import { cheatKey, cheatsUnlocked, dragRect, msg, setSpeed, setTool, syncPause, toggleCheats, updateTip } from './ui.js';
import { view } from '../render/view.js';

const keys = new Set();
const ptrs = new Map();
let pinch = null;
let pan = null;

/** Your unit under screen point (sx, sy), or null. */
const ownUnitAt = (sx, sy) => view.pickUnit(sx, sy, (e) => e.side === 0);

function setHover(p) {
    app.hover = { ...p, in: true, unit: p.x >= 0 ? view.pickUnit(p.sx, p.sy, (e) => e.side === 0 || !!G.seen[ix(Math.floor(e.x), Math.floor(e.y))]) : null };
}

function screen(ev, cv) {
    const r = cv.getBoundingClientRect();

    return { sx: ev.clientX - r.left, sy: ev.clientY - r.top };
}

/** The tile under a screen point: { sx, sy, fx, fy, x, y } (x = y = -1 off the map). */
function at(ev, cv) {
    const { sx, sy } = screen(ev, cv);
    const p = view.pick(sx, sy);

    return p ? { sx, sy, ...p } : { sx, sy, fx: -1, fy: -1, x: -1, y: -1 };
}

function onDown(ev, cv) {
    const p = at(ev, cv);
    cv.setPointerCapture(ev.pointerId);
    ptrs.set(ev.pointerId, p);
    setHover(p);
    if (ptrs.size === 2) {
        app.drag = null;
        pan = null;
        const [a, b] = [...ptrs.values()];
        pinch = { d: Math.hypot(a.sx - b.sx, a.sy - b.sy) || 1, mx: (a.sx + b.sx) / 2, my: (a.sy + b.sy) / 2 };
        view.panStart(pinch.mx, pinch.my);

        return;
    }
    if (ev.button === 1 || ev.button === 2 || app.tool === 'look') {
        pan = { sx: p.sx, sy: p.sy, moved: false, slap: ev.button === 2 };
        view.panStart(p.sx, p.sy);
        cv.classList.add('grab');

        return;
    }
    if (!app.running || G.over || !inb(p.x, p.y)) {
        return;
    }
    const i = ix(p.x, p.y);
    if (app.tool === 'slap') {
        const e = ownUnitAt(p.sx, p.sy);
        if (e) {
            slap(e);
        }

        return;
    }
    if (app.tool === 'hand') {
        const e = ownUnitAt(p.sx, p.sy);
        if (e) {
            pickUp(e);

            return;
        }
        if (G.held.length && ownPortal(i) && G.held[G.held.length - 1].kind !== 'imp') {
            dismissHeld(i);

            return;
        }
        if (G.held.length && (G.t[i] === CLAIM || ownPortal(i))) {
            dropHeld(i);

            return;
        }
        if (G.held.length && G.seen[i]) {
            msg('You can only drop creatures on your own territory.', 'dropbad', 'bad');

            return;
        }
        app.drag = { mode: G.mark[i] && diggable(i) ? 'unmark' : 'mark', x0: p.x, y0: p.y, x1: p.x, y1: p.y };

        return;
    }
    if (ROOMS[app.tool] || app.tool === 'sell') {
        app.drag = { mode: String(app.tool), x0: p.x, y0: p.y, x1: p.x, y1: p.y };

        return;
    }
    if (SPELLS[app.tool]) {
        cast(app.tool, i, p.fx, p.fy);
    }
}

function onMove(ev, cv) {
    const p = at(ev, cv);
    if (!pan && !pinch) {
        cv.style.cursor = app.tool === 'hand' && G && ownUnitAt(p.sx, p.sy) ? 'grab' : '';
    }
    if (ptrs.has(ev.pointerId)) {
        ptrs.set(ev.pointerId, p);
    }
    setHover(p);
    if (pinch && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.sx - b.sx, a.sy - b.sy) || 1;
        const mx = (a.sx + b.sx) / 2;
        const my = (a.sy + b.sy) / 2;
        view.zoomAt(d / pinch.d, mx, my);
        pinch.d = d;
        view.panTo(mx, my);

        return;
    }
    if (pan) {
        if (Math.hypot(p.sx - pan.sx, p.sy - pan.sy) > 4) {
            pan.moved = true;
        }
        if (pan.moved) {
            view.panTo(p.sx, p.sy);
        }

        return;
    }
    if (app.drag && p.x >= 0) {
        app.drag.x1 = Math.max(0, Math.min(W - 1, p.x));
        app.drag.y1 = Math.max(0, Math.min(H - 1, p.y));
    }
    updateTip();
}

function onUp(ev, cv) {
    ptrs.delete(ev.pointerId);
    if (ptrs.size < 2) {
        pinch = null;
    }
    if (pan && ptrs.size === 0) {
        if (!pan.moved && pan.slap && app.running && !G.over) {
            const e = ownUnitAt(pan.sx, pan.sy);
            if (e) {
                slap(e);
            }
        }
        pan = null;
        cv.classList.toggle('grab', app.tool === 'look');
    }
    if (app.drag && ev.type === 'pointerup' && G && !G.over) {
        applyRect(app.drag.mode, dragRect());
    }
    app.drag = null;
    updateTip();
}

function onKey(e) {
    if (cheatKey(e.key)) {
        return;
    }
    if (e.target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) {
        return;
    }
    // Ctrl+C opens the cheats only once they are unlocked and nothing is selected; other modified keys (copy, print, ...) stay the browser's.
    if (e.ctrlKey || e.metaKey || e.altKey) {
        if (cheatsUnlocked() && e.ctrlKey && e.key === 'c' && getSelection().isCollapsed) {
            e.preventDefault();
            toggleCheats();
        }

        return;
    }
    const k = e.key.toLowerCase();
    if (e.key === ' ' || k === 'p') {
        e.preventDefault();
        app.paused = !app.paused;
        syncPause();
    } else if (e.key === 'Escape') {
        setTool('hand');
        app.drag = null;
        updateTip();
        toggleCheats(false);
    } else if (e.key === '`' && cheatsUnlocked()) {
        e.preventDefault();
        toggleCheats();
    } else if (e.key >= '1' && e.key <= '3') {
        setSpeed(+e.key);
    } else if (e.key === '+' || e.key === '=') {
        view.zoomBy(1.25);
    } else if (e.key === '-' || e.key === '_') {
        view.zoomBy(1 / 1.25);
    } else if (k === 'q' || k === 'e') {
        view.rotate(k === 'q' ? -1 : 1);
    } else if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'].includes(k)) {
        e.preventDefault();
        keys.add(k);
    }
}

/** Scrolls the view with the held arrow / WASD keys. */
export function keyPan(dt) {
    if (!keys.size) {
        return;
    }
    const right = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0);
    const down = (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0);
    view.panKeys(right, down, dt);
}

export function initInput() {
    const cv = document.getElementById('cv');
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (ev) => onDown(ev, cv));
    cv.addEventListener('pointermove', (ev) => onMove(ev, cv));
    cv.addEventListener('pointerup', (ev) => onUp(ev, cv));
    cv.addEventListener('pointercancel', (ev) => onUp(ev, cv));
    cv.addEventListener('pointerleave', () => {
        app.hover.in = false;
    });
    cv.addEventListener('wheel', (ev) => {
        ev.preventDefault();
        const { sx, sy } = screen(ev, cv);
        view.zoomAt(ev.deltaY < 0 ? 1.15 : 1 / 1.15, sx, sy);
    }, { passive: false });
    addEventListener('keydown', onKey);
    addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => keys.clear());
    document.getElementById('zin').onclick = () => view.zoomBy(1.25);
    document.getElementById('zout').onclick = () => view.zoomBy(1 / 1.25);
    document.getElementById('zfit').onclick = () => view.fit();
    const rl = document.getElementById('rotl');
    const rr = document.getElementById('rotr');
    if (rl && rr) {
        rl.onclick = () => view.rotate(-1);
        rr.onclick = () => view.rotate(1);
    }
    // The minimap: click or drag to look there.
    const m = document.getElementById('mini');
    let down = false;
    const go = (ev) => {
        const r = m.getBoundingClientRect();
        view.centerOn((ev.clientX - r.left) / r.width * W - 0.5, (ev.clientY - r.top) / r.height * H - 0.5);
    };
    m.addEventListener('pointerdown', (ev) => {
        down = true;
        m.setPointerCapture(ev.pointerId);
        go(ev);
    });
    m.addEventListener('pointermove', (ev) => {
        if (down) {
            go(ev);
        }
    });
    m.addEventListener('pointerup', () => {
        down = false;
    });
    m.addEventListener('pointercancel', () => {
        down = false;
    });
}
