import { g, gotoScene } from './context.js';

/*
 * The scene transitions: fadeoutc (sprite 108, snow blows in), fadeinc (109, snow blows away) and
 * flashfader (119, the white flash before the outro).
 */

/** The snow flakes: copies of the `snow` child that blow to the left. */
function snowFrame(clip, { max, perFrame, y }) {
    const template = clip.get('snow');
    if (!template) {
        return;
    }
    let count = clip.vars.scount;
    for (let j = 0; j <= perFrame(count); j++) {
        if (count < max) {
            const flake = clip.duplicate(template, `snow${count}`, g.root.getNextHighestDepth() + count);
            flake.x = 640 + Math.random() * 100;
            flake.y = y(count);
            flake.vars.vx = -40 - Math.random() * 20;
            flake.vars.vy = -1 * ((Math.random() - 0.5) * 5);
            count++;
        }
    }
    clip.vars.scount = count;
}

const snowFlake = {
    enterFrame(flake) {
        if (flake.name === 'snow') {
            return;
        }
        flake.x += flake.vars.vx;
        flake.y += flake.vars.vy;
        if (flake.x < -10 || flake.y < -10 || flake.y > 450) {
            flake.removeMovieClip();
        }
    },
};

const OUT = { max: 150, perFrame: (n) => 2 * (n / 40) + 1, y: (n) => 480 - Math.random() * ((480 * n) / 80) };
const IN = { max: 60, perFrame: (n) => 3 - 2.5 * (n / 30), y: () => Math.random() * 480 };

export default {
    frames: {
        108: {
            1: (c) => c.stop(),
            2: (c) => {
                c.play();
                c.vars.scount = 0;
                c.onEnterFrame = () => snowFrame(c, OUT);
            },
            41: (c) => {
                c.gotoAndStop(1);
                gotoScene(c.vars.fadeto);
                if (c.vars.fin === true) {
                    g.root.c('fadeinc').gotoAndPlay(2);
                }
                c.onEnterFrame = null;
            },
        },
        109: {
            1: (c) => c.stop(),
            2: (c) => {
                c.play();
                c.vars.scount = 0;
                c.onEnterFrame = () => snowFrame(c, IN);
            },
            45: (c) => {
                c.gotoAndStop(1);
                c.onEnterFrame = null;
            },
        },
        119: {
            372: (c) => g.root.gotoAndPlay(c.vars.fadeto),
        },
    },
    clips: {
        '108:3': snowFlake,
        '109:3': snowFlake,
    },
};
