/**
 * The live state. `G` is the game (map, units, money, ...), replaced by newGame() and saved by save.js.
 * `app` is the session around it: whether a game runs, the speed, the current tool, the pointer.
 */

/** @type {any} The current game; see newGame() in map.js for its fields. */
export let G = null;

export function setG(game) {
    G = game;
}

export const app = {
    /** A game has been started or loaded (the intro card is gone). */
    running: false,
    paused: false,
    /** update() runs this many times per frame (1-3). */
    speed: 1,
    /** The selected tool: 'hand', 'slap', 'look', a room code, 'sell' or a spell key. */
    tool: 'hand',
    /** The tile under the pointer: x, y (tile), fx, fy (fractional tile coordinates), sx, sy (screen), in. */
    hover: { x: -1, y: -1, fx: 0, fy: 0, sx: 0, sy: 0, in: false },
    /** The open panel tab. */
    tab: 'info',
};
