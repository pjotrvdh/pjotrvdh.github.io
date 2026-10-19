export default {
    name: 'Lord of the Land',
    hp: 1000,
    attack: 32,
    /** Tiles per second. */
    speed: 1.8,
    /** Tiles; 1 = melee. */
    range: 1,
    /** Seconds between attacks. */
    rate: 1.1,
    /** Gold for killing it. */
    bounty: 1000,
    /** Seconds per hit when tunnelling. */
    dig: 0.6,
    /** A boss: drawn larger. */
    big: true,
    /** Fallback colour when the SVG is missing. */
    color: '#e2c46a',
};
