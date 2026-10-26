/**
 * Saved games: one slot in localStorage ('underlord-save'), saved with the Save button and every two
 * minutes. SAVE_V is the format version; loadGame() refuses saves of another version.
 */
import { recount } from './actions.js';
import { PRISON } from './constants.js';
import { spawn } from './entities.js';
import { newGame } from './map.js';
import { G, app } from './state.js';
import { clearLog, msg, syncCpu, syncPause } from './ui.js';

const SAVE_V = 3;
const SAVE_KEYS = ['id', 'kind', 'side', 'x', 'y', 'hp', 'maxhp', 'atk', 'lvl', 'xp', 'carry', 'hunger', 'guard', 'bed', 'leaving', 'fromPool', 'payDue', 'cell'];

function serialize() {
    return {
        v: SAVE_V, savedAt: Date.now(),
        t: Array.from(G.t), room: Array.from(G.room), mark: Array.from(G.mark), hp: Array.from(G.hp), gold: Array.from(G.gold), seen: Array.from(G.seen), loot: Array.from(G.loot), pile: Array.from(G.pile),
        money: G.money, heartHP: G.heartHP, heartMax: G.heartMax, time: G.time, nextWave: G.nextWave, wave: G.wave, spawnQ: G.spawnQ, research: G.research,
        cpu: G.cpu, payT: G.payT, pown: Array.from(G.pown), pool: G.pool, portals: G.portals, portalT: G.portalT, idc: G.idc, hx: G.hx, hy: G.hy, portal: G.portal, gate: G.gate, rally: G.rally,
        ents: G.ents.filter((e) => !e.dead).map((e) => {
            const o = {};
            for (const k of SAVE_KEYS) {
                o[k] = e[k];
            }
            o.held = e.held;

            return o;
        }),
    };
}

function deserialize(s) {
    newGame();
    const A = (C, a) => C.from(a);
    Object.assign(G, {
        t: A(Uint8Array, s.t), room: A(Uint8Array, s.room), mark: A(Uint8Array, s.mark), hp: A(Uint8Array, s.hp), gold: A(Int16Array, s.gold), seen: A(Uint8Array, s.seen), loot: A(Int16Array, s.loot), pile: A(Int16Array, s.pile ?? s.loot.map(() => 0)),
        money: s.money, heartHP: s.heartHP, heartMax: s.heartMax, time: s.time, nextWave: s.nextWave, wave: s.wave, spawnQ: s.spawnQ || [], research: s.research,
        cpu: s.cpu || G.cpu, payT: s.payT, pown: A(Uint8Array, s.pown), pool: { ...G.pool, ...s.pool }, portals: s.portals, portalT: s.portalT, idc: s.idc, hx: s.hx, hy: s.hy, portal: s.portal, gate: s.gate, rally: s.rally,
        ents: [], held: [], fx: [], res: new Map(), msgCd: {}, over: null,
    });
    // Saves made before held units stopped being written twice list them twice: keep the first copy of each id.
    const ids = new Set();
    for (const o of s.ents) {
        if (ids.has(o.id)) {
            continue;
        }
        ids.add(o.id);
        const e = spawn(o.kind, 0, 0);
        G.ents.pop();
        Object.assign(e, o);
        e.state = e.side === 2 ? 'neutral' : e.side === 3 ? (e.cell >= 0 && G.room[e.cell] === PRISON ? 'jailed' : 'out') : e.guard ? 'guard' : e.side === 1 ? 'march' : 'think';
        if (e.side === 3) {
            e.timer = e.state === 'out' ? 30 : 0;
            e.by = 0;
            if (e.state === 'out') {
                e.cell = -1;
            }
        }
        e.path = [];
        if (o.held) {
            e.held = true;
            G.held.push(e);
        }
        G.ents.push(e);
    }
    recount();
    G.fogDirty = true;
    clearLog();
    msg('Saved game loaded.');
    syncCpu();
}

// Games are saved in this browser (localStorage).
function lsGet() {
    try {
        const s = localStorage.getItem('underlord-save');

        return s ? JSON.parse(s) : null;
    } catch {
        return null;
    }
}

function lsSet(d) {
    try {
        localStorage.setItem('underlord-save', JSON.stringify(d));

        return true;
    } catch {
        return false;
    }
}

let saving = false;

export function saveGame(auto) {
    if (!G || G.over || saving) {
        return;
    }
    saving = true;
    const d = serialize();
    const ok = lsSet(d);
    saving = false;
    const el = document.getElementById('savedAt');
    if (ok) {
        el.textContent = (auto ? 'Autosaved ' : 'Saved ') + new Date(d.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        el.title = 'Stored in this browser';
        if (!auto) {
            msg('Game saved.', 'save' + G.time, 'good');
        }
    } else {
        el.textContent = 'Saving failed';
        if (!auto) {
            msg('The game could not be saved here.', 'savefail', 'bad');
        }
    }
    refreshContinue();
}

export function loadGame() {
    const s = lsGet();
    if (!s) {
        msg('No saved game found.', 'nosave', 'bad');

        return;
    }
    if (s.v !== SAVE_V) {
        msg('That save is from an older version of the game and cannot be loaded.', 'oldsave', 'bad');

        return;
    }
    deserialize(s);
    document.getElementById('ov').hidden = true;
    app.running = true;
    app.paused = false;
    syncPause();
}

/** Shows "Continue saved game" and enables Load when a save exists. */
export function refreshContinue() {
    const s = lsGet();
    const b = document.getElementById('bContinue');
    if (b) {
        b.hidden = !s;
    }
    document.getElementById('bLoad').disabled = !s;
}
