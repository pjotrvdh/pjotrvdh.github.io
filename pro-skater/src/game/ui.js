/**
 * The screens round the game (index.html): loading, title, pause, and the HUD's short messages.
 */
const $ = (id) => document.getElementById(id);

let flashTimer = 0;

/** Shows loading progress. */
export function showLoading(done, total) {
    $('loading').textContent = `Loading the park… ${Math.round(done / total * 100)} %`;
}

/** Shows the title screen; `onStart` runs when the player clicks Skate (keys and pads go through the game loop). */
export function showTitle(onStart) {
    $('loading').hidden = true;
    $('title').hidden = false;
    $('start').onclick = onStart;
    $('start').focus();
}

export function hideTitle() {
    $('title').hidden = true;
    $('hud').hidden = false;
}

/**
 * Shows or hides the pause screen.
 *
 * @param {boolean} paused
 * @param {{resume: () => void, reset: () => void}} [actions]
 */
export function showPause(paused, actions) {
    $('pause').hidden = !paused;
    if (paused && actions) {
        $('resume').onclick = actions.resume;
        $('reset').onclick = actions.reset;
        $('resume').focus();
    }
}

/** A short message in the middle of the screen, such as "Bail!". */
export function flash(text, kind = '') {
    const message = $('message');
    message.textContent = text;
    message.className = `message show ${kind}`;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
        message.className = 'message';
    }, 900);
}

/** Shows what went wrong when the game can't start. */
export function showError(text) {
    $('loading').hidden = true;
    $('title').hidden = true;
    const error = $('error');
    error.textContent = text;
    error.hidden = false;
}

/** The gamepad line on the title and pause screens. */
export function showGamepad(name) {
    for (const element of document.querySelectorAll('.pad-status')) {
        element.textContent = name ? `Gamepad: ${name.replace(/\s*\(.*$/, '')}` : 'No gamepad connected: press a button on it to connect.';
    }
}
