import { audio, fade, g } from './context.js';
import { options, state } from './state.js';
import { drawing, h, hideClips, hideScreens, registerScreen, showScreen } from './ui.js';

/*
 * The start of a day (root frame 10, "dayintro"): "Day n" over drifting clouds (sprite 505), then
 * the penguin waddles to the ramp. Before that the tutorial boards show, once each: how to play, the
 * first glider and the first rocket (HTML chalk boards; the canvas's own boards, sprite 516, stay
 * hidden). The animation waits while a board is up (root var infoboardisdown); a click or a key
 * lifts it. With the day intro switched off in the settings and no board to show, the flight starts
 * straight away.
 */

const SPEEDS = [1, 0.8, 0.5, 1.2, 1, 0.95];

const BOARDS = [
    () => [
        h('h2', {}, 'Learn to fly'),
        h('div', { class: 'tip' }, drawing('ramp'), h('p', {}, 'Wait until you reach the jump')),
        h('div', { class: 'tip' }, h('div', { class: 'pair' }, drawing('arrows'), drawing('tilt')), h('p', {}, 'Use ← → to adjust your angle')),
        h('div', { class: 'tip' }, drawing('bounce'), h('p', {}, 'Hit the water with your belly fast enough to bounce back up!')),
    ],
    () => [
        h('h2', {}, 'You got a ', h('em', {}, 'glider')),
        h('div', { class: 'tip' }, drawing('glider2'), h('p', {}, 'Gliding allows you to make longer and more controlled flights')),
        h('div', { class: 'tip' }, drawing('redzone'), h('p', {}, 'Each glider has a “red zone”: a speed above which your speed drops fast. Avoid gliding in the red zone for long to get the extra distance you need!')),
    ],
    () => [
        h('h2', {}, h('em', {}, 'Rocket')),
        h('div', { class: 'tip' }, drawing('space'), h('p', {}, 'Press Space to use your rocket for an extra boost')),
        h('div', { class: 'tip pair-row' },
            h('figure', {}, drawing('rocket1'), h('figcaption', {}, 'Before Space')),
            h('figure', {}, drawing('wow'), h('figcaption', {}, 'After Space'))),
        h('p', { class: 'strong' }, 'Remember to upgrade your rocket fuel capacity for maximum results'),
    ],
];

const ui = {};
let queue = [];
let shownAt = 0;

function build() {
    const content = h('div', { class: 'board-content' });
    const screen = h('section', {
        class: 'tutorial',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': 'How to play',
        onclick: () => lift(),
    }, h('div', { class: 'chalkboard board-card' }, content, h('p', { class: 'continue' }, '(Click or press any key to continue)')));
    registerScreen('board', screen);
    Object.assign(ui, { screen, content });
    window.addEventListener('keydown', (e) => {
        if (!ui.screen.hidden && !e.repeat && !['KeyM', 'KeyP', 'KeyF', 'Escape'].includes(e.code)) {
            lift();
        }
    });
}

function showNext() {
    const n = queue.shift();
    if (n === undefined) {
        hideScreens();
        g.root.vars.infoboardisdown = false;
        return;
    }
    ui.content.replaceChildren(...BOARDS[n]());
    ui.screen.dataset.board = String(n);
    shownAt = performance.now();
    showScreen('board');
}

function lift() {
    // A short pause first, so a click or key meant for the previous screen doesn't skip a board.
    if (ui.screen.hidden || performance.now() - shownAt < 400) {
        return;
    }
    state.boards[Number(ui.screen.dataset.board)] = true;
    showNext();
}

function scrollClouds(c) {
    for (let i = 1; i <= 6; i++) {
        const cloud = c.get(`c${i}`);
        if (cloud) {
            cloud.x -= cloud.vars.speed;
            if (cloud.x < -200) {
                cloud.x = 700;
            }
        }
    }
}

function dayIntro(root) {
    audio.stopAll();
    state.day++;
    root.vars.cday = state.day;
    root.stop();
    if (!ui.screen) {
        build();
    }
    const board = root.get('infoboard');
    hideClips(board);
    board?.stop();
    queue = [];
    if (!state.boards[0]) {
        queue.push(0);
    }
    if (state.levels.gliders > 1 && !state.boards[1]) {
        queue.push(1);
    }
    if (state.levels.rockets > 1 && !state.boards[2]) {
        queue.push(2);
    }
    root.vars.infoboardisdown = queue.length > 0;
    if (!queue.length && options.skipCutscenes) {
        root.gotoAndPlay('game');
        return;
    }
    // The board drops in once the day sign is up.
    if (queue.length) {
        setTimeout(() => {
            if (root.frame === 10 && root.vars.infoboardisdown) {
                showNext();
            }
        }, 700);
    }
}

export default {
    frames: {
        root: { 10: dayIntro },
        505: {
            1: (c) => {
                c.vars.tempskip = 0;
                SPEEDS.forEach((s, i) => {
                    const cloud = c.get(`c${i + 1}`);
                    if (cloud) {
                        cloud.vars.speed = s;
                    }
                });
                c.onEnterFrame = () => scrollClouds(c);
            },
            49: (c) => {
                c.stop();
                c.onEnterFrame = () => {
                    if (g.root.vars.infoboardisdown === false) {
                        c.gotoAndPlay('begin');
                        c.onEnterFrame = null;
                    }
                    scrollClouds(c);
                };
            },
            50: (c) => {
                c.onEnterFrame = () => scrollClouds(c);
            },
            87: (c) => {
                c.stop();
                c.vars.k = 10;
                c.onEnterFrame = () => {
                    c.vars.k--;
                    if (!(c.vars.k > 0) && c.vars.tbool !== true) {
                        c.gotoAndPlay('begin2');
                        c.vars.tbool = true;
                    }
                    scrollClouds(c);
                };
            },
            98: (c) => {
                if (c.vars.tempskip !== 1) {
                    fade(true, true, 'game');
                }
            },
            147: (c) => {
                c.stop();
                c.onEnterFrame = null;
            },
        },
        // The canvas's own boards (sprite 516) stay put; the HTML boards replace them.
        516: Object.fromEntries([1, 35, 48, 81, 95, 128, 142].map((f) => [f, (c) => c.stop()])),
    },
};
