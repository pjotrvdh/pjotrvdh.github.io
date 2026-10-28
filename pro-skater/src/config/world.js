/**
 * The size of the world. Kenney Mini Skate is modelled on a 1×1 grid where the skater is 0.78 units
 * tall; the game works in metres, so every model is scaled by `scale`.
 */
export default {
    /** Metres per Kenney unit: the skater becomes 0.78 × 2.25 ≈ 1.75 m, a park tile 2.25 m, a quarter pipe 1.8 m. */
    scale: 2.25,
    /** Height samples per tile side for the park's collision grid (src/game/park.js): 16 gives 14 cm cells. */
    samples: 16,
    /** Height difference between neighbouring samples, in metres, that counts as an edge (a drop or a wall), not a slope. */
    cliff: 0.15,
    /** Simulation steps per second (src/game/index.js). Physics runs at this fixed rate whatever the frame rate. */
    tickRate: 120,
};
