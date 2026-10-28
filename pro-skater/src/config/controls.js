/**
 * Key and gamepad bindings (src/game/input.js). Keys are `KeyboardEvent.code` values (the physical
 * key, so WASD sits in the same place on every layout); gamepad buttons use the browser's standard
 * mapping (0 = A / Cross, 8 = Back / Select, 9 = Start, 12–15 = d-pad up, down, left, right).
 */
export default {
    keys: {
        left: ['ArrowLeft', 'KeyA'],
        right: ['ArrowRight', 'KeyD'],
        push: ['ArrowUp', 'KeyW'],
        brake: ['ArrowDown', 'KeyS'],
        ollie: ['Space'],
        pause: ['Escape', 'KeyP'],
        reset: ['KeyR'],
    },
    pad: {
        ollie: [0],
        pause: [9],
        reset: [8],
        push: [12, 7],
        brake: [13, 6],
        left: [14],
        right: [15],
    },
    /** Stick values below this are ignored. */
    deadzone: 0.2,
};
