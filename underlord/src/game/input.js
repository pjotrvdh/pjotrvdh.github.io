/**
 * Mouse, touch and keyboard, after Dungeon Keeper (1997):
 *
 * - Left button: pick up your creature; on blocks, click or drag a box to tag them for digging (start on
 *   a tagged block to untag); with a room or Sell, click or drag a box to build or sell (the box as in
 *   Dungeon Keeper 2, shown while dragging and applied on release, so a whole room goes down at once); with a spell, cast.
 * - Right button: drop the creature picked up last on your territory (or dismiss it on your portal);
 *   with an empty hand, slap your creature; with a room, Sell or a spell selected, go back to the hand.
 *   These happen on release; holding the right button and moving drags the map instead.
 * - Camera: arrow keys / WASD (Shift: faster), the pointer at the edge of the view, Ctrl + arrows to turn
 *   and zoom. Extras: right- or middle-drag moves the map, the mouse wheel zooms, Q / E turn.
 * - Keys: P pause, + / - game speed, 1-4 panels, H / T / L ... jump to the Heart or a room, F to a fight,
 *   M the whole map, Esc the hand.
 *
 * On a touch screen (no right button) a tap with creatures in hand drops them, and the Slap and Look
 * tools stand in for the right button and for dragging the map.
 */
import { H, HATCH, LAIR, LIB, N, N4, TRAIN, TREAS, W, inb, ix, tx, ty } from './constants.js';
import { ROOMS, SPELLS } from './config.js';
import { applyRect, canDrop, cast, dismissHeld, dropHeld, pickUp, slap } from './actions.js';
import { G, app } from './state.js';
import { diggable, ownPortal } from './tiles.js';
import { cheatKey, cheatsUnlocked, dragRect, msg, setSpeed, setTool, showTab, syncPause, toggleCheats, updateTip } from './ui.js';
import { view } from '../render/view.js';

const keys = new Set();
const ptrs = new Map();
let pinch = null;
let pan = null;
/** Map scrolling speed for the edge of the view, in screen widths per second (Dungeon Keeper style). */
const EDGE = 16;

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

/** The claw pointer: open over one of your units, a fist while the hand holds units (see the CSS). */
function cursor(cv, overUnit) {
    cv.classList.toggle('over-unit', overUnit);
    cv.classList.toggle('holding', !!G && G.held.length > 0);
}

/** Drops (or, on your own portal, dismisses) the creature picked up last onto tile i. */
function drop(i) {
    if (ownPortal(i) && G.held[G.held.length - 1].kind !== 'imp') {
        dismissHeld(i);
    } else if (canDrop(i, G.held[G.held.length - 1])) {
        dropHeld(i);
    } else {
        msg(G.held[G.held.length - 1].kind === 'imp' ? 'Imps can only be dropped on open ground you have discovered.' : 'You can only drop creatures on your own territory.', 'dropbad', 'bad');
    }
}

function rightClick(p, i) {
    if (G.held.length) {
        drop(i);
    } else if (app.tool !== 'hand') {
        // right click cancels a room, Sell or spell, as in Dungeon Keeper
        setTool('hand');
    } else {
        const e = ownUnitAt(p.sx, p.sy);
        if (e) {
            slap(e);
        }
    }
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
    // the middle button and the Look tool drag the map; so does the right button once it moves (see onUp())
    if (ev.button === 1 || ev.button === 2 || (ev.button === 0 && app.tool === 'look')) {
        pan = { sx: p.sx, sy: p.sy, moved: ev.button !== 2, right: ev.button === 2 ? p : null };
        view.panStart(p.sx, p.sy);
        if (pan.moved) {
            cv.classList.add('grab');
        }

        return;
    }
    if (!app.running || G.over || !inb(p.x, p.y)) {
        return;
    }
    const i = ix(p.x, p.y);
    if (ev.button !== 0) {
        return;
    }
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
        // no right button on a touch screen: a tap with creatures in hand drops one
        if (G.held.length && ev.pointerType !== 'mouse' && G.seen[i]) {
            drop(i);

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
        cursor(cv, (app.tool === 'hand' || app.tool === 'slap') && G && !!ownUnitAt(p.sx, p.sy));
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
        // a right click becomes a drag once the pointer moves a few pixels
        if (!pan.moved && Math.hypot(p.sx - pan.sx, p.sy - pan.sy) > 5) {
            pan.moved = true;
            cv.classList.add('grab');
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
        // a right click that did not move: drop, slap or put the tool away
        const r = pan.right;
        if (r && !pan.moved && ev.type === 'pointerup' && app.running && !G.over && inb(r.x, r.y)) {
            rightClick(r, ix(r.x, r.y));
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

/** The rooms of code `code` you own, one tile per room (connected tiles count as one room). */
function roomSpots(code) {
    const seen = new Uint8Array(N);
    const spots = [];
    for (let i = 0; i < N; i++) {
        if (G.room[i] !== code || seen[i]) {
            continue;
        }
        const q = [i];
        seen[i] = 1;
        for (let h = 0; h < q.length; h++) {
            for (const [dx, dy] of N4) {
                const a = tx(q[h]) + dx;
                const b = ty(q[h]) + dy;
                const j = ix(a, b);
                if (inb(a, b) && !seen[j] && G.room[j] === code) {
                    seen[j] = 1;
                    q.push(j);
                }
            }
        }
        spots.push(q[Math.floor(q.length / 2)]);
    }

    return spots;
}

const cycle = {};

/** Moves the camera to the next room of `code` (pressing again cycles through them). */
function jumpToRoom(code, name) {
    const spots = roomSpots(code);
    if (!spots.length) {
        msg('You have no ' + name + ' yet.', 'noroom' + code);

        return;
    }
    cycle[code] = ((cycle[code] ?? -1) + 1) % spots.length;
    const i = spots[cycle[code]];
    view.centerOn(tx(i), ty(i));
}

/** Room jumps as in Dungeon Keeper: key (with Shift?) -> room code. */
const ROOM_KEYS = { t: [TREAS, false], T: [TRAIN, true], L: [LAIR, true], l: [LIB, false], H: [HATCH, true] };

function onKey(e) {
    if (cheatKey(e.key)) {
        return;
    }
    if (e.target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) {
        return;
    }
    const k = e.key.toLowerCase();
    if (e.ctrlKey && !e.metaKey && !e.altKey) {
        // Ctrl + arrows turn and zoom the view; Ctrl+P goes to your portal; Ctrl+C opens the cheats once unlocked
        if (k === 'arrowleft' || k === 'arrowright') {
            e.preventDefault();
            view.rotate(k === 'arrowleft' ? -1 : 1);
        } else if (k === 'arrowup' || k === 'arrowdown') {
            e.preventDefault();
            view.zoomBy(k === 'arrowup' ? 1.25 : 1 / 1.25);
        } else if (k === 'p' && G) {
            e.preventDefault();
            const p = G.portals.find((q) => G.pown[q]) ?? G.portal;
            view.centerOn(tx(p), ty(p));
        } else if (cheatsUnlocked() && k === 'c' && getSelection().isCollapsed) {
            e.preventDefault();
            toggleCheats();
        }

        return;
    }
    // other modified keys (copy, print, ...) stay the browser's
    if (e.metaKey || e.altKey) {
        return;
    }
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
    } else if (e.key === '+' || e.key === '=') {
        setSpeed(Math.min(3, app.speed + 1));
    } else if (e.key === '-' || e.key === '_') {
        setSpeed(Math.max(1, app.speed - 1));
    } else if (e.key >= '1' && e.key <= '5') {
        showTab(['info', 'rooms', 'spells', 'creatures', 'creatures'][+e.key - 1]);
    } else if (k === 'q' || k === 'e') {
        view.rotate(k === 'q' ? -1 : 1);
    } else if (k === 'm') {
        view.fit();
    } else if (G && e.key === 'h') {
        view.centerOn(G.hx, G.hy);
    } else if (G && ROOM_KEYS[e.key] && ROOM_KEYS[e.key][1] === e.shiftKey) {
        const [code] = ROOM_KEYS[e.key];
        jumpToRoom(code, ROOMS[code].n);
    } else if (G && k === 'f') {
        const f = G.ents.find((u) => !u.dead && !u.held && u.state === 'fight' && (u.side === 0 || G.seen[ix(Math.floor(u.x), Math.floor(u.y))]));
        if (f) {
            view.centerOn(f.x - 0.5, f.y - 0.5);
        }
    } else if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'].includes(k)) {
        e.preventDefault();
        keys.add(k);
    }
}

/** Scrolls the view with the held arrow / WASD keys (Shift: faster) or the pointer at the edge of the view. */
export function keyPan(dt) {
    let right = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0);
    let down = (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0);
    const h = app.hover;
    if (!right && !down && h.in && !ptrs.size) {
        const r = document.getElementById('cv').getBoundingClientRect();
        right = h.sx < EDGE ? -1 : h.sx > r.width - EDGE ? 1 : 0;
        down = h.sy < EDGE ? -1 : h.sy > r.height - EDGE ? 1 : 0;
    }
    if (right || down) {
        view.panKeys(right, down, dt * (keys.has('shift') ? 2.5 : 1));
    }
}

export function initInput() {
    const cv = document.getElementById('cv');
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (ev) => {
        onDown(ev, cv);
        cursor(cv, false);
    });
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
    addEventListener('keydown', (e) => {
        if (e.key === 'Shift') {
            keys.add('shift');
        }
        onKey(e);
    });
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
