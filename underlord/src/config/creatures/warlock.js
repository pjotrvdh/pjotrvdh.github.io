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
    /** XP per second in the Training Room. */
    train: 9,
    /** Research points per second in the Library; 0 = it never studies. */
    study: 4,
    /** Chance (0–1) that it picks the Library before the Training Room when it has nothing else to do; 0 = no preference. */
    studyChance: 0.8,
    /** How far it can see, in tiles. */
    vision: 5,
    /** How many the portals hold on one map. Arrivals take one; one that leaves or is dismissed goes back, a slain one is gone. */
    pool: 5,
    /** Minimum room sizes (room key: tiles) before it comes through a portal; every creature also needs a free Lair bed. */
    attract: {
        library: 9,
    },
    /** Fallback colour when the SVG is missing; also marks its Lair bed. */
    color: '#7c4dd8',
};
