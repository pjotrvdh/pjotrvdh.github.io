import config from '../config/index.js';
import { Sound } from './audio.js';
import { fade, pending } from './context.js';
import { KINDS, state } from './state.js';
import { drawing, h, hideClips, money, registerScreen, showScreen } from './ui.js';

/*
 * The achievements screen (root frame 12) after a flight that won any: one chalk card per
 * achievement; a click (or a key) pays the reward and the research funds count up. Then the shop.
 */

const TITLES = {
    distance: (n) => `Travel ${n} feet`,
    altitude: (n) => `Fly up to ${n} feet`,
    speed: (n) => `Reach ${n} mph`,
    duration: (n) => `Glide for ${n} seconds`,
};

const ui = {};
let current = null;
let shownCash = 0;
let busy = false;

function build() {
    const icon = h('div', { class: 'ach-icon' });
    const goal = h('p', { class: 'goal' });
    const reward = h('b', { class: 'reward' });
    const funds = h('b', {});
    const card = h('div', { class: 'chalkboard ach-card' },
        h('h2', {}, 'Achievement completed!'),
        icon,
        goal,
        h('p', { class: 'reward-line' }, 'Reward: ', reward),
        h('p', { class: 'continue' }, '(Click or press any key to continue)'));
    const screen = h('section', { class: 'achievements-screen', 'aria-live': 'polite', onclick: collect },
        h('div', { class: 'chalk-panel funds-panel' }, h('span', {}, 'Research Funds'), funds),
        card);
    registerScreen('achievements', screen);
    Object.assign(ui, { screen, card, icon, goal, reward, funds });
    window.addEventListener('keydown', (e) => {
        if (!ui.screen.hidden && !e.repeat && !['KeyM', 'KeyP', 'KeyF', 'Escape'].includes(e.code)) {
            collect();
        }
    });
}

function showNext() {
    const kind = KINDS.find((k) => pending[k]);
    if (!kind) {
        current = null;
        ui.card.hidden = true;
        setTimeout(() => fade(true, true, 'shop'), 600);
        return;
    }
    const ramp = config.ramps[state.ramp - 1];
    current = { kind, reward: ramp[kind][1] };
    ui.icon.replaceChildren(drawing(kind));
    ui.goal.textContent = TITLES[kind](ramp[kind][0]);
    ui.reward.textContent = money(current.reward);
    ui.card.hidden = false;
    ui.card.classList.remove('pop');
    void ui.card.offsetWidth;
    ui.card.classList.add('pop');
    busy = false;
}

function collect() {
    if (!current || busy) {
        return;
    }
    busy = true;
    pending[current.kind] = false;
    state.cash += current.reward;
    const s = new Sound();
    s.attachSound('Cash.wav');
    s.start(0, 0);
    ui.card.hidden = true;
    current = null;
    setTimeout(showNext, 900);
}

function achievementsScreen(root) {
    root.stop();
    if (!ui.screen) {
        build();
    }
    hideClips(...['achcash1', 'achdis1', 'achalt1', 'achspe1', 'achdur1'].map((n) => root.get(n)));
    // The funds count up as the rewards come in.
    shownCash = state.cash;
    ui.funds.textContent = money(shownCash);
    ui.card.hidden = true;
    showScreen('achievements');
    root.onEnterFrame = () => {
        if (shownCash < state.cash) {
            shownCash = Math.min(state.cash, shownCash + Math.max(1, (state.cash - shownCash) / 10));
            ui.funds.textContent = money(shownCash);
        }
    };
    setTimeout(showNext, 700);
}

export default {
    frames: {
        root: { 12: achievementsScreen },
        // The canvas's own boards and counter stay hidden and still.
        ...Object.fromEntries([650, 664, 668, 672, 676].map((id) => [id, { 1: (c) => c.stop(), 13: (c) => c.stop(), 15: (c) => c.stop(), 30: (c) => c.stop() }])),
        ...Object.fromEntries([662, 667, 671, 675].map((id) => [id, { 1: (c) => c.stop(), 10: (c) => c.stop(), 30: (c) => c.stop() }])),
    },
};
