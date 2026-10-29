import config from '../config/index.js';
import { Sound } from './audio.js';
import { fade, music } from './context.js';
import { save, state } from './state.js';
import { drawing, h, hideClips, money, registerScreen, showScreen } from './ui.js';

/*
 * The shop (root frame 8): a chalk board in HTML. The bars (Ramp Height, Acceleration, Air
 * Resistance, Rocket Fuel) have one box per level; gliders and rockets are cards. Hovering (or a
 * first tap) shows the price and what it does, clicking (or a second tap) buys it. As in the game's
 * rules, you can buy a higher level straight away and pay only that level's price. Fuel is for sale
 * once you own a rocket. "Ready?" goes to the ramp menu.
 */

const BARS = [
    { upgrade: 'rampHeight', label: 'Ramp Height', hint: 'Height of the ramp above sea level' },
    { upgrade: 'rampSlide', label: 'Acceleration', hint: 'A cleaner surface provides faster acceleration' },
    { upgrade: 'aerodynamics', label: 'Air Resistance', hint: 'Reduced air resistance means less speed loss' },
    { upgrade: 'fuel', label: 'Rocket Fuel', hint: 'Increase the amount of fuel in your rocket', needsRocket: true },
];
const CARDS = [
    {
        upgrade: 'gliders',
        label: 'Glider',
        items: [
            { name: 'Beat-up glider', drawing: 'glider1', hint: 'Old beat-up glider, can it really fly?' },
            { name: 'Hang glider', drawing: 'glider2', hint: 'Your everyday, typical hang glider' },
            { name: 'Sail plane', drawing: 'glider3', hint: 'High tech sail plane enables incredible glide ratio' },
        ],
    },
    {
        upgrade: 'rockets',
        label: 'Rocket',
        items: [
            { name: 'Penguin rocket', drawing: 'rocket1', hint: 'Rocket propelled penguin. Period.' },
            { name: 'Double rocket', drawing: 'rocket2', hint: 'Twice the power of your regular penguin rocket' },
            { name: 'Mega rocket', drawing: 'rocket3', hint: "Now that's just plain dangerous…" },
        ],
    },
];

const price = (upgrade, level) => config.upgrades[upgrade].prices[level - 2];

/** The shown cash counts towards the real amount. */
const shown = { cash: 0, step: 0 };
/** What is hovered or tapped: {upgrade, level} or null. */
let preview = null;
let leaving = false;
const ui = {};

function build() {
    const cost = h('b', { class: 'cost' }, '$0');
    const cash = h('b', { class: 'cash' }, '$0');
    const hint = h('p', { class: 'hint', 'aria-live': 'polite' });
    const ready = h('button', { type: 'button', class: 'chalk-button ready', onclick: onReady }, 'Ready?');

    const rows = BARS.map((bar) => {
        const boxes = Array.from({ length: 10 }, (_, i) => {
            const level = i + 2;
            const box = h('button', {
                type: 'button',
                class: 'box',
                'aria-label': `${bar.label} level ${level}`,
                onpointerenter: () => setPreview(bar.upgrade, level),
                onfocus: () => setPreview(bar.upgrade, level),
                onpointerleave: () => setPreview(null),
                onclick: (e) => onPick(e, bar.upgrade, level),
            });
            return box;
        });
        const row = h('div', { class: 'bar-row' }, h('span', { class: 'label' }, bar.label), h('div', { class: 'boxes' }, boxes));
        return { bar, row, boxes };
    });

    const cardRows = CARDS.map((group) => {
        const cards = group.items.map((item, i) => {
            const level = i + 2;
            return h('button', {
                type: 'button',
                class: 'card',
                'aria-label': `${item.name}`,
                onpointerenter: () => setPreview(group.upgrade, level),
                onfocus: () => setPreview(group.upgrade, level),
                onpointerleave: () => setPreview(null),
                onclick: (e) => onPick(e, group.upgrade, level),
            }, drawing(item.drawing), h('span', { class: 'card-price' }, money(price(group.upgrade, level))));
        });
        const row = h('div', { class: 'card-row' }, h('span', { class: 'label' }, group.label), h('div', { class: 'cards' }, cards));
        return { group, row, cards };
    });

    const screen = h('section', { class: 'chalkboard shop', 'aria-label': 'Shop' },
        h('header', { class: 'shop-head' },
            h('div', { class: 'funds' },
                h('div', {}, h('span', {}, 'Research Funds'), cash),
                h('div', {}, h('span', {}, 'Cost'), cost)),
            ready),
        h('div', { class: 'shop-body' }, rows.map((r) => r.row), cardRows.map((r) => r.row)),
        hint);
    registerScreen('shop', screen);
    Object.assign(ui, { screen, cost, cash, hint, ready, rows, cardRows });
}

function setPreview(upgrade, level) {
    preview = upgrade && level > state.levels[upgrade] ? { upgrade, level } : null;
    if (upgrade && !preview) {
        // Owned already: show what it is anyway.
        preview = { upgrade, level, owned: true };
    }
    render();
}

function onPick(e, upgrade, level) {
    // On a touch screen the first tap shows the price, the second buys.
    const tapped = e.pointerType === 'touch';
    const same = preview && preview.upgrade === upgrade && preview.level === level;
    if (tapped && !same) {
        setPreview(upgrade, level);
        return;
    }
    buy(upgrade, level);
}

function buy(upgrade, level) {
    if (leaving || level <= state.levels[upgrade]) {
        return;
    }
    if (upgrade === 'fuel' && state.levels.rockets <= 1) {
        return;
    }
    const cost = price(upgrade, level);
    if (cost > state.cash) {
        ui.screen.classList.remove('shake');
        void ui.screen.offsetWidth;
        ui.screen.classList.add('shake');
        return;
    }
    state.levels[upgrade] = level;
    state.cash -= cost;
    shown.step = (shown.cash - state.cash) / 18;
    const s = new Sound();
    s.attachSound('Cash.wav');
    s.start(0, 0);
    preview = { upgrade, level, owned: true };
    render();
}

function onReady() {
    if (leaving) {
        return;
    }
    leaving = true;
    ui.ready.classList.add('pressed');
    fade(true, true, 'stage');
}

function hintFor(p) {
    if (!p) {
        return '';
    }
    const bar = BARS.find((b) => b.upgrade === p.upgrade);
    if (bar) {
        return bar.hint;
    }
    const group = CARDS.find((c) => c.upgrade === p.upgrade);
    return group.items[p.level - 2].hint;
}

function render() {
    const hasRocket = state.levels.rockets > 1;
    for (const { bar, row, boxes } of ui.rows) {
        const locked = Boolean(bar.needsRocket) && !hasRocket;
        row.classList.toggle('locked', locked);
        boxes.forEach((box, i) => {
            const level = i + 2;
            box.disabled = locked;
            box.classList.toggle('owned', state.levels[bar.upgrade] >= level);
            box.classList.toggle('affordable', state.levels[bar.upgrade] < level && price(bar.upgrade, level) <= state.cash);
            box.classList.toggle('preview', !!preview && !preview.owned && preview.upgrade === bar.upgrade && level <= preview.level && level > state.levels[bar.upgrade]);
        });
    }
    for (const { group, cards } of ui.cardRows) {
        cards.forEach((card, i) => {
            const level = i + 2;
            card.classList.toggle('owned', state.levels[group.upgrade] >= level);
            card.classList.toggle('affordable', state.levels[group.upgrade] < level && price(group.upgrade, level) <= state.cash);
            card.classList.toggle('preview', !!preview && preview.upgrade === group.upgrade && preview.level === level);
        });
    }
    ui.cost.textContent = preview && !preview.owned ? money(price(preview.upgrade, preview.level)) : '$0';
    ui.hint.textContent = hintFor(preview);
    ui.cash.textContent = money(shown.cash);
}

function openShop(root) {
    save();
    root.stop();
    music.attach('shop.wav');
    if (!ui.screen) {
        build();
    }
    hideClips(root.children.find((c) => c.id === 422));
    leaving = false;
    ui.ready.classList.remove('pressed');
    preview = null;
    shown.cash = state.cash;
    shown.step = 0;
    render();
    showScreen('shop');
    // The cash counter counts down after a purchase, at the game's frame rate.
    root.onEnterFrame = () => {
        if (shown.cash !== state.cash) {
            shown.cash -= shown.step;
            if (shown.cash < state.cash || !shown.step) {
                shown.cash = state.cash;
            }
            ui.cash.textContent = money(shown.cash);
        }
    };
}

export default {
    frames: {
        root: { 8: openShop },
    },
};
