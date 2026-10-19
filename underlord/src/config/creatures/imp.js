// Imps flee from heroes, but fight with attack/range/rate when they defend the Dungeon Heart (settings/imp.js).
export default {
    name: 'Imp',
    hp: 40,
    attack: 3,
    /** Tiles per second. */
    speed: 3.0,
    /** Tiles; 1 = melee. */
    range: 1,
    /** Seconds between attacks. */
    rate: 1,
    /** Gold per payday. */
    wage: 0,
    /** Fallback colour when the SVG is missing. */
    color: '#c8552f',
};
