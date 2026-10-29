// In Dungeon Keeper 1 the Orc needs a Training Room and a Barracks. This game has no Barracks (yet),
// so the Orc only needs a free bed, which makes it the first creature you can attract.
export default {
    name: 'Orc',
    hp: 140,
    attack: 13,
    /** Tiles per second. */
    speed: 2.3,
    /** Tiles; 1 = melee. */
    range: 1,
    /** Seconds between attacks. */
    rate: 0.9,
    /** Gold per payday. */
    wage: 55,
    /** XP per second in the Training Room. */
    train: 9,
    /** Research points per second in the Library; 0 = it never studies. */
    study: 0,
    /** How far it can see, in tiles. */
    vision: 5,
    /** How many the portals hold on one map. Arrivals take one; one that leaves or is dismissed goes back, a slain one is gone. */
    pool: 8,
    /** Minimum room sizes (room key: tiles) before it comes through a portal; every creature also needs a free Lair bed. */
    attract: {},
    /** Fallback colour when the SVG is missing; also marks its Lair bed. */
    color: '#b0457a',
};
