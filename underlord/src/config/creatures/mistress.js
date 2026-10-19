export default {
    name: 'Dark Mistress',
    hp: 140,
    attack: 18,
    /** Tiles per second. */
    speed: 2.7,
    /** Tiles; 1 = melee. */
    range: 1,
    /** Seconds between attacks. */
    rate: 0.8,
    /** Gold per payday. */
    wage: 105,
    /** XP per second in the Training Room. */
    train: 9,
    /** Research points per second in the Library; 0 = it never studies. */
    study: 1.2,
    /** How far it can see, in tiles. */
    vision: 5,
    /** How many the portals hold on one map. Arrivals take one; one that leaves or is dismissed goes back, a slain one is gone. */
    pool: 3,
    /** Minimum room sizes (room key: tiles) before it comes through a portal; every creature also needs a free Lair bed. */
    attract: {
        training: 9,
    },
    /** Fallback colour when the SVG is missing; also marks its Lair bed. */
    color: '#c43d7e',
};
