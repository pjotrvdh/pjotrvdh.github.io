/**
 * What every part of the game shares: the config, the renderer, the two paddles and the game state.
 * Everything else (rules, physics, online play, screens, input) works on these.
 */
import config from '../config/index.js';
import { createRenderer } from './render.js';

export const { tunnel: T, rules: R, scoring: S, levels: LEVELS, palettes: PALETTES, cpus: CPUS } = config;
export const $ = (id) => document.getElementById(id);

export const canvas = $('stage');
export const renderer = createRenderer(canvas, T);

/** The paddles may go as far as the walls allow. */
export const limitX = T.halfWidth - T.paddleHalfWidth;
export const limitY = T.halfHeight - T.paddleHalfHeight;
export const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));

/** A paddle: where it is, how fast it moves (that becomes spin), who controls it, its lives and (in a match) its score. */
function paddle(name, z) {
    return { name, z, x: 0, y: 0, vx: 0, vy: 0, target: { x: 0, y: 0 }, human: false, lives: 0, score: 0, cpu: CPUS.calm };
}

export const near = paddle('You', 0);
export const far = paddle('Opponent', T.depth);

/** A paddle as the name it has in events and messages: 'near' or 'far'. */
export const sideKey = (side) => (side === near ? 'near' : 'far');

export const state = {
    /** solo | online | demo */
    kind: 'solo',
    /** Online only: host or guest. */
    role: null,
    /** title | lobby | serve | play | wait | levelClear | over */
    mode: 'title',
    paused: false,
    /** The countdown after a pause is running. */
    countingDown: false,
    score: 0,
    level: 0,
    /** Solo: the level this game started on (you can pick it on the title screen). */
    startLevel: 0,
    levelBonus: S.levelBonus,
    rallySpeed: 1,
    /** The paddle that serves next, and the seconds left until it serves by itself. */
    server: near,
    serveTimer: 0,
    player: near,
    opponent: far,
    ball: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, sx: 0, sy: 0 },
    ballVisible: false,
    sparks: [],
    backFlash: 0,
};

export const isSolo = () => state.kind === 'solo';
export const isGuest = () => state.role === 'guest';

/** The game's clock: when the last frame ran. A resumed game sets it to now, so no time passes during a pause. */
export const clock = { last: performance.now() };

/** The current level's settings (levels.js). */
export const levelData = () => LEVELS[state.level];
