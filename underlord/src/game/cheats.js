/**
 * The Cheats panel: hidden until someone types the cheat code (iliketocheat), for the current page load
 * only. Gold, the map, research, the Heart, free units, levels, waves, payday and beating the heroes.
 */
import { CLAIM, HERO, ix, rand, tx, ty } from './constants.js';
import { ATTRACT, KINDS, SPELLS, WAVES } from './config.js';
import { kill } from './combat.js';
import { creatures, gainXP, need, research, spawn } from './entities.js';
import { G, app } from './state.js';
import { msg } from './ui.js';
import { fx } from './world.js';

const $ = (id) => document.getElementById(id);

// A list, not a constant: it is built after the config is read (the summon buttons use the creature names).
const cheatList = () => [
    ['+500 gold', () => {
        G.money += 500;

        return '+500 gold';
    }],
    ['+5000 gold', () => {
        G.money += 5000;

        return '+5000 gold';
    }],
    ['Reveal map', () => {
        G.seen.fill(1);
        G.fogDirty = true;

        return 'map revealed';
    }],
    ['Finish research', () => {
        research(Math.max(0, Math.max(...Object.values(SPELLS).map((s) => s.req || 0)) - G.research));

        return 'all spells unlocked';
    }],
    ['Restore Heart', () => {
        G.heartHP = G.heartMax;

        return 'Heart restored';
    }],
    ['Free imp', () => {
        const r = [];
        for (let i = 0; i < G.t.length; i++) {
            if (G.t[i] === CLAIM) {
                r.push(i);
            }
        }
        const i = r[rand(r.length)];
        spawn('imp', tx(i), ty(i));

        return 'free imp';
    }],
    ...Object.keys(ATTRACT).map((k) => ['+ ' + KINDS[k].n, () => {
        const p = G.portals.find((q) => G.pown[q]);
        const i = p !== undefined ? p : ix(G.hx + 2, G.hy);
        const e = spawn(k, tx(i), ty(i));
        fx({ type: 'ring', x: e.x, y: e.y, dur: 0.8, col: '#c58cff' });

        return KINDS[k].n + ' summoned';
    }]),
    ['Level up all', () => {
        for (const e of creatures()) {
            gainXP(e, need(e) - e.xp);
        }

        return 'creatures levelled up';
    }],
    ['Next wave now', () => {
        if (G.wave >= WAVES.length) {
            return 'no waves left';
        }
        G.nextWave = 0;

        return 'next wave called';
    }],
    [() => (app.wavesHeld ? 'Resume waves' : 'Pause waves'), () => {
        app.wavesHeld = !app.wavesHeld;

        return app.wavesHeld ? 'wave countdown paused' : 'wave countdown resumed';
    }],
    ['Payday now', () => {
        G.payT = 0;

        return 'payday called';
    }],
    ['Defeat heroes', () => {
        let n = 0;
        for (const e of G.ents) {
            if (e.side === HERO && !e.dead) {
                kill(e);
                n++;
            }
        }

        return n + ' heroes defeated';
    }],
];
// The Cheats panel is hidden until someone types the cheat code. It is not remembered: a reload locks it again.
const CHEAT_CODE = 'iliketocheat';
let cheatsOn = false;
let typed = '';

export function toggleCheats(open) {
    const c = $('cheats');
    const b = $('bCheat');
    if (!c || !b || !cheatsOn) {
        return;
    }
    open = open ?? c.hidden;
    c.hidden = !open;
    b.setAttribute('aria-expanded', String(open));
}

/**
 * Feeds a typed character to the cheat code. True when the key belongs to the code being typed (two
 * or more letters in, so its L, T, H, E, A, ... do not also jump, turn or scroll the view) or just unlocked it.
 */
export function cheatKey(key) {
    if (cheatsOn || key.length !== 1) {
        return false;
    }
    typed = (typed + key.toLowerCase()).slice(-CHEAT_CODE.length);
    if (typed !== CHEAT_CODE) {
        for (let k = CHEAT_CODE.length - 1; k >= 2; k--) {
            if (typed.endsWith(CHEAT_CODE.slice(0, k))) {
                return true;
            }
        }

        return false;
    }
    cheatsOn = true;
    $('bCheat').hidden = false;
    toggleCheats(true);
    if (G) {
        msg('Cheat mode unlocked.', 'cheatcode', 'good');
    }

    return true;
}

export const cheatsUnlocked = () => cheatsOn;

/** Fills the Cheats panel with its buttons and wires the header's Cheats button. Runs once at start. */
export function initCheats() {
    for (const [label, fn] of cheatList()) {
        const b = document.createElement('button');
        b.type = 'button';
        const name = () => (typeof label === 'function' ? label() : label);
        b.textContent = name();
        b.onclick = () => {
            if (!app.running || G.over) {
                return;
            }
            const r = fn();
            b.textContent = name();
            msg('Cheat: ' + r + '.', 'cheat' + G.time + label, 'good');
        };
        $('cheatList').appendChild(b);
    }
    $('bCheat').onclick = () => toggleCheats();
}
