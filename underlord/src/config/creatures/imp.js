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
    /** Digs, claims and hauls instead of fighting for wages: no hunger, no Lair bed, can be dropped on unclaimed ground. */
    worker: true,
    /** Made by the Create Imp spell, never comes through a portal. */
    portal: false,
    /** Fallback colour when the SVG is missing. */
    color: '#c8552f',
};
