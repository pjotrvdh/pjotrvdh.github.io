export default {
    name: 'Troll',
    hp: 110,
    attack: 9,
    /** Tiles per second. */
    speed: 1.7,
    /** Tiles; 1 = melee. */
    range: 1,
    /** Seconds between attacks. */
    rate: 1.1,
    /** Gold per payday. */
    wage: 30,
    /** XP per second in the Training Room. */
    train: 7,
    /** Research points per second in the Library; 0 = it never studies. */
    study: 0,
    /** How far it can see, in tiles. */
    vision: 5,
    /** How many the portals hold on one map. Arrivals take one; one that leaves or is dismissed goes back, a slain one is gone. */
    pool: 5,
    /** Minimum room sizes (room key: tiles) before it comes through a portal; every creature also needs a free Lair bed. */
    attract: {
        lair: 9,
        hatchery: 9,
    },
    /** Fallback colour when the SVG is missing; also marks its Lair bed. */
    color: '#8a7350',
};
