export default {
    name: 'Tunneller',
    hp: 80,
    attack: 8,
    /** Tiles per second. */
    speed: 2.0,
    /** Tiles; 1 = melee. */
    range: 1,
    /** Seconds between attacks. */
    rate: 1,
    /** Gold for killing it. */
    bounty: 60,
    /** Seconds per hit when tunnelling. */
    dig: 0.3,
    /** Digs its way to your Heart; the rest of its wave follows the tunnel. In Dungeon Keeper only the dwarves dig. */
    tunnels: true,
    /** Fallback colour when the SVG is missing. */
    color: '#b9824a',
};
