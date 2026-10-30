/**
 * The simulation step: update(dt) advances the whole game (waves, portal, payday, the Heart's zap,
 * every unit's state machine: tick() in states.js), then checks for a win or a loss.
 */
import { sound } from './audio.js';
import { HERO, tx, ty, words } from './constants.js';
import { CFG, ECON, KINDS, WAVES } from './config.js';
import { payday, tryAttract } from './creatures.js';
import { cpuTick } from './cpu.js';
import { spawn } from './entities.js';
import { kill } from './combat.js';
import { newGame, vision } from './map.js';
import { loadGame } from './save.js';
import { tick } from './states.js';
import { G, app } from './state.js';
import { anyPortal, ti } from './tiles.js';
import { banner, msg, syncPause } from './ui.js';

/** Queues a visual effect; the renderer draws it until `t` reaches `dur`. */
export function fx(f) {
    f.t = 0;
    G.fx.push(f);
}

/** Heroes walking through ground nobody has discovered: drawn as white dots. */
export function unknownHeroes() {
    return G.ents.filter((e) => e.side === HERO && !e.dead && !e.guard && !G.seen[ti(e)]);
}

function launchWave() {
    const w = WAVES[G.wave];
    G.wave++;
    let d = 0;
    for (const [k, c] of Object.entries(w)) {
        for (let i = 0; i < c; i++) {
            G.spawnQ.push({ k, t: d });
            d += 1.2;
        }
    }
    msg('Wave ' + G.wave + ': heroes are invading your realm!', 'wave' + G.wave, 'bad');
    sound('horn');
    banner(w.lord ? 'The ' + KINDS.lord.n + ' approaches' : 'Heroes approach');
}

export function update(dt) {
    if (G.over) {
        return;
    }
    G.time += dt;
    if (G.wave < WAVES.length && !app.wavesHeld) {
        G.nextWave -= dt;
        if (G.nextWave <= 0) {
            launchWave();
            G.nextWave = CFG.waves.interval;
        }
    }
    for (const q of G.spawnQ) {
        q.t -= dt;
    }
    while (G.spawnQ.length && G.spawnQ[0].t <= 0) {
        const q = G.spawnQ.shift();
        const e = spawn(q.k, tx(G.gate), ty(G.gate), 1 + CFG.waves.heroScalePerWave * (G.wave - 1));
        // one wave is one party: its members follow their Tunneller (march())
        e.party = G.wave;
        fx({ type: 'ring', x: e.x, y: e.y, dur: 0.6, col: '#bcd2f0' });
    }
    if (anyPortal()) {
        G.portalT -= dt;
        if (G.portalT <= 0) {
            G.portalT = CFG.portal.interval;
            tryAttract();
        }
    }
    G.payT -= dt;
    if (G.payT <= 0) {
        G.payT = ECON.payInterval;
        payday();
    }
    if (G.heartFlash > 0) {
        G.heartFlash -= dt;
    }
    if (G.heartAlarm > 0) {
        G.heartAlarm -= dt;
    }
    if ((G.zapT -= dt) <= 0) {
        const c = { x: G.hx + 0.5, y: G.hy + 0.5 };
        let best = null;
        let bd = CFG.heart.zapRange;
        for (const o of G.ents) {
            if (o.dead || o.side !== HERO) {
                continue;
            }
            const d = Math.hypot(o.x - c.x, o.y - c.y);
            if (d < bd) {
                bd = d;
                best = o;
            }
        }
        if (best) {
            G.zapT = CFG.heart.zapInterval;
            fx({ type: 'proj', x: c.x, y: c.y, x1: best.x, y1: best.y, dur: 0.2, col: '#ff6a4a', heart: true });
            sound('zap', c.x, c.y);
            best.hp -= CFG.heart.zapDamage;
            best.hurtT = 0.3;
            if (best.hp <= 0) {
                kill(best);
            }
        }
    }
    for (const e of G.ents) {
        if (!e.dead && !e.held) {
            tick(e, dt);
        }
    }
    G.ents = G.ents.filter((e) => !e.dead);
    if ((G.visT -= dt) <= 0) {
        G.visT = 0.25;
        vision();
    }
    cpuTick(dt);
    for (const f of G.fx) {
        f.t += dt;
    }
    G.fx = G.fx.filter((f) => f.t < f.dur);
    if (G.heartHP <= 0) {
        G.heartHP = 0;
        end(false);
    } else if (G.wave >= WAVES.length && !G.spawnQ.length && !G.ents.some((e) => e.side === HERO && !e.guard)) {
        end(true);
    }
}

function end(win) {
    G.over = win ? 'win' : 'lose';
    sound(win ? 'win' : 'lose');
    const ov = document.getElementById('ov');
    ov.innerHTML = win
        ? '<div class="card"><h2>The surface kneels</h2><p>All ' + words(WAVES.length) + ' invasions are broken' + (WAVES.some((w) => w.lord) ? ' and the ' + KINDS.lord.n + ' lies in your dungeon' : '') + '. Your reign is complete.</p><div class="row"><button id="bAgain" class="main" type="button">New dungeon</button></div></div>'
        : '<div class="card"><h2>The Heart is broken</h2><p>The heroes destroyed your Dungeon Heart during wave ' + G.wave + '. Dig deeper, build stronger and try again.</p><div class="row"><button id="bAgain" class="main" type="button">Try again</button><button id="bAgainLoad" type="button">Load last save</button></div></div>';
    ov.hidden = false;
    document.getElementById('bAgain').onclick = () => {
        ov.hidden = true;
        newGame();
        app.paused = false;
        syncPause();
    };
    const l = document.getElementById('bAgainLoad');
    if (l) {
        l.onclick = () => loadGame('save');
    }
}
