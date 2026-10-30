/**
 * Everything on the page around the tunnel: the HUD, the calls in the middle of the screen, the menu
 * screens, the high score lists, the hint, the two countdowns (before a serve, and after a pause) and the
 * title screen's settings.
 */
import { sounds } from './audio.js';
import { $, CPUS, LEVELS, R, clock, far, isSolo, near, state } from './context.js';
import { loadHighScores } from './highscores.js';
import { store } from './storage.js';

function lives(paddleState, max) {
    return '●'.repeat(Math.max(0, paddleState.lives)) + '○'.repeat(Math.max(0, max - paddleState.lives));
}

export function updateHud() {
    const max = isSolo() ? R.playerLives : R.matchLives;
    const farMax = isSolo() ? R.opponentLives : R.matchLives;
    // Solo: your score. In a match both sides score: yours (or CPU 1's) here, the opponent's next to its lives.
    $('score').textContent = String(isSolo() ? state.score : near.score).padStart(6, '0');
    $('scoreLabel').textContent = isSolo() ? 'Score' : `${near.name} score`;
    $('farScore').textContent = String(far.score).padStart(6, '0');
    $('farScoreLabel').textContent = `${far.name} score`;
    $('level').textContent = isSolo() ? `${state.level + 1} / ${LEVELS.length}` : `${state.level + 1}`;
    $('levelLabel').textContent = isSolo() ? 'Level' : 'Speed';
    $('levelBonus').textContent = Math.ceil(state.levelBonus);
    $('nearLabel').textContent = near.name;
    $('farLabel').textContent = far.name;
    $('nearLives').textContent = lives(near, max);
    $('nearLives').setAttribute('aria-label', `${near.lives} of ${max}`);
    $('farLives').textContent = lives(far, farMax);
    $('farLives').setAttribute('aria-label', `${far.lives} of ${farMax}`);
    for (const element of document.querySelectorAll('.solo-only')) {
        element.hidden = !isSolo();
    }
    for (const element of document.querySelectorAll('.match-only')) {
        element.hidden = isSolo();
    }
}

let callTimer = 0;
/** A short call in the middle of the screen, such as "Curve bonus!". Screen readers hear it too. */
export function call(text, tone = '') {
    const element = $('call');
    element.textContent = text;
    element.className = `call show ${tone}`;
    clearTimeout(callTimer);
    callTimer = setTimeout(() => element.classList.remove('show'), 1100);
}

export function showScreen(id) {
    for (const screen of document.querySelectorAll('.screen')) {
        screen.hidden = screen.id !== id;
    }
    $('overlay').hidden = !id;
    const focus = id && $(id).querySelector('[autofocus], button, input');
    focus?.focus();
}

export function renderHighScores() {
    const list = loadHighScores();
    for (const element of document.querySelectorAll('.highscores')) {
        element.replaceChildren(...(list.length
            ? list.map((entry) => {
                const item = document.createElement('li');
                item.innerHTML = '<span class="hs-name"></span><span class="hs-level"></span><span class="hs-score"></span>';
                item.querySelector('.hs-name').textContent = entry.name;
                item.querySelector('.hs-level').textContent = entry.from > 1 ? `level ${entry.level} (from ${entry.from})` : `level ${entry.level}`;
                item.querySelector('.hs-score').textContent = entry.score.toLocaleString('en');

                return item;
            })
            : [Object.assign(document.createElement('li'), { className: 'hs-empty', textContent: 'No scores yet. Be the first.' })]));
    }
}

export function setHint() {
    let hint = '';
    if (state.mode === 'serve' && state.kind !== 'demo') {
        hint = state.server === near ? 'Your serve' : 'Opponent serves';
    } else if (state.kind === 'demo' && state.mode !== 'over') {
        hint = matchMedia('(pointer: coarse)').matches ? 'Tap to stop watching' : 'Press Esc to stop watching';
    }
    $('hint').textContent = hint;
}

/* ---------- countdowns ---------- */

let shownCount = 0;
/** Shows the serve countdown (3, 2, 1) with a blip on every new number; nothing when no serve is due. */
export function showServeCountdown(seconds) {
    if (state.countingDown) {
        return;
    }
    const element = $('countdown');
    const count = seconds === null ? 0 : Math.ceil(seconds);
    if (count <= 0) {
        if (shownCount) {
            element.hidden = true;
        }
        shownCount = 0;

        return;
    }
    if (count !== shownCount) {
        shownCount = count;
        element.textContent = String(count);
        element.hidden = false;
        sounds.tick(false);
    }
}

/** A new serve: its countdown starts from the top. */
export function resetServeCountdown() {
    shownCount = 0;
}

let countdownTimer = 0;
/**
 * After a pause: 3, 2, 1, then the game goes on. The ball stays hidden until then (see render.js).
 * Online, both players run it; the host unpauses its game at the end.
 */
export function startCountdown() {
    showScreen(null);
    state.countingDown = true;
    let count = 3;
    const element = $('countdown');
    const show = () => {
        element.textContent = String(count);
        element.hidden = false;
        sounds.tick(false);
    };
    show();
    clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
        count--;
        if (count >= 1) {
            show();

            return;
        }
        clearInterval(countdownTimer);
        element.hidden = true;
        sounds.tick(true);
        state.countingDown = false;
        state.paused = false;
        clock.last = performance.now();
    }, 1000);
}

export function cancelCountdown() {
    clearInterval(countdownTimer);
    state.countingDown = false;
    $('countdown').hidden = true;
}

/* ---------- title screen settings ---------- */

/** The title screen's choices kept in this browser: element id, storage key and default. */
const REMEMBERED = [['startLevel', 'option.startLevel', '1'], ['cpuKind', 'option.cpu', 'auto']];

/** Reads the remembered choices and name into the title screen (again after a change in localStorage). */
export function reloadMenus() {
    for (const [id, key, fallback] of REMEMBERED) {
        $(id).value = store.read(key) ?? fallback;
        if (!$(id).value) {
            $(id).value = fallback;
        }
    }
    if (document.activeElement !== $('playerName')) {
        $('playerName').value = store.read('name') ?? '';
    }
}

/** Fills the title screen's choices (start level, kind of computer, match speed) and the remembered name. */
export function initMenus() {
    $('speed').value = String(R.matchLevel);
    $('startLevel').replaceChildren(...LEVELS.map((_, index) => Object.assign(document.createElement('option'), { value: String(index + 1), textContent: String(index + 1) })));
    $('cpuKind').replaceChildren(
        Object.assign(document.createElement('option'), { value: 'auto', textContent: 'Auto (a random one every level)' }),
        ...Object.entries(CPUS).map(([key, cpu]) => Object.assign(document.createElement('option'), { value: key, textContent: `${cpu.name}: ${cpu.about}` })),
    );
    for (const [id, key] of REMEMBERED) {
        $(id).addEventListener('change', () => store.write(key, $(id).value));
    }
    reloadMenus();
}
