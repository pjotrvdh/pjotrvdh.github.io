import achievements from './achievements.js';
import day from './day.js';
import fades from './fades.js';
import flight from './flight.js';
import menu from './menu.js';
import options from './options.js';
import outro from './outro.js';
import penguin from './penguin.js';
import rampMenu from './ramp-menu.js';
import shop from './shop.js';
import start from './start.js';

/*
 * The original's ActionScript, rewritten per part of the game, in one table for the player
 * (src/render/player.js):
 * - frames[<sprite id> | 'root'][<frame>](clip): frame scripts (frames marked `script` in library.json).
 * - clips['<parent sprite id> | root:<depth>']: onClipEvent handlers (load, enterFrame, keyDown, …).
 * - buttons[<button id>](button, timeline): the button's release action.
 */

const parts = [start, fades, options, penguin, menu, shop, rampMenu, day, flight, achievements, outro];

const scripts = { frames: {}, clips: {}, buttons: {} };
for (const part of parts) {
    for (const [key, frames] of Object.entries(part.frames ?? {})) {
        scripts.frames[key] = { ...scripts.frames[key], ...frames };
    }
    Object.assign(scripts.clips, part.clips);
    Object.assign(scripts.buttons, part.buttons);
}

export default scripts;
