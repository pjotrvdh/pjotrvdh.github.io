import config from '../config/index.js';
import { fade, g, music } from './context.js';
import { achievementCount, KINDS, state } from './state.js';
import { drawing, h, hideClips, money, registerScreen, showScreen, STATE_EVENT } from './ui.js';

/*
 * The ramp menu (root frame 9, the "stage" label): the five ramps, your glider and rocket and the
 * picked ramp's four achievements in a chalk column in the bottom left corner, over the ramp's picture on the canvas (stagemc, sprite 457, one frame per ramp, with drifting clouds). A ramp opens after a number of achievements over all ramps
 * (config/ramps.js). "Fly!" starts the day on the picked ramp.
 */

const TEXT = {
    distance: (n) => `Travel ${n} feet`,
    altitude: (n) => `Fly up to ${n} feet`,
    speed: (n) => `Reach ${n} mph`,
    duration: (n) => `Glide for ${n} seconds`,
};
const HEIGHTS = ['5', '10', '20', '35', '50'];
/**
 * Where the penguin stands on each ramp's picture (picture coordinates, beak and feet included): the
 * import tool leaves the drawn penguin out, and the real one (sprite 95) is put in this box, so it
 * shows the glider, rocket and pirate hat you have.
 */
const PENGUIN_BOXES = [
    [341, 166, 377, 212],
    [300, 99, 336, 146],
    [268, 40, 293, 74],
    [259, 25, 278, 48],
    [257, 1, 270, 18],
];
/** Sprite 95's own box for the same parts (body from its left edge to the beak tip, top to feet). */
const PENGUIN_BODY = [-36.3, -43.9, 26.8, 34.2];
const PENGUIN = 95;

const ui = {};
let picked = 1;
let leaving = false;

function build() {
    // A radio group: ← → pick a ramp, Space goes on to Fly! (see onKey()).
    const buttons = config.ramps.map((ramp, i) => h('button', {
        type: 'button',
        class: 'ramp-button',
        role: 'radio',
        'aria-label': ramp.name,
        onclick: () => pick(i + 1),
        onpointerenter: (e) => e.pointerType === 'mouse' && pick(i + 1),
    }, h('span', { class: 'ft' }, HEIGHTS[i], h('small', {}, 'ft')), h('span', { class: 'lock' }, drawing('lock'))));
    const title = h('h2', {});
    const note = h('p', { class: 'note', 'aria-live': 'polite' });
    const goal = h('p', { class: 'final-goal' });
    const count = h('span', { class: 'count' });
    const gear = h('p', { class: 'gear' });
    const list = h('ul', { class: 'achievements' });
    const fly = h('button', { type: 'button', class: 'chalk-button fly', onclick: onFly }, 'Fly!');
    // One column in the bottom left corner, so the picture (and the penguin at its top) stays clear.
    // Select Stage and Fly! are at the bottom, so they stay put while the panel above changes height.
    const screen = h('section', { class: 'ramp-menu', 'aria-label': 'Pick a ramp' },
        h('div', { class: 'ramp-column' },
            h('div', { class: 'ramp-info chalk-panel' },
                title,
                note,
                goal,
                gear,
                h('h3', {}, 'Achievements ', count),
                list),
            h('nav', { class: 'ramp-bar chalk-panel' },
                h('span', { class: 'bar-title' }, 'Select Stage'),
                h('div', { class: 'ramp-buttons', role: 'radiogroup', 'aria-label': 'Ramp' }, buttons),
                fly)));
    registerScreen('ramps', screen);
    window.addEventListener(STATE_EVENT, () => {
        if (!screen.hidden) {
            render();
        }
    });
    Object.assign(ui, { screen, buttons, title, note, goal, gear, count, list, fly });
    window.addEventListener('keydown', onKey);
}

/**
 * Keys in the ramp menu: ← and → pick the previous or next ramp (focusing it), Space on a ramp (or
 * anywhere but Fly!) goes on to Fly!, and Space on Fly! starts the flight. (Space is handled here
 * because input.js blocks its default action, which would otherwise click the focused button.)
 */
function onKey(e) {
    if (ui.screen.hidden || leaving || e.ctrlKey || e.metaKey || e.altKey) {
        return;
    }
    if (e.target instanceof HTMLElement && e.target.closest('.controls')) {
        return;
    }
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
        const n = Math.min(config.ramps.length, Math.max(1, picked + (e.code === 'ArrowLeft' ? -1 : 1)));
        pick(n);
        ui.buttons[n - 1].focus();
    } else if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        if (document.activeElement === ui.fly) {
            onFly();
        } else {
            ui.fly.focus();
        }
    }
}

function unlocked(n) {
    return achievementCount() >= config.ramps[n - 1].unlock;
}

function pick(n) {
    if (leaving) {
        return;
    }
    picked = n;
    g.root.get('stagemc')?.gotoAndStop(n);
    placePenguin();
    render();
}

/** The real penguin on the picked ramp's picture, scaled into its box (feet on the snow). */
function placePenguin() {
    const pic = g.root.get('stagemc');
    const penguin = pic?.get('rampPenguin');
    if (!penguin) {
        return;
    }
    const [x0, y0, , y1] = PENGUIN_BOXES[picked - 1];
    const s = (y1 - y0) / (PENGUIN_BODY[3] - PENGUIN_BODY[1]);
    penguin.m = [s, 0, 0, s, x0 - PENGUIN_BODY[0] * s, y1 - PENGUIN_BODY[3] * s];
}

/** A new penguin each time the menu opens, so it wears what you bought (and the pirate hat). */
function addPenguin() {
    const pic = g.root.get('stagemc');
    if (!pic) {
        return;
    }
    pic.get('rampPenguin')?.removeMovieClip();
    const penguin = g.player.create(PENGUIN);
    penguin.name = 'rampPenguin';
    pic.addChild(penguin, 1000);
    g.player.initChild(penguin, null, null);
}

/** Your glider and rocket as chalk drawings with their names. */
function renderGear() {
    const item = (upgrade, drawingName) => {
        const level = state.levels[upgrade];
        return level > 1 ? h('span', { class: 'gear-item' }, drawing(`${drawingName}${level - 1}`), config.upgrades[upgrade].names[level - 2]) : null;
    };
    const items = [item('gliders', 'glider'), item('rockets', 'rocket')].filter(Boolean);
    ui.gear.replaceChildren(...(items.length ? items : [h('span', { class: 'gear-none' }, 'No glider or rocket yet')]));
}

function render() {
    const total = achievementCount();
    ui.buttons.forEach((b, i) => {
        b.classList.toggle('picked', i + 1 === picked);
        b.classList.toggle('locked', !unlocked(i + 1));
        b.setAttribute('aria-checked', String(i + 1 === picked));
        // Only the picked ramp is a tab stop (the arrows move within the group).
        b.tabIndex = i + 1 === picked ? 0 : -1;
    });
    const ramp = config.ramps[picked - 1];
    const open = unlocked(picked);
    ui.title.textContent = ramp.name;
    ui.note.textContent = open ? '' : `Complete ${ramp.unlock - total} more achievements to unlock`;
    ui.goal.textContent = picked === config.ramps.length ? (state.gameFinished ? 'Game completed!' : `Reach ${config.game.finishDistance} feet to break through the iceberg`) : '';
    ui.fly.disabled = !open;
    renderGear();
    const done = state.achievements[picked - 1];
    ui.count.textContent = `${KINDS.filter((k) => done[k]).length} / 4`;
    ui.list.replaceChildren(...KINDS.map((kind) => h('li', { class: done[kind] ? 'done' : '' },
        drawing(kind),
        h('span', { class: 'goal' }, TEXT[kind](ramp[kind][0])),
        h('span', { class: 'reward' }, money(ramp[kind][1])),
        h('span', { class: 'tick' }, done[kind] ? drawing('check', 'Done') : null))));
}

function onFly() {
    if (leaving || !unlocked(picked)) {
        return;
    }
    leaving = true;
    state.ramp = picked;
    music.stop();
    fade(true, true, 'dayintro');
}

function rampMenu(root) {
    root.stop();
    if (!ui.screen) {
        build();
    }
    // The canvas keeps the ramp's picture; the rest of the frame is replaced by the HTML panel.
    hideClips(...root.children.filter((c) => c.placedAt === 9 && c.name !== 'stagemc'));
    leaving = false;
    picked = Math.min(state.ramp || 1, config.ramps.length);
    if (!unlocked(picked)) {
        picked = 1;
    }
    addPenguin();
    pick(picked);
    showScreen('ramps');
    // The keyboard starts on the picked ramp.
    ui.buttons[picked - 1].focus({ preventScroll: true });
}

/** The picture of each ramp (sprite 457, one frame per ramp) has drifting clouds. */
function clouds(base) {
    return (c) => {
        // The ramp's name and the goal note are in the HTML panel.
        for (const t of c.children) {
            if (t.char?.t === 'text' || t.name === 'acend') {
                t.visible = false;
            }
        }
        const reset = (cloud, x) => {
            const s = base + Math.random() * 40;
            cloud.xscale = s;
            cloud.yscale = s;
            cloud.y = Math.random() * 250;
            cloud.x = x(cloud);
            cloud.vars.speed = 0.4 + Math.random() * 1.4;
        };
        for (let i = 1; i <= 6; i++) {
            const cloud = c.get(`cloud${i}`);
            if (cloud) {
                reset(cloud, () => Math.random() * 1000);
            }
        }
        c.onEnterFrame = () => {
            for (let i = 1; i <= 6; i++) {
                const cloud = c.get(`cloud${i}`);
                if (!cloud) {
                    continue;
                }
                if (cloud.x + cloud.width < 0) {
                    reset(cloud, (cl) => 800 + cl.width + Math.random() * 100);
                }
                cloud.x -= cloud.vars.speed;
            }
        };
    };
}

export default {
    frames: {
        root: { 9: rampMenu },
        456: {
            1: (c) => c.c('acend').gotoAndStop(1),
            2: (c) => c.c('acend').gotoAndStop(2),
        },
        457: {
            1: clouds(70),
            2: clouds(70),
            3: clouds(60),
            4: clouds(50),
            5: (c) => {
                c.c('acend').gotoAndStop(state.gameFinished ? 2 : 1);
                clouds(40)(c);
            },
        },
    },
};
