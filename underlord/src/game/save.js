/**
 * The game in localStorage, one key per value (storage.js), in two slots with the same keys:
 *   game.*   the running game, kept up to date twice a second (syncGame()): it is the truth, so a value
 *            changed there by hand changes the game at once (applyGameChanges()), and a reload continues
 *            where you were
 *   save.*   the saved copy: the Save button and the autosave every two minutes copy the game here,
 *            Load and "Load last save" bring it back
 * SAVE_V is the format version; a slot of another version is not loaded.
 * Only one tab keeps the running game (claimGame(), a Web Lock via shared/one-tab.js): another tab
 * shows a modal until the first one closes or it takes the game over, so two tabs never write over
 * each other's dungeon.
 */
import { recount } from './actions.js';
import { KINDS } from './config.js';
import { HERO, NEUTRAL, PRISONER } from './constants.js';
import { spawn } from './entities.js';
import { newGame } from './map.js';
import { restorePrisoner } from './prison.js';
import { G, app } from './state.js';
import { oneTab } from '../../../shared/one-tab.js';
import { dropOldKey } from '../../../shared/storage.js';
import { store } from './storage.js';
import { clearLog, msg, syncCpu, syncPause } from './ui.js';

const SAVE_V = 3;
/** The per-tile arrays, saved as `<slot>.map.<name>` (JSON lists), and their types. */
const MAPS = { t: Uint8Array, room: Uint8Array, mark: Uint8Array, hp: Uint8Array, gold: Int16Array, seen: Uint8Array, loot: Int16Array, pile: Int16Array, pown: Uint8Array };
/** The rest of `G` that is saved, as `<slot>.<name>`: numbers, the level name (text) and JSON values. */
const NUMBERS = ['money', 'heartHP', 'heartMax', 'time', 'nextWave', 'wave', 'research', 'payT', 'portalT', 'idc', 'hx', 'hy'];
const JSONS = ['spawnQ', 'cpu', 'pool', 'portals', 'portal', 'gate', 'rally'];
const SAVE_KEYS = ['id', 'kind', 'side', 'x', 'y', 'hp', 'maxhp', 'atk', 'lvl', 'xp', 'carry', 'hunger', 'guard', 'bed', 'leaving', 'fromPool', 'payDue', 'cell', 'party'];

/** The game as plain data; without `maps` the per-tile arrays are left out (syncGame() writes them itself). */
function serialize(maps = true) {
    return {
        v: SAVE_V, savedAt: Date.now(),
        ...(maps ? Object.fromEntries(Object.keys(MAPS).map((name) => [name, Array.from(G[name])])) : {}),
        money: G.money, heartHP: G.heartHP, heartMax: G.heartMax, time: G.time, nextWave: G.nextWave, wave: G.wave, spawnQ: G.spawnQ, research: G.research,
        cpu: G.cpu, payT: G.payT, pool: G.pool, portals: G.portals, level: G.level, portalT: G.portalT, idc: G.idc, hx: G.hx, hy: G.hy, portal: G.portal, gate: G.gate, rally: G.rally,
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

function deserialize(s, message) {
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
    msg(message);
    syncCpu();
}

/** A slot (`game` or `save`) as serialize() made it, or null when there is none. */
function readSlot(slot) {
    if (!store.has(slot + '.version')) {
        return null;
    }
    const s = { v: store.readNumber(slot + '.version', 0), savedAt: store.readNumber(slot + '.savedAt', 0), level: store.read(slot + '.level') ?? undefined };
    for (const name of Object.keys(MAPS)) {
        s[name] = store.readJson(`${slot}.map.${name}`, undefined);
    }
    for (const name of NUMBERS) {
        s[name] = store.readFloat(`${slot}.${name}`, undefined);
    }
    for (const name of JSONS) {
        s[name] = store.readJson(`${slot}.${name}`, undefined);
    }
    s.ents = store.keys(slot + '.unit.').map((key) => store.readJson(key, null)).filter((o) => o && typeof o === 'object' && KINDS[o.kind]);

    return s;
}

/**
 * Writes a game made by serialize() into a slot, one key per value (unchanged values are skipped),
 * and drops the keys of units that are gone. Returns false when a value could not be kept.
 */
function writeSlot(slot, d) {
    let ok = true;
    const keep = (key, value) => {
        ok = store.write(key, value) && ok;
    };
    const units = new Set(d.ents.map((o) => `${slot}.unit.${o.id}`));
    for (const key of store.keys(slot + '.unit.')) {
        if (!units.has(key)) {
            store.write(key, null);
        }
    }
    for (const o of d.ents) {
        keep(`${slot}.unit.${o.id}`, o);
    }
    for (const name of Object.keys(MAPS)) {
        if (d[name]) {
            keep(`${slot}.map.${name}`, d[name]);
        }
    }
    for (const name of [...NUMBERS, 'level', ...JSONS]) {
        // null (no rally, say) is kept as the text null, so it is not mistaken for a missing value.
        keep(`${slot}.${name}`, d[name] === null ? 'null' : d[name]);
    }
    if (slot === 'save') {
        keep('save.savedAt', d.savedAt);
    }
    keep(slot + '.version', d.v);

    return ok;
}

/** Empties a slot. */
function clearSlot(slot) {
    for (const key of store.keys(slot + '.')) {
        store.write(key, null);
    }
    if (slot === 'game') {
        mapHash.clear();
    }
}

/** A quick fingerprint of a tile array (FNV-1a over its values), so an unchanged map is not turned into text. */
function hash(a) {
    let h = 2166136261;
    for (let i = 0; i < a.length; i++) {
        h = Math.imul(h ^ a[i], 16777619);
    }

    return h;
}

/** The fingerprint of each map as last written to the game slot. */
const mapHash = new Map();

/** Writes the maps that changed since the last time into the game slot. */
function syncMaps() {
    for (const name of Object.keys(MAPS)) {
        const h = hash(G[name]);
        if (mapHash.get(name) !== h && store.write(`game.map.${name}`, Array.from(G[name]))) {
            mapHash.set(name, h);
        }
    }
}

/** Whether this tab keeps the running game (see claimGame()). */
let owner = false;

/**
 * Keeps the running game in this tab only (shared/one-tab.js): while another tab has it a modal
 * covers the page and this tab writes nothing. Taken back, a running game reads what the other tab
 * left (or goes back to the intro card when that game ended).
 */
export function claimGame() {
    oneTab('underlord.game', {
        game: 'Underlord',
        accent: '#b3261e',
        ink: '#ffffff',
        onOwner(again) {
            owner = true;
            refreshContinue();
            if (again && app.running) {
                if (store.has('game.version')) {
                    loadGame('game');
                } else {
                    app.running = false;
                    document.getElementById('ov').hidden = false;
                }
            }
        },
        onLost() {
            owner = false;
            if (app.running && !app.paused) {
                app.paused = true;
                syncPause();
            }
        },
    });
}

/**
 * Keeps the `game` slot equal to the running game: first takes in what was changed there by hand
 * (`check`, from store.watch()), then writes what the game changed. A finished game is removed, so
 * Continue does not bring back a lost or won dungeon.
 */
export function syncGame(check) {
    check();
    if (!owner || !G || !app.running) {
        return;
    }
    if (G.over) {
        if (store.has('game.version')) {
            clearSlot('game');
            refreshContinue();
        }

        return;
    }
    const fresh = !store.has('game.version');
    writeSlot('game', serialize(false));
    syncMaps();
    if (fresh) {
        refreshContinue();
    }
}

let saving = false;

export function saveGame(auto) {
    if (!G || G.over || saving) {
        return;
    }
    saving = true;
    const d = serialize();
    const ok = writeSlot('save', d);
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

/** Loads a slot: the saved copy (Load, "Load last save"), or the running game (Continue). */
export function loadGame(slot = 'save') {
    const s = readSlot(slot);
    if (!s) {
        msg('No saved game found.', 'nosave', 'bad');

        return;
    }
    if (s.v !== SAVE_V) {
        msg('That save is from an older version of the game and cannot be loaded.', 'oldsave', 'bad');

        return;
    }
    deserialize(s, slot === 'save' ? 'Saved game loaded.' : 'Welcome back to ' + (s.level || 'your realm') + '.');
    document.getElementById('ov').hidden = true;
    app.running = true;
    app.paused = false;
    syncPause();
    // The game slot follows the loaded game straight away.
    writeSlot('game', serialize(false));
    syncMaps();
}

/** Continue on the intro card: the running game, else the saved copy. */
export function continueGame() {
    loadGame(store.has('game.version') ? 'game' : 'save');
}

/** Shows Continue when there is a game to go on with, and enables Load when a saved copy exists. */
export function refreshContinue() {
    const b = document.getElementById('bContinue');
    if (b) {
        b.hidden = !store.has('game.version') && !store.has('save.version');
    }
    document.getElementById('bLoad').disabled = !store.has('save.version');
}

/**
 * A value of the running game changed by hand (or in another tab) changes the game at once: the
 * fields of `G`, the tile arrays and the units (a new unit key adds the unit, a removed one takes it
 * away). Changes to the saved copy only update Continue and Load.
 */
export function applyGameChanges(keys) {
    refreshContinue();
    const own = keys.filter((key) => key.startsWith('game.'));
    if (!own.length || !G || !app.running || G.over) {
        return;
    }
    const s = readSlot('game');
    if (!s) {
        return;
    }
    const fields = own.filter((key) => !key.startsWith('game.unit.'));
    if (fields.length) {
        const changed = {};
        for (const key of fields) {
            const name = key.replace(/^game\.(map\.)?/, '');
            changed[name] = s[name];
        }
        restoreFields(changed);
    }
    for (const key of own.filter((key) => key.startsWith('game.unit.'))) {
        const id = Number(key.slice('game.unit.'.length));
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
