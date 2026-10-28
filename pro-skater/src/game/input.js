/**
 * Keyboard and gamepad input (bindings in config/controls.js), read once per frame with poll().
 * Held controls (steer, push, brake, jump) are states; pause and reset are presses (true for one poll).
 */
const held = new Set();
const pressed = new Set();
let lastPad = {};
let padName = null;

addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement && event.code === 'Space') {
        return;
    }
    if (!event.repeat) {
        pressed.add(event.code);
    }
    held.add(event.code);
    if (event.code === 'Space' || event.code.startsWith('Arrow')) {
        event.preventDefault();
    }
});
addEventListener('keyup', (event) => held.delete(event.code));
addEventListener('blur', () => held.clear());

/** The first connected gamepad, or null. */
function gamepad() {
    for (const pad of navigator.getGamepads?.() ?? []) {
        if (pad?.connected) {
            return pad;
        }
    }

    return null;
}

/** The name of the gamepad in use, or null. */
export const gamepadName = () => padName;

/**
 * The controls this frame.
 *
 * @param {object} controls config.controls
 * @returns {{steer: number, push: boolean, brake: boolean, jump: boolean, pause: boolean, reset: boolean, confirm: boolean}}
 */
export function poll(controls) {
    const key = (action) => controls.keys[action].some((code) => held.has(code));
    const keyPress = (action) => controls.keys[action].some((code) => pressed.has(code));

    const pad = gamepad();
    padName = pad ? pad.id : null;
    const button = (action) => !!pad && controls.pad[action].some((index) => pad.buttons[index]?.pressed);
    const stickX = pad ? applyDeadzone(pad.axes[0] ?? 0, controls.deadzone) : 0;
    const stickY = pad ? applyDeadzone(pad.axes[1] ?? 0, controls.deadzone) : 0;
    const padState = { pause: button('pause'), reset: button('reset'), ollie: button('ollie') };
    const padPress = (action) => padState[action] && !lastPad[action];

    const keySteer = (key('right') ? 1 : 0) - (key('left') ? 1 : 0);
    const padSteer = stickX || (button('right') ? 1 : 0) - (button('left') ? 1 : 0);
    const input = {
        steer: Math.max(-1, Math.min(1, keySteer + padSteer)),
        push: key('push') || button('push') || stickY < -0.5,
        brake: key('brake') || button('brake') || stickY > 0.5,
        jump: key('ollie') || padState.ollie,
        pause: keyPress('pause') || padPress('pause'),
        reset: keyPress('reset') || padPress('reset'),
        /** Confirm on the title screen: Enter, Space or A. */
        confirm: pressed.has('Enter') || pressed.has('Space') || padPress('ollie'),
    };
    lastPad = padState;
    pressed.clear();

    return input;
}

function applyDeadzone(value, deadzone) {
    if (Math.abs(value) < deadzone) {
        return 0;
    }

    return Math.sign(value) * (Math.abs(value) - deadzone) / (1 - deadzone);
}
