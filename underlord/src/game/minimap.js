/**
 * The minimap in the panel, redrawn every 0.2 s: one cell per tile (undiscovered ground dark, with its
 * gold and gems hinted; rooms in their colour), the portals, heroes in undiscovered ground as white dots,
 * the units on discovered ground and the part of the map the camera sees. Clicking it is input.js.
 */
import { GEM, GOLD, H, HERO, NEUTRAL, OWN, PRISONER, W, tx, ty } from './constants.js';
import { ASSETS, ROOMS, isWorker } from './config.js';
import { G } from './state.js';
import { ti } from './tiles.js';
import { view } from '../render/view.js';

const $ = (id) => document.getElementById(id);

/** Draws the minimap. */
export function drawMini() {
    const m = $('mini');
    const w = m.clientWidth;
    if (!w) {
        return;
    }
    const d = window.devicePixelRatio || 1;
    const h = Math.round(w * H / W);
    if (m.width !== Math.round(w * d)) {
        m.width = Math.round(w * d);
        m.height = Math.round(h * d);
    }
    const c = m.getContext('2d');
    const s = m.width / W;
    c.setTransform(1, 0, 0, 1, 0, 0);
    const col = ['#121116', '#4b3423', ASSETS.goldColor, ASSETS.gemColor, '#2a211b', '#6a2620', '#ff4a3a', '#c24bd6', '#bcd2f0', '#e0561b', '#6b5d55'];
    for (let i = 0; i < G.t.length; i++) {
        const t = G.t[i];
        c.fillStyle = !G.seen[i] ? (t === GOLD ? '#5a4416' : t === GEM ? '#4a1834' : '#0c0a0f') : G.room[i] ? ROOMS[G.room[i]].col : col[t];
        c.fillRect(tx(i) * s, ty(i) * s, Math.ceil(s), Math.ceil(s));
    }
    for (const P of G.portals) {
        c.fillStyle = G.pown[P] ? '#ff6ad5' : '#8a6ab0';
        c.fillRect((tx(P) - 0.25) * s, (ty(P) - 0.25) * s, s * 1.5, s * 1.5);
    }
    for (const e of G.ents) {
        if (e.side === HERO && !e.dead && !e.guard && !G.seen[ti(e)]) {
            c.fillStyle = '#ffffff';
            c.beginPath();
            c.arc(e.x * s, e.y * s, s * 0.45, 0, Math.PI * 2);
            c.fill();
        }
    }
    for (const e of G.ents) {
        if (e.dead || e.held || (e.side !== OWN && !G.seen[ti(e)])) {
            continue;
        }
        c.fillStyle = e.side === HERO ? '#8fb4ef' : e.side === NEUTRAL || e.side === PRISONER ? '#9a928a' : isWorker(e) ? '#ffb070' : '#ffe2a0';
        c.fillRect(e.x * s - s * 0.4, e.y * s - s * 0.4, s * 0.8, s * 0.8);
    }
    // the part of the map the camera sees (a trapezoid when the camera is tilted)
    const poly = view.groundView();
    if (poly) {
        c.strokeStyle = 'rgba(255,240,220,.85)';
        c.lineWidth = Math.max(1, d);
        c.beginPath();
        poly.forEach(([x, y], k) => (k ? c.lineTo(x * s, y * s) : c.moveTo(x * s, y * s)));
        c.closePath();
        c.stroke();
    }
}
