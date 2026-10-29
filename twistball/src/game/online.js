/**
 * Online play over net.js: hosting and joining a room, the ready check before every match, the host
 * sending its game to the guest (who draws it mirrored), pausing when a player leaves the page, and the
 * heartbeat. The game rules stay in game.js: the host runs them, the guest only follows.
 */
import { sounds } from './audio.js';
import { $, R, T, clamp, far, limitX, limitY, near, renderer, state } from './context.js';
import { playEvent, resetPaddles, startGame, toMenu } from './game.js';
import { cleanCode, createSession, isValidCode, randomCode } from './net.js';
import { call, cancelCountdown, setHint, showScreen, showServeCountdown, startCountdown, updateHud } from './screens.js';
import { fillShare } from './share.js';

let session = null;
/** When the last message from the other player arrived; both sides send many per second. */
let lastHeard = 0;
/** Who has said they are ready for the next match (or to go on after a pause). The host starts it when both have. */
const ready = { me: false, them: false };
/** Host: things that happened this frame (sounds, calls, sparks), sent to the guest with the state. */
let events = [];
/** Who left the page, for the resume screen. */
let awayBy = null;

/** Sends a message to the other player, if connected. */
export const send = (message) => session?.send(message);
/** Is there a room (being set up or connected)? */
export const inRoom = () => Boolean(session);

/** Host: queues an event (a sound, a call, a spark) for the guest; the host has played it already. */
export function emit(event) {
    if (state.role === 'host') {
        events.push(event);
    }
}

/** Host: the game as the guest needs it, sent every frame. */
export function sendState() {
    if (!session?.isOpen) {
        return;
    }
    const ball = state.ball;
    session.send({
        t: 'state',
        mode: state.mode,
        server: state.server === near ? 'near' : 'far',
        serveIn: state.mode === 'serve' ? state.serveTimer : null,
        ball: state.ballVisible ? [ball.x, ball.y, ball.z] : null,
        near: [near.x, near.y, near.lives, near.score],
        far: [far.x, far.y, far.lives, far.score],
        level: state.level,
        events,
    });
    events = [];
}

/** Guest: what the host sees as near is far here, and its left is our right. */
const mirror = (x) => -x;
const otherSide = (side) => (side === 'near' ? far : near);

function applyState(message) {
    state.mode = message.mode;
    state.level = message.level;
    state.server = otherSide(message.server);
    // Our own paddle is drawn from our own input (see update), so it never lags; we only take the lives.
    near.lives = message.far[2];
    near.score = message.far[3];
    far.x = mirror(message.near[0]);
    far.y = message.near[1];
    far.lives = message.near[2];
    far.score = message.near[3];
    state.ballVisible = Boolean(message.ball);
    if (message.ball) {
        state.ball.x = mirror(message.ball[0]);
        state.ball.y = message.ball[1];
        state.ball.z = T.depth - message.ball[2];
    }
    for (const event of message.events) {
        playEvent(event, true);
    }
    showServeCountdown(message.serveIn);
    if (message.mode === 'serve') {
        // A new point: a paddle that broke apart is whole again.
        renderer.restore();
    }
    setHint();
}

export function openOnline() {
    showScreen('screenOnline');
    $('onlineStatus').textContent = '';
    $('roomBox').hidden = true;
    $('joinCode').value = '';
}

export function leaveOnline(reason = '') {
    const wasOnline = Boolean(session);
    session?.close();
    session = null;
    state.role = null;
    lastHeard = 0;
    if (wasOnline && reason) {
        toMenu();
        $('onlineStatus').textContent = reason;
        showScreen('screenOnline');
    }
}

function sessionHandlers() {
    return {
        onOpen: () => {
            lastHeard = performance.now();
            openReady();
        },
        onMessage: (message) => {
            lastHeard = performance.now();
            if (state.role === 'host' && message.t === 'input') {
                far.target.x = clamp(mirror(message.x), limitX);
                far.target.y = clamp(message.y, limitY);
            }
            if (message.t === 'ready') {
                ready.them = true;
                updateReady();
            } else if (message.t === 'pause') {
                pauseOnline(false);
            } else if (message.t === 'countdown') {
                startCountdown();
            } else if (state.role === 'host') {
                return;
            } else if (message.t === 'start') {
                startGuest(message);
            } else if (message.t === 'state') {
                applyState(message);
            }
        },
        onClose: (reason) => {
            if (session) {
                session = null;
                leaveOnline(reason || 'The connection was closed.');
            }
        },
    };
}

export function hostRoom() {
    leaveOnline();
    const code = randomCode();
    state.role = 'host';
    session = createSession(sessionHandlers());
    session.create(code);
    const link = new URL(location.href);
    link.search = `?room=${code}`;
    link.hash = '';
    $('roomCode').textContent = code;
    $('roomLink').value = link.href;
    fillShare(link.href);
    $('roomBox').hidden = false;
    $('onlineStatus').textContent = 'Waiting for the other player…';
}

export function joinRoom(code) {
    const clean = cleanCode(code);
    if (!isValidCode(clean)) {
        $('onlineStatus').textContent = 'A room code has 5 letters or digits.';

        return;
    }
    leaveOnline();
    state.role = 'guest';
    session = createSession(sessionHandlers());
    session.join(clean);
    $('onlineStatus').textContent = `Joining room ${clean}…`;
}

/** Guest: a match starts; from here on we only follow the host. */
function startGuest(message) {
    sounds.unlock();
    state.kind = 'online';
    state.score = 0;
    near.score = 0;
    far.score = 0;
    state.level = message.level;
    near.human = true;
    far.human = true;
    near.name = 'You';
    far.name = 'Opponent';
    near.lives = R.matchLives;
    far.lives = R.matchLives;
    resetPaddles();
    showScreen(null);
    call('Online match', 'good');
    updateHud();
}

/* ---------- ready check ---------- */

/** Where the ready check stands, in words. `idle` is the text while neither player is ready yet. */
function readyText(idle) {
    if (ready.me && ready.them) {
        return null;
    }

    return ready.them ? 'Your opponent is ready. Are you?' : ready.me ? 'Waiting for your opponent to get ready…' : idle;
}

/** Both players confirm they are ready before a match (and before every rematch). */
export function openReady() {
    // Only our own flag: the other player may already have said they are ready.
    ready.me = false;
    state.mode = 'lobby';
    state.ballVisible = false;
    $('readyButton').disabled = false;
    $('readyButton').textContent = "I'm ready";
    showScreen('screenReady');
    updateReady();
}

export function readyUp() {
    if (!session || ready.me) {
        return;
    }
    sounds.unlock();
    ready.me = true;
    session.send({ t: 'ready' });
    $('readyButton').disabled = true;
    $('readyButton').textContent = 'Ready!';
    updateReady();
}

function updateReady() {
    if (state.paused && state.kind === 'online') {
        updateResume();

        return;
    }
    $('readyStatus').textContent = readyText('Connected. Get ready when you are.') ?? 'Both ready. Here we go!';
    if (ready.me && ready.them) {
        ready.me = false;
        ready.them = false;
        if (state.role === 'host') {
            startGame('online');
        }
    }
}

/* ---------- pause: away from the page ---------- */

/**
 * Pauses an online match for both players. `byMe` when this player left the page; otherwise the
 * other player did. Both have to say they are ready again, then a countdown from 3 resumes the game.
 */
export function pauseOnline(byMe) {
    // Only during a match: in play, or already paused or counting down (leaving again restarts the wait).
    if (state.kind !== 'online' || !session || (!state.paused && !['serve', 'play', 'wait'].includes(state.mode))) {
        return;
    }
    if (byMe) {
        session.send({ t: 'pause' });
    }
    state.paused = true;
    cancelCountdown();
    awayBy = byMe ? 'me' : 'them';
    ready.me = false;
    ready.them = false;
    $('resumeButton').disabled = false;
    $('resumeButton').textContent = "I'm back, ready";
    showScreen('screenResume');
    updateResume();
}

function updateResume() {
    $('resumeTitle').textContent = awayBy === 'me' ? 'Paused: you left the page' : 'Paused: your opponent left the page';
    $('resumeStatus').textContent = readyText('The game goes on when you are both ready.') ?? 'Both ready.';
    if (ready.me && ready.them) {
        ready.me = false;
        ready.them = false;
        if (state.role === 'host') {
            session.send({ t: 'countdown' });
            startCountdown();
        }
    }
}

export function readyToResume() {
    if (!session || ready.me) {
        return;
    }
    ready.me = true;
    session.send({ t: 'ready' });
    $('resumeButton').disabled = true;
    $('resumeButton').textContent = 'Ready!';
    updateResume();
}

/**
 * A heartbeat on a timer, which keeps running in a background tab (animation frames do not): so a
 * player who switches tabs for a moment is not taken for gone. A closed tab is not always noticed by
 * WebRTC straight away, so silence for a few seconds means the other player left. Leaving the page
 * closes the connection properly, so the other player hears about it at once.
 */
export function initOnline() {
    setInterval(() => {
        if (!session) {
            return;
        }
        session.send({ t: 'ping' });
        if (state.kind === 'online' && lastHeard && performance.now() - lastHeard > R.onlineTimeout * 1000) {
            leaveOnline('The other player left.');
        }
    }, 1000);
    addEventListener('pagehide', () => session?.close());
}
