/**
 * The skater's models and animation clips (src/render/skater.js). Files are in models/ (see
 * tools/import-models.mjs); clips are the Kenney Mini Skate character animations.
 */
export default {
    characters: ['character-skate-boy', 'character-skate-girl'],
    board: 'skateboard',
    /** Which clip plays in which state. */
    clips: {
        push: 'skate',
        roll: 'skate-stand',
        crouch: 'skate-stand',
        air: 'skate-air',
        bail: 'die',
    },
    /** Seconds to blend from one clip to the next. */
    blend: 0.15,
};
