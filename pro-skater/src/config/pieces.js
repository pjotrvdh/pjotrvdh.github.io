/**
 * The park pieces: Kenney Mini Skate models on a 1×1 tile grid (see tools/import-models.mjs). The park
 * maps in config/parks place them by `code`; src/game/park.js samples each model's triangles into the
 * collision grid, so the shape you ride is the shape you see.
 *
 * - `model`: file in models/ (without .glb).
 * - `kind`:
 *   - `ride`: you roll on it; edges higher than `physics.stepUp` are walls.
 *   - `vert`: a transition (quarter pipe, bowl). Riding up it is fine from the front (`facing`), and at
 *     the steep top you fly straight up (`physics.vertLaunchSlope`); from behind or the side its edges are walls.
 *   - `solid`: rails, benches, fences: you can't roll or land on it, only jump over it.
 * - `facing`: for `vert` pieces, the direction the low side faces before rotation, as [x, z].
 * - `runs`: for long thin pieces (rails, ledges, fences), the axis they run along before rotation.
 *
 * Every model's low side (ramps, quarters, steps) faces +z (south) when not rotated.
 */
const DIAGONAL = Math.SQRT1_2;

export default {
    floor: { model: 'floor-concrete', kind: 'ride' },
    deck: { model: 'bowl-platform', kind: 'ride' },
    quarter: { model: 'half-pipe', kind: 'vert', facing: [0, 1] },
    quarterLow: { model: 'half-pipe-low', kind: 'vert', facing: [0, 1] },
    cornerInner: { model: 'bowl-corner-inner', kind: 'vert', facing: [DIAGONAL, DIAGONAL] },
    cornerOuter: { model: 'bowl-corner-outer', kind: 'vert', facing: [DIAGONAL, DIAGONAL] },
    ramp: { model: 'ramp', kind: 'ride' },
    steps: { model: 'steps', kind: 'ride' },
    pad: { model: 'obstacle-box', kind: 'ride' },
    ledge: { model: 'obstacle-middle', kind: 'ride', runs: 'z' },
    ledgeEnd: { model: 'obstacle-end', kind: 'ride' },
    rail: { model: 'rail-low', kind: 'solid', runs: 'z' },
    railHigh: { model: 'rail-high', kind: 'solid', runs: 'z' },
    railEnd: { model: 'rail-low-end', kind: 'solid' },
    bench: { model: 'bench', kind: 'solid' },
    benches: { model: 'benches', kind: 'solid' },
    fence: { model: 'fence', kind: 'solid', runs: 'x' },
    pallet: { model: 'pallet', kind: 'solid' },
};
