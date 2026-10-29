/*
 * Mouse, touch and keyboard to the player, in stage coordinates (`toStage` maps window pixels to the
 * 640 × 480 stage, see the layout in index.js). Touch plays too: a tap
 * is a click; during a flight, touching the left or right third of the screen turns the penguin and
 * the middle fires the rocket.
 */

/** The keys the original reads (Key.isDown): arrows and Space. Their default scrolling is blocked. */
const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

export function setupInput(player, canvas, mapToStage, unlock) {
    const toStage = (e) => mapToStage(e.clientX, e.clientY);

    const touchKeys = new Map();
    // Thirds of the window, not of the stage (in flight the view is wider than the stage).
    const touchKey = (clientX) => (clientX < window.innerWidth / 3 ? 'ArrowLeft' : clientX > (window.innerWidth * 2) / 3 ? 'ArrowRight' : 'Space');

    canvas.addEventListener('pointerdown', (e) => {
        unlock();
        canvas.setPointerCapture?.(e.pointerId);
        const p = toStage(e);
        player.pushEvent('mousemove', p);
        player.pushEvent('mousedown', p);
        if (e.pointerType === 'touch') {
            const code = touchKey(e.clientX);
            touchKeys.set(e.pointerId, code);
            player.pushEvent('keydown', { code, touch: true });
        }
        e.preventDefault();
    });
    canvas.addEventListener('pointermove', (e) => {
        player.pushEvent('mousemove', toStage(e));
    });
    const up = (e) => {
        player.pushEvent('mouseup', toStage(e));
        const code = touchKeys.get(e.pointerId);
        if (code) {
            touchKeys.delete(e.pointerId);
            player.pushEvent('keyup', { code });
        }
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
        if (e.target instanceof HTMLElement && e.target.closest('.controls')) {
            return;
        }
        unlock();
        if (GAME_KEYS.has(e.code)) {
            e.preventDefault();
        }
        if (!e.repeat) {
            player.pushEvent('keydown', { code: e.code });
        }
    });
    window.addEventListener('keyup', (e) => {
        player.pushEvent('keyup', { code: e.code });
    });
    window.addEventListener('blur', () => {
        for (const code of [...player.keys]) {
            player.pushEvent('keyup', { code });
        }
    });
}
