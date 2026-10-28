/**
 * The parks, and the tokens their maps are written in. A map is rows of two-character tokens, one per
 * tile: the first character is the piece (config/pieces.js), the second its direction.
 *
 * Pieces: `..` floor, `##` deck (1.8 m block), `Q` quarter pipe, `q` low quarter pipe, `I` inner bowl
 * corner, `O` outer bowl corner, `R` ramp, `T` steps, `M` manual pad, `L` ledge, `E` ledge end, `r` rail,
 * `h` high rail, `e` rail end, `B` bench, `b` picnic benches, `F` fence, `P` pallet.
 *
 * Directions:
 * - `N`, `E`, `S`, `W`: the way the low side faces (where you ride in from), or a rail end's tapered side.
 * - `|`, `-`: long pieces running north–south or east–west.
 * - `0`–`3`: a quarter turn count, for bowl corners: 0 faces south-east, 1 north-east, 2 north-west, 3 south-west.
 * - `.` (or `#` for the deck): no direction.
 */
import warehouse from './warehouse.js';

export const PIECE_CODES = {
    '.': 'floor', '#': 'deck', Q: 'quarter', q: 'quarterLow', I: 'cornerInner', O: 'cornerOuter',
    R: 'ramp', T: 'steps', M: 'pad', L: 'ledge', E: 'ledgeEnd', r: 'rail', h: 'railHigh', e: 'railEnd',
    B: 'bench', b: 'benches', F: 'fence', P: 'pallet',
};

/** Quarter turns (about +y, from +z towards +x) that make a piece's low side face each direction. */
export const TURNS = { S: 0, E: 1, N: 2, W: 3, 0: 0, 1: 1, 2: 2, 3: 3, '.': 0, '#': 0 };

export default { warehouse };
