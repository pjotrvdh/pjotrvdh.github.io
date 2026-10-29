/**
 * Keeps the screen on while a game runs (a phone would dim and lock while you only drag the paddle): a
 * Screen Wake Lock during a match, released on the menus, the end screen and a solo pause. The browser
 * drops the lock when the page is hidden, so it is asked again once the page is back.
 */
import { state } from './context.js';

let wakeLock = null;
let wakeWanted = false;
let wakeRetry = 0;

/** Called every frame: asks for the lock or releases it when the game's need for it changes. */
export function keepAwake() {
    const wanted = (!['title', 'over'].includes(state.mode) || state.kind === 'demo') && !(state.paused && !state.countingDown && state.kind !== 'online');
    if (wanted === wakeWanted || !navigator.wakeLock || document.hidden || performance.now() < wakeRetry) {
        return;
    }
    wakeWanted = wanted;
    if (wanted) {
        navigator.wakeLock.request('screen').then((lock) => {
            wakeLock = lock;
            lock.addEventListener('release', () => {
                if (wakeLock === lock) {
                    wakeLock = null;
                    wakeWanted = false;
                }
            });
            if (!wakeWanted) {
                lock.release();
            }
        }).catch(() => {
            // Not allowed right now (battery saver, for example): the screen may dim; try again later.
            wakeWanted = false;
            wakeRetry = performance.now() + 5000;
        });
    } else {
        wakeLock?.release();
        wakeLock = null;
    }
}
