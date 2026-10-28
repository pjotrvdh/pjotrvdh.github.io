/**
 * Copies the 3D models Pro Skater uses from Kenney Mini Skate into pro-skater/models, unchanged, with
 * the one texture they all share (Textures/colormap.png, which the .glb files refer to by that path).
 *
 * Usage, from the repository root, with the pack unzipped in ./downloads/Kenney (ignored by git):
 *     node pro-skater/tools/import-models.mjs
 *
 * Kenney Mini Skate 2.0 is CC0 (kenney.nl). Keep MODELS in step with src/config/pieces.js and
 * src/config/assets.js.
 */
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';

const SOURCE = 'downloads/Kenney/kenney_mini-skate/Models/GLB format';
const TARGET = 'pro-skater/models';

const MODELS = [
    // The skater.
    'character-skate-boy', 'character-skate-girl', 'skateboard',
    // Park pieces.
    'floor-concrete', 'bowl-platform', 'half-pipe', 'half-pipe-low', 'bowl-corner-inner', 'bowl-corner-outer',
    'ramp', 'steps', 'obstacle-box', 'obstacle-middle', 'obstacle-end',
    'rail-low', 'rail-high', 'rail-low-end',
    // Props.
    'bench', 'benches', 'fence', 'pallet',
];

rmSync(TARGET, { recursive: true, force: true });
mkdirSync(`${TARGET}/Textures`, { recursive: true });
for (const name of MODELS) {
    copyFileSync(`${SOURCE}/${name}.glb`, `${TARGET}/${name}.glb`);
}
copyFileSync(`${SOURCE}/Textures/colormap.png`, `${TARGET}/Textures/colormap.png`);
console.log(`Copied ${MODELS.length} models and the colormap to ${TARGET}.`);
