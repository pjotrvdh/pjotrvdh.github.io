/**
 * The tunnel the ball flies through. Distances are in tunnel units: the tunnel is twice
 * `halfWidth` wide and twice `halfHeight` high; your paddle is at depth 0, the opponent's at `depth`.
 */
export default {
    /** Half the tunnel's width: 4 / 3 of its height, so the field is 4 : 3. */
    halfWidth: 4 / 3,
    /** Half the tunnel's height. */
    halfHeight: 1,
    /** Distance from your paddle to the opponent's. */
    depth: 10,
    /** How much smaller the far end looks: the far end is drawn at 1 / (1 + perspective) of the near end. */
    perspective: 2.4,
    /** Rings drawn along the tunnel walls. */
    rings: 8,
    /** Half the width of a paddle. */
    paddleHalfWidth: 0.42,
    /** Half the height of a paddle. */
    paddleHalfHeight: 0.3,
    /** The ball's radius. */
    ballRadius: 0.1,
};
