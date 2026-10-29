export default {
    name: 'Thief',
    hp: 55,
    attack: 8,
    /** Tiles per second. */
    speed: 3.0,
    /** Tiles; 1 = melee. */
    range: 1,
    /** Seconds between attacks. */
    rate: 0.6,
    /** Gold for killing it. */
    bounty: 50,
    /** Seconds per hit when it tunnels (only heroes with `tunnels` dig, see tunneller.js). */
    dig: 1.0,
    /** Gold it steals from a Treasury before it runs back to the Hero Gate with it. */
    steals: 200,
    /** Fallback colour when the SVG is missing. */
    color: '#5c6470',
};
