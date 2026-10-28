/**
 * All game data in one object. The game reads it through this module only, so the tuning panel
 * (`?tune`, src/game/tune.js) can change values while playing.
 */
import assets from './assets.js';
import camera from './camera.js';
import controls from './controls.js';
import parks from './parks/index.js';
import physics from './physics.js';
import pieces from './pieces.js';
import world from './world.js';

export default { assets, camera, controls, parks, physics, pieces, world };
