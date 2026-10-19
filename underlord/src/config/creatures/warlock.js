export default {
    name: 'Warlock',
    hp: 70,
    attack: 13,
    /** Tiles per second. */
    speed: 2.0,
    /** Tiles; 1 = melee. */
    range: 4,
    /** Seconds between attacks. */
    rate: 1.3,
    /** Gold per payday. */
    wage: 70,
    /** How far it can see, in tiles. */
    vision: 5,
    /** How many can come through portals on one map. */
    pool: 5,
    /** Minimum room sizes (room key: tiles) before it comes through a portal; every creature also needs a free Lair bed. */
    attract: {
        library: 9,
    },
    /** Fallback colour when the SVG is missing; also marks its Lair bed. */
    color: '#7c4dd8',
};
