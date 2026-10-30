/**
 * Saved games: one slot in localStorage, one key per value under `underlord.save.` (storage.js), saved
 * with the Save button and every two minutes. SAVE_V is the format version; loadGame() refuses saves
 * of another version. A save value changed by hand also changes the running game (applySaveChanges()).
 */
import { recount } from './actions.js';
import { KINDS } from './config.js';
import { HERO, NEUTRAL, PRISONER } from './constants.js';
import { spawn } from './entities.js';
import { newGame } from './map.js';
import { restorePrisoner } from './prison.js';
import { G, app } from './state.js';
import { dropOldKey } from '../../../shared/storage.js';
import { store } from './storage.js';
import { clearLog, msg, syncCpu, syncPause } from './ui.js';

const SAVE_V = 3;
/** The per-tile arrays, saved as `save.map.<name>` (JSON lists), and their types. */
const MAPS = { t: Uint8Array, room: Uint8Array, mark: Uint8Array, hp: Uint8Array, gold: Int16Array, seen: Uint8Array, loot: Int16Array, pile: Int16Array, pown: Uint8Array };
/** The rest of `G` that is saved, as `save.<name>`: numbers, the level name (text) and JSON values. */
const NUMBERS = ['money', 'heartHP', 'heartMax', 'time', 'nextWave', 'wave', 'research', 'payT', 'portalT', 'idc', 'hx', 'hy'];
const JSONS = ['spawnQ', 'cpu', 'pool', 'portals', 'portal', 'gate', 'rally'];
const SAVE_KEYS = ['id', 'kind', 'side', 'x', 'y', 'hp', 'maxhp', 'atk', 'lvl', 'xp', 'carry', 'hunger', 'guard', 'bed', 'leaving', 'fromPool', 'payDue', 'cell', 'party'];

function serialize() {
    return {
        v: SAVE_V, savedAt: Date.now(),
        t: Array.from(G.t), room: Array.from(G.room), mark: Array.from(G.mark), hp: Array.from(G.hp), gold: Array.from(G.gold), seen: Array.from(G.seen), loot: Array.from(G.loot), pile: Array.from(G.pile),
        money: G.money, heartHP: G.heartHP, heartMax: G.heartMax, time: G.time, nextWave: G.nextWave, wave: G.wave, spawnQ: G.spawnQ, research: G.research,
        cpu: G.cpu, payT: G.payT, pown: Array.from(G.pown), pool: G.pool, portals: G.portals, level: G.level, portalT: G.portalT, idc: G.idc, hx: G.hx, hy: G.hy, portal: G.portal, gate: G.gate, rally: G.rally,
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

/** States are not saved: a loaded unit starts as its side does. */
function startState(e) {
    if (e.side === PRISONER) {
        restorePrisoner(e);
    } else {
        e.state = e.side === NEUTRAL ? 'neutral' : e.guard ? 'guard' : e.side === HERO ? 'march' : 'think';
    }
}

/** Puts the saved fields of `G` (all but the units) into the game; a missing or broken one keeps its value. */
function restoreFields(s) {
    for (const [name, Type] of Object.entries(MAPS)) {
        if (Array.isArray(s[name]) && s[name].length === G.room.length) {
            G[name] = Type.from(s[name]);
        }
    }
    for (const name of [...NUMBERS, 'level', ...JSONS]) {
        if (s[name] !== undefined) {
            G[name] = name === 'pool' ? { ...G.pool, ...s.pool } : s[name];
        }
    }
    G.spawnQ ||= [];
    G.fogDirty = true;
}

/** A saved unit, made with spawn() defaults and then given the saved fields. */
function restoreUnit(o) {
    const e = spawn(o.kind, 0, 0);
    G.ents.pop();
    Object.assign(e, o);
    startState(e);
    e.path = [];
    if (o.held) {
        e.held = true;
        G.held.push(e);
    }

    return e;
}

function deserialize(s) {
    newGame();
    Object.assign(G, { ents: [], held: [], fx: [], res: new Map(), msgCd: {}, over: null });
    restoreFields(s);
    // Saves made before held units stopped being written twice list them twice: keep the first copy of each id.
    const ids = new Set();
    for (const o of s.ents) {
        if (ids.has(o.id)) {
            continue;
        }
        ids.add(o.id);
        G.ents.push(restoreUnit(o));
    }
    recount();
    clearLog();
    msg('Saved game loaded.');
    syncCpu();
}

/** The saved game as serialize() made it, or null when there is none. */
function readSave() {
    if (!store.has('save.version')) {
        return null;
    }
    const s = { v: store.readNumber('save.version', 0), savedAt: store.readNumber('save.savedAt', 0), level: store.read('save.level') ?? undefined };
    for (const name of Object.keys(MAPS)) {
        s[name] = store.readJson('save.map.' + name, undefined);
    }
    for (const name of NUMBERS) {
        s[name] = store.readFloat('save.' + name, undefined);
    }
    for (const name of JSONS) {
        s[name] = store.readJson('save.' + name, undefined);
    }
    s.ents = store.keys('save.unit.').map((key) => store.readJson(key, null)).filter((o) => o && typeof o === 'object' && KINDS[o.kind]);

    return s;
}

/** Writes a save made by serialize(), one key per value, and drops the keys of units that are gone. */
function writeSave(d) {
    let ok = true;
    const keep = (key, value) => {
        ok = store.write(key, value) && ok;
    };
    const units = new Set(d.ents.map((o) => 'save.unit.' + o.id));
    for (const key of store.keys('save.unit.')) {
        if (!units.has(key)) {
            store.write(key, null);
        }
    }
    for (const o of d.ents) {
        keep('save.unit.' + o.id, o);
    }
    for (const name of Object.keys(MAPS)) {
        keep('save.map.' + name, d[name]);
    }
    for (const name of [...NUMBERS, 'level', ...JSONS]) {
        // null (no rally, say) is kept as the text null, so it is not mistaken for a missing value.
        keep('save.' + name, d[name] === null ? 'null' : d[name]);
    }
    keep('save.savedAt', d.savedAt);
    keep('save.version', d.v);

    return ok;
}

// The earlier format kept the save as JSON under one key (`underlord-save`, the same fields): converted
// once, of any version, so loadGame() still tells an older one apart.
dropOldKey('underlord-save', (text) => writeSave(JSON.parse(text)));

let saving = false;

export function saveGame(auto) {
    if (!G || G.over || saving) {
        return;
    }
    saving = true;
    const d = serialize();
    const ok = writeSave(d);
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
    const s = readSave();
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
    const s = store.has('save.version');
    const b = document.getElementById('bContinue');
    if (b) {
        b.hidden = !s;
    }
    document.getElementById('bLoad').disabled = !s;
}

/**
 * A save value changed by hand (or in another tab) also changes the running game: the fields of `G`,
 * the tile arrays and the units (a new unit key adds the unit, a removed one takes it away).
 */
export function applySaveChanges(keys) {
    refreshContinue();
    if (!G || !app.running || G.over) {
        return;
    }
    const s = readSave();
    if (!s) {
        return;
    }
    const fields = keys.filter((key) => !key.startsWith('save.unit.'));
    if (fields.length) {
        const changed = {};
        for (const key of fields) {
            const name = key.replace(/^save\.(map\.)?/, '');
            changed[name] = s[name];
        }
        restoreFields(changed);
    }
    for (const key of keys.filter((key) => key.startsWith('save.unit.'))) {
        const id = Number(key.slice('save.unit.'.length));
        const o = store.readJson(key, null);
        const e = G.ents.find((u) => u.id === id && !u.dead);
        if (o && typeof o === 'object' && KINDS[o.kind]) {
            if (e) {
                Object.assign(e, Object.fromEntries(SAVE_KEYS.filter((k) => k !== 'id' && o[k] !== undefined).map((k) => [k, o[k]])));
            } else {
                G.ents.push(restoreUnit({ ...o, id }));
            }
        } else if (e && !store.has(key)) {
            e.dead = true;
            G.held = G.held.filter((u) => u !== e);
        }
    }
    recount();
    syncCpu();
}
