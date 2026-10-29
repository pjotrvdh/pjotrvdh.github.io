// In Dungeon Keeper 1 a Skeleton is not attracted: it rises from a hero that dies in your Prison.
// It never eats.
export default {
    name: 'Skeleton',
    hp: 90,
    attack: 13,
    /** Tiles per second. */
    speed: 2.3,
    /** Tiles; 1 = melee. */
    range: 1,
    /** Seconds between attacks. */
    rate: 1.0,
    /** Gold per payday. */
    wage: 30,
    /** XP per second in the Training Room. */
    train: 8,
    /** Research points per second in the Library; 0 = it never studies. */
    study: 0,
    /** How far it can see, in tiles. */
    vision: 5,
    /** Never comes through a portal (it rises in the Prison), so it has no pool. */
    portal: false,
    /** Never gets hungry. */
    eats: false,
    /** Fallback colour when the SVG is missing; also marks its Lair bed. */
    color: '#d8d0b8',
};
