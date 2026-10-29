/**
 * The page around the map: the HUD, the panel (tools, tabs, portal list, Creatures tab), hover info,
 * the Chronicle, banners, the drag tip and the header buttons. The Cheats panel is cheats.js, the minimap minimap.js.
 */
import { GEM, GOLD, HERO, LAIR, NEUTRAL, OWN, PORTAL, PRISONER, STATE_EN, TILE_EN, inb, ix, words } from './constants.js';
import { ASSETS, ATTRACT, CFG, ECON, KINDS, PORTAL_LIMIT, ROOMS, SPELLS, WAVES, isWorker, wage } from './config.js';
import { activity, affects, pickUp, spellCost } from './actions.js';
import { isMuted, setMuted } from './audio.js';
import { initCheats } from './cheats.js';
import { creatures, need, research } from './entities.js';
import { newGame } from './map.js';
import { loadGame, saveGame } from './save.js';
import { G, app } from './state.js';
import { anyPortal, cap } from './tiles.js';
import { view } from '../render/view.js';

const $ = (id) => document.getElementById(id);

/** Adds a line to the Chronicle. The same `key` is muted for 20 s of game time. */
export function msg(text, key, cls = '') {
    if (key) {
        const c = G.msgCd[key];
        if (c !== undefined && G.time - c < 20) {
            return;
        }
        G.msgCd[key] = G.time;
    }
    const ul = $('log');
    const li = document.createElement('li');
    li.textContent = text;
    if (cls) {
        li.className = cls;
    }
    ul.prepend(li);
    while (ul.children.length > 7) {
        ul.lastChild.remove();
    }
}

export function clearLog() {
    $('log').innerHTML = '';
}

export function banner(text) {
    const b = $('banner');
    b.textContent = text;
    b.classList.add('show');
    setTimeout(() => b.classList.remove('show'), 2600);
}

/* ---------- tools ---------- */
const btns = {};

export function buildTools() {
    const defs = {
        hand: { el: 'tHand', n: 'Hand', sub: 'dig · pick up' },
        slap: { el: 'tHand', n: 'Slap', sub: 'or right-click' },
        look: { el: 'tHand', n: 'Look', sub: 'drag to scroll' },
    };
    for (const [k, r] of Object.entries(ROOMS)) {
        defs[k] = { el: 'tRooms', n: r.n, sub: r.cost + ' gold per tile', col: r.col };
    }
    defs.sell = { el: 'tRooms', n: 'Sell', sub: 'half price back' };
    for (const [k, s] of Object.entries(SPELLS)) {
        defs[k] = { el: 'tSpells', n: s.n, sub: '' };
    }
    for (const el of ['tHand', 'tRooms', 'tSpells']) {
        $(el).innerHTML = '';
    }
    for (const k in btns) {
        delete btns[k];
    }
    for (const [k, d] of Object.entries(defs)) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tool';
        b.id = 'tool-' + k;
        b.innerHTML = '<b>' + (d.col ? '<i class="sw" style="background:' + d.col + '"></i>' : '') + d.n + '</b><span>' + d.sub + '</span>';
        b.onclick = () => setTool(k);
        $(d.el).appendChild(b);
        btns[k] = b;
    }
    setTool(btns[app.tool] ? app.tool : 'hand');
}

export function setTool(k) {
    app.tool = k;
    for (const [n, b] of Object.entries(btns)) {
        b.classList.toggle('on', n === k);
    }
    $('cv').classList.toggle('grab', k === 'look');
}

/* ---------- HUD and panel, every 0.2 s ---------- */
const fmtT = (s) => {
    s = Math.max(0, Math.ceil(s));

    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};
const CR_ORDER = () => ['imp', ...Object.keys(ATTRACT)];

function hoverInfo() {
    const { hover, tool } = app;
    if (hover.in && inb(hover.x, hover.y)) {
        const i = ix(hover.x, hover.y);
        const e = hover.unit && !hover.unit.dead && !hover.unit.held ? hover.unit : null;
        if (!G.seen[i] && !e) {
            return '<b>Unexplored</b>' + (G.t[i] === GOLD ? ' · gold glints through' : G.t[i] === GEM ? ' · gems glint through' : '') + (G.mark[i] ? '<br>Marked for digging' : '') + '<br>You can mark it for digging. Your imps will find out what is there.';
        }
        if (e) {
            const k = KINDS[e.kind];
            let h = '<b>' + (e.side === NEUTRAL ? 'Unknown creature' : k.n) + '</b>' + (e.side === HERO ? ' · hero' : e.side === PRISONER ? ' · prisoner' : '') + ' · level ' + e.lvl + '<br>' + Math.ceil(e.hp) + ' / ' + Math.ceil(e.maxhp) + ' health · ' + STATE_EN[e.state];
            if (e.side === OWN && !isWorker(e)) {
                h += '<br>Wage ' + wage(e.kind) + (KINDS[e.kind].eats ? '' : ' · never eats') + (KINDS[e.kind].eats ? ' · hunger ' + Math.floor(Math.min(100, e.hunger)) + '%' : '');
            }
            if (e.carry) {
                h += '<br>Carrying ' + e.carry + ' gold';
            }

            return h;
        }
        const t = G.t[i];
        let h = '<b>' + (t === PORTAL ? (G.pown[i] ? 'Portal (yours)' : 'Portal (not yet claimed)') : TILE_EN[t]) + '</b>';
        if (t === PORTAL) {
            h += G.pown[i] ? '<br>Drop a creature here to dismiss it.' : '<br>Claim the ground next to it, then your imps claim the portal.';
        }
        if (t === GOLD) {
            h += ' · ' + G.gold[i] + ' gold';
        }
        if (G.mark[i]) {
            h += '<br>Marked for digging';
        }
        if (G.loot[i]) {
            h += '<br>Treasure chest: ' + G.loot[i] + ' gold';
        }
        if (G.room[i]) {
            h += '<br>' + ROOMS[G.room[i]].n + ': ' + ROOMS[G.room[i]].tip.toLowerCase();
        }

        return h;
    }
    if (ROOMS[tool]) {
        return '<b>' + ROOMS[tool].n + '</b><br>' + ROOMS[tool].tip + '. Click a tile or drag a box over your territory. Right-click: done.';
    }
    if (tool === 'hand') {
        return G.held.length ? '<b>In hand: ' + G.held.length + '</b><br>Right-click your territory to drop one (on your portal: dismiss it).' : '<b>Hand</b><br>Click a block, or drag a box over blocks, to dig them. Click a creature to pick it up, right-click to slap it.';
    }
    if (SPELLS[tool]) {
        return '<b>' + SPELLS[tool].n + '</b><br>' + ({ imp: 'Click your territory to summon a new imp.', bolt: 'Strikes heroes around the clicked spot.', heal: 'Heals your creatures around the clicked spot.', rally: 'All creatures gather at this spot for ' + SPELLS.rally.duration + ' seconds. Free on your own territory.' })[tool];
    }
    if (tool === 'sell') {
        return '<b>Sell</b><br>Click or drag a box over rooms to tear them down. Right-click: done.';
    }
    if (tool === 'look') {
        return '<b>Look</b><br>Drag to scroll (or arrows, or the pointer at the edge). Q / E turn, scroll zooms.';
    }

    return '<b>Slap</b><br>A slapped imp works faster for ' + CFG.hand.slapTime + ' seconds.';
}

export function ui() {
    $('sGold').textContent = Math.floor(G.money) + ' / ' + cap();
    $('sImps').textContent = G.ents.filter((e) => e.kind === 'imp' && e.side === OWN).length;
    $('sCre').textContent = creatures().length + ' / ' + G.rc[LAIR];
    $('sRes').textContent = Math.floor(G.research);
    const due = creatures().filter((e) => !e.leaving).reduce((a, e) => a + wage(e.kind), 0);
    $('sPay').textContent = fmtT(G.payT) + (due ? ' · ' + due + 'g' : '');
    $('sPay').style.color = due > G.money ? '#f08a7e' : '';
    $('sWave').textContent = G.wave >= WAVES.length ? 'final wave' : 'wave ' + (G.wave + 1) + ' in ' + fmtT(G.nextWave) + (app.wavesHeld ? ' (paused)' : '');
    $('sHeart').style.width = (100 * G.heartHP / G.heartMax) + '%';
    for (const [k, s] of Object.entries(SPELLS)) {
        const b = btns[k];
        const locked = G.research < s.req;
        b.disabled = locked;
        b.querySelector('span').textContent = locked ? 'research ' + s.req : k === 'rally' ? 'free on your land, else ' + s.cost : spellCost(k) + ' gold';
    }
    const h = hoverInfo();
    const info = $('info');
    if (info.innerHTML !== h) {
        info.innerHTML = h;
    }
    const n = creatures().length;
    let ph = '';
    if (!anyPortal()) {
        ph = '<li><span class="need">Claim a portal to attract creatures. No portal, no creatures.</span></li>';
    }
    for (const [k, a] of Object.entries(ATTRACT)) {
        const ok = a.ok();
        ph += '<li class="' + (ok ? 'ok' : '') + '"><i class="dot" style="background:' + KINDS[k].col + '"></i><b>' + KINDS[k].n + '</b><span class="n">' + G.pool[k] + ' left</span><span class="need">' + (ok ? '✓ ' : 'Needs ') + a.need + '</span></li>';
    }
    ph += '<li><span class="need">Creatures: ' + n + ' / ' + PORTAL_LIMIT + ' · free beds: ' + Math.max(0, G.rc[LAIR] - n) + (anyPortal() ? ' · next arrival in ' + fmtT(G.portalT) : '') + '</span></li>';
    const pl = $('pool');
    if (pl.innerHTML !== ph) {
        pl.innerHTML = ph;
    }
    // Info tab gauges, as in Dungeon Keeper's information panel
    $('gPay').style.width = (100 * (1 - G.payT / ECON.payInterval)) + '%';
    $('gPayTxt').textContent = fmtT(G.payT) + ' · wages ' + due;
    $('gPayTxt').classList.toggle('bad', due > G.money);
    const nextSp = Object.values(SPELLS).filter((s) => s.req > G.research).sort((a, b) => a.req - b.req)[0];
    $('gRes').style.width = (nextSp ? 100 * G.research / nextSp.req : 100) + '%';
    $('gResTxt').textContent = nextSp ? Math.floor(G.research) + ' / ' + nextSp.req + ' → ' + nextSp.n : 'all spells researched';
    if (app.tab === 'creatures') {
        creaturesTab();
    }
    const hd = $('held');
    const hh = G.held.length
        ? '<span>In hand ' + G.held.length + '/' + CFG.hand.capacity + ' · next drop:</span>' + G.held.slice().reverse().map((e, n) => '<button type="button" data-id="' + e.id + '" class="' + (n ? '' : 'top') + '" title="Drop this one next"><i class="dot" style="background:' + KINDS[e.kind].col + '"></i>' + KINDS[e.kind].n + (e.lvl > 1 ? ' ' + e.lvl : '') + '</button>').join('')
        : '';
    hd.hidden = !G.held.length;
    if (hd.innerHTML !== hh) {
        hd.innerHTML = hh;
    }
}

function creaturesTab() {
    let gh = '<span></span><span class="h">Idle</span><span class="h">Working</span><span class="h">Fighting</span>';
    const mine = G.ents.filter((e) => !e.dead && e.side === OWN);
    for (const k of CR_ORDER()) {
        const of = mine.filter((e) => e.kind === k && !e.held);
        const held = G.held.filter((e) => e.kind === k).length;
        if (!of.length && !held) {
            continue;
        }
        const src = ASSETS.icons[k];
        const cnt = (a) => of.filter((e) => activity(e) === a).length;
        gh += '<button type="button" class="who" data-k="' + k + '" title="Pick up the most experienced ' + KINDS[k].n + '">' + (src ? '<img src="' + src + '" alt="">' : '<i style="background:' + KINDS[k].col + '"></i>') + '<span>' + KINDS[k].n + (held ? ' <small>(' + held + ' in hand)</small>' : '') + '</span></button>';
        for (const a of ['idle', 'working', 'fighting']) {
            const c = cnt(a);
            gh += '<button type="button" class="num' + (a === 'fighting' && c ? ' f' : '') + '" data-k="' + k + '" data-a="' + a + '" aria-label="' + c + ' ' + a + ' ' + KINDS[k].n + (c ? ': pick one up' : '') + '"' + (c ? '' : ' disabled') + '>' + c + '</button>';
        }
    }
    if (gh.split('class="who"').length === 1) {
        gh += '<span class="h" style="grid-column:1/-1;text-align:left">No creatures yet.</span>';
    }
    const g = $('crGrid');
    if (g.innerHTML !== gh) {
        g.innerHTML = gh;
    }
    const list = mine.concat().filter((e) => !isWorker(e)).sort((a, b) => CR_ORDER().indexOf(a.kind) - CR_ORDER().indexOf(b.kind) || b.lvl - a.lvl);
    const lh = list.map((e) => '<li><button type="button" data-id="' + e.id + '" title="Look at this creature"><span class="nm">' + KINDS[e.kind].n + ' <small>' + (e.held ? 'in your hand' : STATE_EN[e.state === 'walk' ? e.next || 'walk' : e.state] || e.state) + '</small></span><span class="lv">' + e.lvl + '</span><span class="hp"><i style="width:' + Math.round(100 * Math.max(0, e.hp / e.maxhp)) + '%;background:' + (e.hp < e.maxhp * 0.35 ? '#e0483c' : '#5fcf6a') + '"></i></span></button></li>').join('');
    const l = $('crList');
    if (l.innerHTML !== lh) {
        l.innerHTML = lh;
    }
}

export function syncCpu() {
    const c = G.cpu;
    const b = $('bCpu');
    b.setAttribute('aria-pressed', String(c.on));
    b.title = 'Computer Assistant: ' + (c.on ? 'on (' + c.mode + ')' : 'off');
    $('cpuModes').hidden = !c.on;
    for (const m of document.querySelectorAll('#cpuSeg button')) {
        m.setAttribute('aria-pressed', String(m.dataset.mode === c.mode));
    }
}

export function showTab(t) {
    app.tab = t;
    for (const b of document.querySelectorAll('#tabs button')) {
        b.setAttribute('aria-selected', String(b.dataset.tab === t));
    }
    for (const s of document.querySelectorAll('.tab')) {
        s.hidden = s.id !== 'tab-' + t;
    }
    try {
        localStorage.setItem('underlord-tab', t);
    } catch {
        // private mode: the tab is not remembered
    }
    if (G) {
        ui();
    }
}

function crPick(kind, act, look) {
    const list = G.ents.filter((e) => !e.dead && !e.held && e.side === OWN && e.kind === kind && (!act || activity(e) === act)).sort((a, b) => b.lvl - a.lvl || a.id - b.id);
    if (!list.length) {
        return;
    }
    const key = kind + act;
    G.crCycle = G.crCycle || {};
    const k = act ? (G.crCycle[key] = ((G.crCycle[key] ?? -1) + 1) % list.length) : 0;
    const e = list[k];
    if (look) {
        view.centerOn(e.x - 0.5, e.y - 0.5);
    } else if (pickUp(e)) {
        msg('You picked up your ' + KINDS[kind].n + '.', 'pick' + e.id);
    }
    ui();
}

/** Sound on or off (the header button and V). */
export function toggleSound() {
    setMuted(!isMuted());
    syncSound();
}

export function syncSound() {
    const b = $('bSound');
    b.textContent = isMuted() ? 'Muted' : 'Sound';
    b.setAttribute('aria-pressed', String(!isMuted()));
}

export function syncPause() {
    $('bPause').textContent = app.paused ? 'Resume' : 'Pause';
}

export function setSpeed(n) {
    app.speed = n;
    const b = $('bSpeed');
    b.textContent = n + '×';
    b.setAttribute('aria-label', 'Game speed: ' + n + '×');
}

/** The rectangle being dragged (corners sorted), or null. */
export function dragRect() {
    const d = app.drag;
    if (!d) {
        return null;
    }

    return { x0: Math.min(d.x0, d.x1), y0: Math.min(d.y0, d.y1), x1: Math.max(d.x0, d.x1), y1: Math.max(d.y0, d.y1) };
}

/** The tip next to the pointer while dragging: "Dig 6 blocks", "Lair × 9 · 900 gold". */
export function updateTip() {
    const tip = $('tip');
    const R = dragRect();
    const { drag, hover } = app;
    if (!R || (R.x0 === R.x1 && R.y0 === R.y1)) {
        tip.hidden = true;

        return;
    }
    let n = 0;
    for (let y = R.y0; y <= R.y1; y++) {
        for (let x = R.x0; x <= R.x1; x++) {
            if (affects(drag.mode, ix(x, y))) {
                n++;
            }
        }
    }
    tip.textContent = drag.mode === 'mark' ? 'Dig ' + n + ' block' + (n === 1 ? '' : 's') : drag.mode === 'unmark' ? 'Cancel ' + n + ' block' + (n === 1 ? '' : 's') : drag.mode === 'sell' ? 'Sell ' + n + ' tile' + (n === 1 ? '' : 's') : ROOMS[drag.mode].n + ' × ' + n + ' · ' + n * ROOMS[drag.mode].cost + ' gold';
    tip.hidden = false;
    const stage = $('stage').getBoundingClientRect();
    tip.style.left = Math.min(hover.sx + 14, stage.width - 170) + 'px';
    tip.style.top = (hover.sy + 16) + 'px';
}

/** Wires the header buttons, tabs, Creatures tab, hand list and cheats. Runs once at start. */
export function initUi() {
    initCheats();
    $('tabs').onclick = (ev) => {
        const b = ev.target.closest('button[data-tab]');
        if (b) {
            showTab(b.dataset.tab);
        }
    };
    $('bCpu').onclick = () => {
        G.cpu.on = !G.cpu.on;
        G.cpu.t = 0;
        syncCpu();
        msg('Computer Assistant ' + (G.cpu.on ? 'on (' + G.cpu.mode + ')' : 'off') + '.', 'cpu' + G.time);
    };
    $('cpuSeg').onclick = (ev) => {
        const b = ev.target.closest('button[data-mode]');
        if (!b) {
            return;
        }
        G.cpu.mode = b.dataset.mode;
        syncCpu();
    };
    const crg = $('crGrid');
    crg.onclick = (ev) => {
        const b = ev.target.closest('button[data-k]');
        if (!b || !app.running) {
            return;
        }
        crPick(b.dataset.k, b.dataset.a || '', false);
    };
    crg.oncontextmenu = (ev) => {
        const b = ev.target.closest('button[data-k]');
        if (!b) {
            return;
        }
        ev.preventDefault();
        crPick(b.dataset.k, b.dataset.a || '', true);
    };
    $('crList').onclick = (ev) => {
        const b = ev.target.closest('button[data-id]');
        if (!b) {
            return;
        }
        const e = G.ents.find((o) => o.id === +b.dataset.id);
        if (e && !e.held) {
            view.centerOn(e.x - 0.5, e.y - 0.5);
        }
    };
    $('held').onclick = (ev) => {
        const b = ev.target.closest('button[data-id]');
        if (!b) {
            return;
        }
        const k = G.held.findIndex((e) => e.id === +b.dataset.id);
        if (k >= 0) {
            G.held.push(G.held.splice(k, 1)[0]);
            ui();
        }
    };
    $('bSave').onclick = () => {
        if (app.running) {
            saveGame(false);
        }
    };
    $('bLoad').onclick = () => loadGame();
    $('bPause').onclick = () => {
        app.paused = !app.paused;
        syncPause();
    };
    $('bSpeed').onclick = () => setSpeed(app.speed === 1 ? 2 : app.speed === 2 ? 3 : 1);
    $('bSound').onclick = () => toggleSound();
    syncSound();
    $('bStart').onclick = () => {
        newGame();
        $('ov').hidden = true;
        app.running = true;
    };
    $('bContinue').onclick = () => loadGame();
    const w = $('waveCount');
    if (w) {
        w.textContent = words(WAVES.length);
    }
    try {
        const t = localStorage.getItem('underlord-tab');
        if (t) {
            app.tab = t;
        }
    } catch {
        // private mode
    }
    buildTools();
}
