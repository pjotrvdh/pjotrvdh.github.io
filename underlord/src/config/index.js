/**
 * All game data in one object, as the game reads it. Each part lives in its own folder or file:
 * edit those, not this file. The order of the entries in each index.js is the order the game uses.
 */
import settings from './settings/index.js';
import creatures from './creatures/index.js';
import heroes from './heroes/index.js';
import rooms from './rooms/index.js';
import spells from './spells/index.js';
import waves from './waves.js';
import assets from './assets.js';

export default { settings, creatures, heroes, rooms, spells, waves, assets };
