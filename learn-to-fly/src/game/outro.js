import config from '../config/index.js';
import { fade, g } from './context.js';
import { h, registerScreen, showScreen } from './ui.js';
import { state } from './state.js';

/*
 * The ending (root frame 13, sprite 789): outro1 (788) the crash through the iceberg with the screen
 * shaking, outro2 (745) the flight through the clouds, outro3 (738) the landing with its animation
 * (705: clouds, the sea and flying ice) and the end text (737) with the number of days. "Back to
 * menu" and "Continue" both keep the game going (keepplaying).
 */

/** Clouds rushing past (sprite 745). */
function rushingClouds(c) {
    const reset = (cloud, x) => {
        const s = 40 + Math.random() * 70;
        cloud.xscale = s;
        cloud.yscale = s;
        cloud.y = Math.random() * 480;
        cloud.x = x(cloud);
        cloud.vars.speed = 75 + Math.random() * 50;
    };
    for (let i = 1; i <= 6; i++) {
        const cloud = c.get(`cloud${i}`);
        if (cloud) {
            reset(cloud, () => Math.random() * 1000);
        }
    }
    c.onEnterFrame = () => {
        const flare = c.get('player')?.get('rocketflare');
        if (flare) {
            flare.visible = true;
        }
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
}

/** Bits of ice flying off the iceberg (sprite 705, from frame 61 to 77). */
function debris(c) {
    const source = c.get('debris');
    if (!source) {
        return;
    }
    source.visible = false;
    c.vars.debriscount = 0;
    c.get('sea2')?.swapDepths(2000);
    c.onEnterFrame = () => {
        for (let i = 0; i < 3; i++) {
            const n = c.vars.debriscount++;
            const bit = c.duplicate(source, `debris${n}`, 16384 + 1000 + n);
            bit.visible = true;
            bit.gotoAndStop(Math.round(Math.random() * 5));
            bit.x = source.x;
            bit.y = source.y;
            bit.xscale = 30 + Math.random() * 80;
            bit.yscale = 30 + Math.random() * 80;
            const vel = { vx: -10 - Math.random() * 50, vy: (Math.random() - 0.8) * 40, vr: (Math.random() - 0.2) * 50 };
            bit.onEnterFrame = () => {
                bit.x += vel.vx;
                bit.y += vel.vy;
                if (bit.y > 500) {
                    bit.removeMovieClip();
                }
                bit.rotation += vel.vr;
                vel.vx *= 0.99;
                vel.vy += 1;
            };
        }
    };
}

const drift = (speed) => ({ enterFrame: (c) => { c.x -= speed; } });

/** The end screen's comment, by the number of days played (config/game.js). */
const COMMENTS = {
    1: 'Were you even trying?',
    2: 'It was about time…',
    3: 'Not bad… Now try and clear the game faster',
    4: 'Nice job! Think you could do better?',
    5: 'Incredible!',
};

const ui = {};

function buildEnd() {
    const days = h('p', { class: 'days' });
    const comment = h('p', { class: 'comment' });
    let done = false;
    const leave = (label) => () => {
        if (done) {
            return;
        }
        done = true;
        state.keepPlaying = true;
        fade(true, true, label);
    };
    const screen = h('section', { class: 'end-screen', 'aria-label': 'Game cleared' },
        h('div', { class: 'chalkboard end-card' },
            h('h2', {}, 'You cleared the game in'),
            days,
            comment,
            h('div', { class: 'end-buttons' },
                h('button', { type: 'button', class: 'chalk-button', onclick: leave('mainmenu') }, 'Back to menu'),
                h('button', { type: 'button', class: 'chalk-button', 'data-autofocus': true, onclick: leave('shop') }, 'Continue'))));
    registerScreen('end', screen);
    Object.assign(ui, { screen, days, comment, reset: () => { done = false; } });
}

/** The end text (sprite 737) stays hidden; the HTML end screen shows the days and a comment. */
function endText(c, show) {
    c.visible = false;
    if (!show) {
        return;
    }
    if (!ui.screen) {
        buildEnd();
    }
    ui.reset();
    const comment = config.game.endComments.find((e) => state.day > e.over);
    ui.days.textContent = `${state.day} ${state.day === 1 ? 'Day' : 'Days'}`;
    ui.comment.textContent = COMMENTS[comment.frame];
    showScreen('end');
}

export default {
    frames: {
        789: {
            1: (c) => {
                g.root.onEnterFrame = null;
                c.stop();
                c.c('outro2').stop();
                c.c('outro3').stop();
                c.c('outro3').c('anim').stop();
            },
        },
        788: {
            100: (c) => {
                let shake = 0;
                let phase = 0;
                c.onEnterFrame = () => {
                    if (phase === 0) {
                        shake += 0.5;
                        if (shake > 15) {
                            phase = 1;
                        }
                    } else if (phase === 1) {
                        shake -= 0.6;
                        if (shake < 0) {
                            shake = 0;
                            phase = 2;
                        }
                    }
                    const bg = c.c('bg');
                    bg.x = -20 + (Math.random() - 0.5) * shake;
                    bg.y = -20 + (Math.random() - 0.5) * shake;
                };
            },
            265: (c) => {
                c.stop();
                c.parent.c('outro2').play();
                c.visible = false;
                c.onEnterFrame = null;
            },
        },
        745: {
            1: rushingClouds,
            113: (c) => {
                c.stop();
                c.parent.c('outro3').play();
                c.parent.c('outro3').c('anim').play();
                c.visible = false;
                c.onEnterFrame = null;
            },
        },
        705: {
            61: debris,
            77: (c) => {
                c.onEnterFrame = null;
            },
        },
        737: {
            1: (c) => endText(c, false),
            23: (c) => {
                c.stop();
                endText(c, true);
            },
        },
    },
    clips: {
        '705:2': drift(0.2),
        '705:4': drift(0.6),
        '705:6': drift(0.4),
        '705:8': drift(0.85),
        '705:10': drift(0.4),
        '705:12': drift(0.9),
        '705:28': drift(1),
        '705:36': drift(1),
    },
};
