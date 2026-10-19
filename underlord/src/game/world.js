/**
 * The simulation step: update(dt) advances the whole game (waves, portal, payday, the Heart's zap,
 * every unit's state machine in tick()), then checks for a win or a loss.
 */
import { HATCH, LIB, TRAIN, tx, ty, words } from './constants.js';
import { CFG, ECON, KINDS, WAVES } from './config.js';
import { creatureThink, payday, tryAttract } from './creatures.js';
import { cpuTick } from './cpu.js';
import { addGold, arrive, gainXP, go, hasBed, leave, release, research, spawn, step, toPool } from './entities.js';
import { fight, heartFoe, joy, kill, march, nearestEnemy } from './combat.js';
import { doClaim, doDig, doReinforce, impThink } from './imps.js';
import { newGame, vision } from './map.js';
import { bfs } from './path.js';
import { loadGame } from './save.js';
import { G, app } from './state.js';
import { adjHeart, anyPortal, ti } from './tiles.js';
import { banner, msg, syncPause } from './ui.js';

/** Queues a visual effect; the renderer draws it until `t` reaches `dur`. */
export function fx(f) {
    f.t = 0;
    G.fx.push(f);
}

/** Heroes walking through ground nobody has discovered: drawn as white dots. */
export function unknownHeroes() {
    return G.ents.filter((e) => e.side === 1 && !e.dead && !e.guard && !G.seen[ti(e)]);
}

/** One unit's state machine for one step. */
function tick(e, dt) {
    if (e.side === 2) {
        return;
    }
    e.cd -= dt;
    if (e.slap > 0) {
        e.slap -= dt;
    }
    // Short-lived hints for the renderer's animations; not saved.
    if (e.hitT > 0) {
        e.hitT -= dt;
    }
    if (e.hurtT > 0) {
        e.hurtT -= dt;
    }
    if (e.digging > 0) {
        e.digging -= dt;
    }
    if (e.side === 0) {
        const i = ti(e);
        if (G.loot[i] > 0) {
            const a = addGold(G.loot[i]);
            if (a > 0) {
                G.loot[i] -= a;
                fx({ type: 'text', x: e.x, y: e.y - 0.3, dur: 1.2, txt: '+' + a, col: '#e3b23c' });
                msg('Treasure found: ' + a + ' gold.', 'loot' + i, 'good');
            }
        }
    }
    if (e.side === 0 && e.kind !== 'imp') {
        e.hunger += dt * 1.5;
        if (e.hunger >= 200 && !e.leaving) {
            e.hunger = 0;
            leave(e, 'starving');
        }
    }
    // Imps flee from heroes, except while the Heart is under attack: then the ones nearby defend it.
    if (e.kind === 'imp' && e.state !== 'stun' && e.state !== 'fight') {
        e.scan -= dt;
        if (e.scan <= 0) {
            e.scan = 0.5;
            const h = G.heartAlarm > 0 && heartFoe(e);
            if (h) {
                release(e);
                e.state = 'fight';
                e.target = h;
                e.path = [];
                e.repath = 0;
            } else if (e.state !== 'flee') {
                const o = nearestEnemy(e, 3.2);
                if (o) {
                    release(e);
                    const p = bfs(ti(e), (i) => adjHeart(i) && Math.hypot(tx(i) - o.x, ty(i) - o.y) > 3, 1);
                    if (p && p.length) {
                        go(e, p, 'idle', 3);
                        e.state = 'flee';
                    }
                }
            }
        }
    }
    if (e.kind !== 'imp' && e.state !== 'fight' && e.state !== 'stun' && !e.leaving) {
        e.scan -= dt;
        if (e.scan <= 0) {
            e.scan = 0.5;
            if (G.time >= e.ignoreT) {
                const o = nearestEnemy(e, e.side ? 5 : 8);
                if (o) {
                    release(e);
                    e.state = 'fight';
                    e.target = o;
                    e.path = [];
                    e.repath = 0;
                }
            }
        }
    }
    switch (e.state) {
        case 'stun':
            if ((e.timer -= dt) <= 0) {
                if (e.after) {
                    e.state = e.after[0];
                    e.timer = e.after[1];
                    e.after = null;
                } else {
                    e.state = 'think';
                }
            }
            break;
        case 'think':
            e.boost = 1;
            if (e.side) {
                if (e.guard) {
                    e.state = 'guard';
                } else {
                    e.state = 'march';
                    e.path = [];
                    e.repath = 0;
                }
            } else if (e.kind === 'imp') {
                impThink(e);
            } else {
                creatureThink(e);
            }
            break;
        case 'guard':
            break;
        case 'walk':
        case 'flee':
            if (step(e, dt)) {
                arrive(e);
            }
            break;
        case 'idle':
            if ((e.timer -= dt) <= 0) {
                e.state = 'think';
            }
            break;
        case 'dig':
            doDig(e, dt);
            break;
        case 'claim':
            doClaim(e, dt);
            break;
        case 'reinforce':
            doReinforce(e, dt);
            break;
        case 'sleep':
            if (ti(e) !== e.bed || !hasBed(e)) {
                e.state = 'think';
                break;
            }
            e.hp = Math.min(e.maxhp, e.hp + e.maxhp * 0.06 * dt);
            if (e.hp >= e.maxhp) {
                e.state = 'think';
            }
            break;
        case 'eat':
            if (G.room[ti(e)] !== HATCH) {
                e.state = 'think';
                break;
            }
            if ((e.timer -= dt) <= 0) {
                e.hunger = 0;
                e.hp = Math.min(e.maxhp, e.hp + e.maxhp * 0.15);
                e.state = 'think';
            }
            break;
        case 'train':
            if (G.room[ti(e)] !== TRAIN || G.money <= 0) {
                e.state = 'think';
                break;
            }
            G.money = Math.max(0, G.money - ECON.trainCost * dt);
            gainXP(e, KINDS[e.kind].train * (e.boost || 1) * joy(e) * dt);
            if ((e.timer -= dt) <= 0) {
                e.state = 'think';
            }
            break;
        case 'study':
            if (G.room[ti(e)] !== LIB) {
                e.state = 'think';
                break;
            }
            research(dt * KINDS[e.kind].study * (e.boost || 1) * joy(e));
            if ((e.timer -= dt) <= 0) {
                e.state = 'think';
            }
            break;
        case 'fight':
            fight(e, dt);
            break;
        case 'march':
            march(e, dt);
            break;
        case 'leave':
            if (step(e, dt)) {
                e.dead = true;
                toPool(e);
                fx({ type: 'ring', x: e.x, y: e.y, dur: 0.6, col: '#9b6bf0' });
            }
            break;
        default:
            e.state = 'think';
    }
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
    banner(w.lord ? 'The ' + KINDS.lord.n + ' approaches' : 'Heroes approach');
}

export function update(dt) {
    if (G.over) {
        return;
    }
    G.time += dt;
    if (G.wave < WAVES.length) {
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
            if (o.dead || o.side !== 1) {
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
    } else if (G.wave >= WAVES.length && !G.spawnQ.length && !G.ents.some((e) => e.side === 1 && !e.guard)) {
        end(true);
    }
}

function end(win) {
    G.over = win ? 'win' : 'lose';
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
        l.onclick = () => loadGame();
    }
}
