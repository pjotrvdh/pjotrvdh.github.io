/**
 * Twistball: 3D pong down a tunnel. The near paddle is see-through, the far paddle guards the other
 * end. Move a paddle as it hits the ball to put spin on it: the ball then curves on its way down the
 * tunnel. Three ways to play:
 *   solo    you (near) against the computer (far), through ten levels, with scores and high scores
 *   online  against someone else over the internet (see net.js). The host plays the near paddle and
 *           runs the game; the guest only sends its paddle and draws what the host sends, mirrored,
 *           so both players see their own paddle at the front.
 *   demo    the computer against itself, match after match
 */
import config from '../config/index.js';
import { createRenderer } from './render.js';
import { sounds, isMuted, setMuted } from './audio.js';
import { addHighScore, loadHighScores, qualifies } from './highscores.js';
import { cleanCode, createSession, isValidCode, randomCode } from './net.js';

const { tunnel: T, rules: R, scoring: S, levels: LEVELS, palettes: PALETTES } = config;
const $ = (id) => document.getElementById(id);

const canvas = $('stage');
const renderer = createRenderer(canvas, T);

/** The paddles may go as far as the walls allow. */
const limitX = T.halfWidth - T.paddleHalfWidth;
const limitY = T.halfHeight - T.paddleHalfHeight;
const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));

/** A paddle: where it is, how fast it moves (that becomes spin), who controls it, and its lives. */
function paddle(name, z) {
    return { name, z, x: 0, y: 0, vx: 0, vy: 0, target: { x: 0, y: 0 }, human: false, lives: 0, serveTimer: 0 };
}

const near = paddle('You', 0);
const far = paddle('Opponent', T.depth);

const state = {
    /** solo | online | demo */
    kind: 'solo',
    /** Online only: host or guest. */
    role: null,
    /** title | serve | play | wait | levelClear | over */
    mode: 'title',
    paused: false,
    score: 0,
    level: 0,
    /** Solo: the level this game started on (you can pick it on the title screen). */
    startLevel: 0,
    levelBonus: S.levelBonus,
    rallySpeed: 1,
    /** The paddle that serves next. */
    server: near,
    player: near,
    opponent: far,
    ball: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, sx: 0, sy: 0 },
    ballVisible: false,
    sparks: [],
    backFlash: 0,
};

const keys = new Set();
const isSolo = () => state.kind === 'solo';
const isGuest = () => state.role === 'guest';

/* ---------- online ---------- */

let session = null;
/** When the last message from the other player arrived; both sides send many per second. */
let lastHeard = 0;
/** Host: things that happened this frame (sounds, calls, sparks), sent to the guest with the state. */
let events = [];

/** Host: plays an event here and queues it for the guest. */
function emit(event) {
    if (state.role === 'host') {
        events.push(event);
    }
}

function sendState() {
    const ball = state.ball;
    session.send({
        t: 'state',
        mode: state.mode,
        server: state.server === near ? 'near' : 'far',
        ball: state.ballVisible ? [ball.x, ball.y, ball.z] : null,
        near: [near.x, near.y, near.lives],
        far: [far.x, far.y, far.lives],
        level: state.level,
        events,
    });
    events = [];
}

/** Guest: what the host sees as near is far here, and its left is our right. */
const mirror = (x) => -x;
const otherSide = (side) => (side === 'near' ? far : near);
const sameSide = (side) => (side === 'near' ? near : far);

function applyState(message) {
    state.mode = message.mode;
    state.level = message.level;
    state.server = otherSide(message.server);
    // Our own paddle is drawn from our own input (see update), so it never lags; we only take the lives.
    near.lives = message.far[2];
    far.x = mirror(message.near[0]);
    far.y = message.near[1];
    far.lives = message.near[2];
    state.ballVisible = Boolean(message.ball);
    if (message.ball) {
        state.ball.x = mirror(message.ball[0]);
        state.ball.y = message.ball[1];
        state.ball.z = T.depth - message.ball[2];
    }
    for (const event of message.events) {
        playEvent(event, true);
    }
    setHint();
}

/** Plays an event: a sound, a call or a spark. `mirrored` when it comes from the host's point of view. */
function playEvent(event, mirrored) {
    const side = event.side && (mirrored ? otherSide(event.side) : sameSide(event.side));
    switch (event.e) {
        case 'wall': sounds.wall(); break;
        case 'hit':
            (side === near ? sounds.playerHit : sounds.opponentHit)();
            spark(state.ball, side === near ? accent('near') : accent('far'));
            break;
        case 'point': {
            // `side` lost the point.
            if (side === far) {
                state.backFlash = 1;
                sounds.point();
                call('Point!', 'good');
            } else {
                sounds.miss();
                call('Missed!', 'bad');
            }
            break;
        }
        case 'start': call('Online match', 'good'); break;
        case 'end': showMatchEnd(side); break;
        default: break;
    }
}

function openOnline() {
    showScreen('screenOnline');
    $('onlineStatus').textContent = '';
    $('roomBox').hidden = true;
    $('joinCode').value = '';
}

function leaveOnline(reason = '') {
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
            if (state.role === 'host') {
                startGame('online');
            } else {
                $('onlineStatus').textContent = 'Connected. The match starts in a moment.';
                session.send({ t: 'hello' });
            }
        },
        onMessage: (message) => {
            lastHeard = performance.now();
            if (state.role === 'host') {
                if (message.t === 'input') {
                    far.target.x = clamp(mirror(message.x), limitX);
                    far.target.y = clamp(message.y, limitY);
                } else if (message.t === 'serve') {
                    serve(far);
                } else if (message.t === 'rematch' && state.mode === 'over') {
                    startGame('online');
                }
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

function hostRoom() {
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
    $('roomBox').hidden = false;
    $('onlineStatus').textContent = 'Waiting for the other player…';
}

function joinRoom(code) {
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
    state.level = message.level;
    near.human = true;
    far.human = true;
    near.name = 'You';
    far.name = 'Opponent';
    resetPaddles();
    showScreen(null);
    call('Online match', 'good');
    updateHud();
}

/* ---------- HUD and screens ---------- */

function lives(paddleState, max) {
    return '●'.repeat(Math.max(0, paddleState.lives)) + '○'.repeat(Math.max(0, max - paddleState.lives));
}

function updateHud() {
    const max = isSolo() ? R.playerLives : R.matchLives;
    const farMax = isSolo() ? R.opponentLives : R.matchLives;
    $('score').textContent = String(state.score).padStart(6, '0');
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
}

let callTimer = 0;
/** A short call in the middle of the screen, such as "Curve bonus!". Screen readers hear it too. */
function call(text, tone = '') {
    const element = $('call');
    element.textContent = text;
    element.className = `call show ${tone}`;
    clearTimeout(callTimer);
    callTimer = setTimeout(() => element.classList.remove('show'), 1100);
}

function showScreen(id) {
    for (const screen of document.querySelectorAll('.screen')) {
        screen.hidden = screen.id !== id;
    }
    $('overlay').hidden = !id;
    const focus = id && $(id).querySelector('[autofocus], button, input');
    focus?.focus();
}

function renderHighScores() {
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

function setHint() {
    let hint = '';
    if (state.mode === 'serve') {
        if (state.server === near && near.human) {
            hint = 'Click, tap or press Space to serve';
        } else if (state.server === far && far.human) {
            hint = 'Waiting for your opponent to serve';
        }
    } else if (state.kind === 'demo' && state.mode !== 'over') {
        hint = 'Press Esc to stop watching';
    }
    $('hint').textContent = hint;
}

/* ---------- game flow ---------- */

/** Starts a game of the given kind: solo, online (as the host) or demo. */
function startGame(kind) {
    sounds.unlock();
    state.kind = kind;
    state.score = 0;
    state.paused = false;
    near.human = kind !== 'demo';
    far.human = kind === 'online';
    near.name = { solo: 'You', online: 'You', demo: 'CPU 1' }[kind];
    far.name = { solo: 'Opponent', online: 'Opponent', demo: 'CPU 2' }[kind];
    if (kind === 'solo') {
        state.level = Number($('startLevel').value) - 1;
        state.startLevel = state.level;
        near.lives = R.playerLives;
        startLevel();
    } else {
        state.level = Number($('speed').value) - 1;
        near.lives = R.matchLives;
        far.lives = R.matchLives;
        if (kind === 'online') {
            session.send({ t: 'start', level: state.level });
            emit({ e: 'start' });
        }
        startMatch();
    }
}

function resetPaddles() {
    for (const side of [near, far]) {
        Object.assign(side, { x: 0, y: 0, vx: 0, vy: 0 });
        Object.assign(side.target, { x: 0, y: 0 });
    }
}

function startLevel() {
    far.lives = R.opponentLives;
    state.levelBonus = S.levelBonus;
    resetPaddles();
    showScreen(null);
    call(`Level ${state.level + 1}`);
    toServe(near);
}

function startMatch() {
    resetPaddles();
    showScreen(null);
    call(state.kind === 'demo' ? 'CPU vs CPU' : 'Online match');
    toServe(Math.random() < 0.5 ? near : far);
}

/** The ball waits on the serving paddle until it serves. */
function toServe(server) {
    state.mode = 'serve';
    state.server = server;
    server.serveTimer = R.cpuServeDelay;
    state.rallySpeed = 1;
    state.ballVisible = true;
    Object.assign(state.ball, { vx: 0, vy: 0, vz: 0, sx: 0, sy: 0 });
    stickBallToServer();
    setHint();
    updateHud();
}

function stickBallToServer() {
    const server = state.server;
    const offset = server === near ? T.ballRadius : -T.ballRadius;
    Object.assign(state.ball, { x: server.x, y: server.y, z: server.z + offset });
}

/** A human serve. Online, the guest's serve arrives as a message and is played on the host. */
function serve(side) {
    if (isGuest()) {
        if (side === near && state.mode === 'serve' && state.server === near) {
            session.send({ t: 'serve' });
        }

        return;
    }
    if (state.mode !== 'serve' || state.paused || state.server !== side || !side.human) {
        return;
    }
    launch(side, false);
}

function levelData() {
    return LEVELS[state.level];
}

/**
 * Sends the ball down the tunnel from a paddle. A human puts spin on it by moving the paddle; the
 * computer adds a random spin that grows with the level.
 */
function launch(side, isReturn) {
    const ball = state.ball;
    const level = levelData();
    const direction = side === near ? 1 : -1;
    const offsetX = (ball.x - side.x) / T.paddleHalfWidth;
    const offsetY = (ball.y - side.y) / T.paddleHalfHeight;

    state.mode = 'play';
    setHint();
    if (isReturn) {
        state.rallySpeed *= R.rallySpeedUp;
    }
    ball.z = side.z;
    ball.vz = direction * level.ballSpeed * state.rallySpeed;
    if (side.human) {
        ball.vx = offsetX * R.angleFromOffset + side.vx * 0.15;
        ball.vy = offsetY * R.angleFromOffset + side.vy * 0.15;
        ball.sx = side.vx * R.spinFromPaddle * level.curve;
        ball.sy = side.vy * R.spinFromPaddle * level.curve;
    } else {
        ball.vx = offsetX * R.angleFromOffset * 0.8 + (Math.random() - 0.5) * 0.6;
        ball.vy = offsetY * R.angleFromOffset * 0.8 + (Math.random() - 0.5) * 0.4;
        const angle = Math.random() * Math.PI * 2;
        const spin = level.opponentSpin * (1 + Math.random() * 1.5);
        ball.sx = Math.cos(angle) * spin;
        ball.sy = Math.sin(angle) * spin;
    }
    playEvent({ e: 'hit', side: side === near ? 'near' : 'far' }, false);
    emit({ e: 'hit', side: side === near ? 'near' : 'far' });

    if (isReturn && isSolo() && side === near) {
        scoreReturn(offsetX, offsetY);
    }
}

/** Solo: points for your return, plus a bonus for a big curve or a hit in the middle of the paddle. */
function scoreReturn(offsetX, offsetY) {
    const ball = state.ball;
    let points = S.hit;
    const words = [];
    const spin = Math.hypot(ball.sx, ball.sy);
    if (spin >= S.superCurveThreshold) {
        points += S.superCurveBonus;
        words.push('Super curve!');
    } else if (spin >= S.curveThreshold) {
        points += S.curveBonus;
        words.push('Curve bonus!');
    }
    if (Math.abs(offsetX) <= S.accuracyZone && Math.abs(offsetY) <= S.accuracyZone) {
        points += S.accuracyBonus;
        words.push('Bullseye!');
    }
    state.score += points;
    if (words.length) {
        sounds.bonus();
        call(`${words.join(' ')} +${points}`, 'bonus');
    }
}

/** A paddle missed the ball: it loses a life and serves the next point. */
function missed(side) {
    const other = side === near ? far : near;
    side.lives--;
    state.ballVisible = false;

    if (state.kind === 'online') {
        playEvent({ e: 'point', side: side === near ? 'near' : 'far' }, false);
        emit({ e: 'point', side: side === near ? 'near' : 'far' });
    } else if (side === far) {
        state.backFlash = 1;
        sounds.point();
    } else {
        sounds.miss();
        spark(state.ball, '255, 138, 106');
    }

    if (side.lives <= 0) {
        if (isSolo()) {
            if (side === far) {
                levelCleared();
            } else {
                endSolo(false);
            }
        } else {
            endMatch(other);
        }

        return;
    }

    if (isSolo()) {
        call(side === far ? 'Point!' : 'Missed!', side === far ? 'good' : 'bad');
        pauseThen(0.8, () => toServe(near));
    } else {
        if (state.kind === 'demo') {
            call(`Point for ${other.name}!`, other === near ? 'good' : 'them');
        }
        pauseThen(0.8, () => toServe(side));
    }
}

let waitTimer = 0;
let waitThen = null;
function pauseThen(seconds, next) {
    state.mode = 'wait';
    waitTimer = seconds;
    waitThen = next;
    setHint();
}

function levelCleared() {
    const bonus = Math.ceil(state.levelBonus);
    state.score += bonus;
    updateHud();
    sounds.levelClear();
    if (state.level + 1 >= LEVELS.length) {
        endSolo(true);

        return;
    }
    state.mode = 'levelClear';
    $('clearTitle').textContent = `Level ${state.level + 1} cleared`;
    $('clearBonus').textContent = bonus.toLocaleString('en');
    $('clearScore').textContent = state.score.toLocaleString('en');
    showScreen('screenClear');
}

function nextLevel() {
    state.level++;
    startLevel();
}

function endSolo(won) {
    state.mode = 'over';
    state.ballVisible = false;
    updateHud();
    if (!won) {
        sounds.gameOver();
    }
    $('endTitle').textContent = won ? 'You beat all ten levels!' : 'Game over';
    $('endSummary').hidden = false;
    $('endScore').textContent = state.score.toLocaleString('en');
    $('endLevel').textContent = state.level + 1;
    const entry = qualifies(state.score, R.highScores);
    $('scoreForm').hidden = !entry;
    $('endBoard').hidden = entry;
    $('playAgain').textContent = 'Play again';
    renderHighScores();
    showScreen('screenEnd');
}

function endMatch(winner) {
    state.mode = 'over';
    state.ballVisible = false;
    updateHud();
    if (state.kind === 'demo') {
        // Watching: announce the winner and start the next match by itself.
        sounds.levelClear();
        call(`${winner.name} wins!`, winner === near ? 'good' : 'them');
        setHint();
        pauseThen(R.demoRestartDelay, () => startGame('demo'));

        return;
    }
    // Online: the winner's side, from the host's point of view; the guest mirrors it.
    emit({ e: 'end', side: winner === near ? 'near' : 'far' });
    showMatchEnd(winner);
}

/** Online: the end screen, for whoever won. */
function showMatchEnd(winner) {
    state.mode = 'over';
    state.ballVisible = false;
    (winner === near ? sounds.levelClear : sounds.gameOver)();
    $('endTitle').textContent = winner === near ? 'You win!' : 'Your opponent wins';
    $('endSummary').hidden = true;
    $('scoreForm').hidden = true;
    $('endBoard').hidden = true;
    $('playAgain').textContent = 'Rematch';
    showScreen('screenEnd');
}

function playAgain() {
    if (state.kind !== 'online') {
        startGame(state.kind);
    } else if (isGuest()) {
        session?.send({ t: 'rematch' });
        $('playAgain').textContent = 'Waiting for your opponent…';
    } else {
        startGame('online');
    }
}

function saveScore(event) {
    event.preventDefault();
    const name = $('playerName').value.trim().slice(0, 12) || 'Anonymous';
    try {
        localStorage.setItem('twistball-name', name);
    } catch {
        // Not remembering the name is fine.
    }
    addHighScore({ name, score: state.score, level: state.level + 1, from: state.startLevel + 1, date: new Date().toISOString() }, R.highScores);
    $('scoreForm').hidden = true;
    $('endBoard').hidden = false;
    renderHighScores();
    $('playAgain').focus();
}

function togglePause() {
    // An online match cannot be paused: the other player is still playing.
    if (state.kind === 'online' || !['serve', 'play', 'wait'].includes(state.mode)) {
        return;
    }
    state.paused = !state.paused;
    showScreen(state.paused ? 'screenPause' : null);
}

function toMenu() {
    if (session) {
        leaveOnline();
    }
    state.mode = 'title';
    state.kind = 'solo';
    state.paused = false;
    state.ballVisible = false;
    $('hint').textContent = '';
    renderHighScores();
    showScreen('screenTitle');
}

/* ---------- simulation ---------- */

/** The palette colour of a side, as "r, g, b" for the hit sparks. */
function accent(side) {
    return renderer.palette()[side === 'near' ? 'nearRgb' : 'farRgb'];
}

function spark(ball, color) {
    state.sparks.push({ x: ball.x, y: ball.y, z: ball.z, age: 0, life: 0.45, color });
}

const MOVE_KEYS = {
    left: ['a', 'ArrowLeft'],
    right: ['d', 'ArrowRight'],
    up: ['w', 'ArrowUp'],
    down: ['s', 'ArrowDown'],
};
const pressed = (direction) => MOVE_KEYS[direction].some((key) => keys.has(key));

/** Moves a human's paddle towards its target: the pointer or the keys here, or the network online. */
function moveHuman(side, dt, useKeys) {
    if (useKeys) {
        const keySpeed = 2.6 * dt;
        if (pressed('left')) side.target.x -= keySpeed;
        if (pressed('right')) side.target.x += keySpeed;
        if (pressed('up')) side.target.y -= keySpeed;
        if (pressed('down')) side.target.y += keySpeed;
        side.target.x = clamp(side.target.x, limitX);
        side.target.y = clamp(side.target.y, limitY);
    }

    const oldX = side.x;
    const oldY = side.y;
    const follow = Math.min(1, dt * 30);
    side.x += (side.target.x - side.x) * follow;
    side.y += (side.target.y - side.y) * follow;
    // The paddle's speed, smoothed a little, is what puts spin on the ball.
    const smoothing = Math.min(1, dt * 18);
    side.vx += ((side.x - oldX) / dt - side.vx) * smoothing;
    side.vy += ((side.y - oldY) / dt - side.vy) * smoothing;
}

/** The computer: reads the ball on its way in (better on later levels) and moves at a capped speed. */
function moveCpu(side, dt) {
    const ball = state.ball;
    const level = levelData();
    const incoming = side === near ? ball.vz < 0 : ball.vz > 0;
    let aimX = 0;
    let aimY = 0;
    if (state.mode === 'play' && incoming) {
        const time = Math.abs((side.z - ball.z) / ball.vz);
        const predictedX = clamp(ball.x + ball.vx * time, T.halfWidth);
        const predictedY = clamp(ball.y + ball.vy * time, T.halfHeight);
        aimX = ball.x + (predictedX - ball.x) * level.opponentAim;
        aimY = ball.y + (predictedY - ball.y) * level.opponentAim;
    } else if (state.mode === 'play') {
        aimX = ball.x * 0.3;
        aimY = ball.y * 0.3;
    }
    const step = level.opponentSpeed * dt;
    const oldX = side.x;
    const oldY = side.y;
    side.x = clamp(side.x + clamp(aimX - side.x, step), limitX);
    side.y = clamp(side.y + clamp(aimY - side.y, step), limitY);
    side.vx = (side.x - oldX) / dt;
    side.vy = (side.y - oldY) / dt;

    if (state.mode === 'serve' && state.server === side) {
        side.serveTimer -= dt;
        if (side.serveTimer <= 0) {
            launch(side, false);
        }
    }
}

function movePaddles(dt) {
    if (near.human) {
        moveHuman(near, dt, true);
    } else {
        moveCpu(near, dt);
    }
    if (far.human) {
        // Online: the opponent's target comes from the network.
        moveHuman(far, dt, false);
    } else {
        moveCpu(far, dt);
    }
}

function hits(side, ball) {
    return Math.abs(ball.x - side.x) <= T.paddleHalfWidth + T.ballRadius
        && Math.abs(ball.y - side.y) <= T.paddleHalfHeight + T.ballRadius;
}

function moveBall(dt) {
    const ball = state.ball;
    ball.vx += ball.sx * dt;
    ball.vy += ball.sy * dt;
    const decay = Math.pow(R.spinDecayPerSecond, dt);
    ball.sx *= decay;
    ball.sy *= decay;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.z += ball.vz * dt;

    // Walls: bounce, and the curve turns around with the ball.
    const maxX = T.halfWidth - T.ballRadius;
    const maxY = T.halfHeight - T.ballRadius;
    let bounced = false;
    if (Math.abs(ball.x) > maxX) {
        ball.x = Math.sign(ball.x) * maxX;
        ball.vx = -ball.vx;
        ball.sx = -ball.sx;
        bounced = true;
    }
    if (Math.abs(ball.y) > maxY) {
        ball.y = Math.sign(ball.y) * maxY;
        ball.vy = -ball.vy;
        ball.sy = -ball.sy;
        bounced = true;
    }
    if (bounced) {
        sounds.wall();
        emit({ e: 'wall' });
    }

    if (ball.vz < 0 && ball.z <= near.z) {
        if (hits(near, ball)) {
            launch(near, true);
        } else {
            missed(near);
        }
    } else if (ball.vz > 0 && ball.z >= far.z) {
        if (hits(far, ball)) {
            launch(far, true);
        } else {
            missed(far);
        }
    }
}

function update(dt) {
    if (isGuest()) {
        // The guest only moves its own paddle and tells the host where it is.
        moveHuman(near, dt, true);
        session?.send({ t: 'input', x: near.target.x, y: near.target.y });
    } else {
        movePaddles(dt);
        if (state.mode === 'serve') {
            stickBallToServer();
        }
        if (state.mode === 'play') {
            // Small steps, so a fast ball never skips past a paddle or a wall.
            const steps = Math.ceil(dt / (1 / 240));
            for (let step = 0; step < steps && state.mode === 'play'; step++) {
                moveBall(dt / steps);
            }
            if (isSolo()) {
                state.levelBonus = Math.max(0, state.levelBonus - S.levelBonusPerSecond * dt);
            }
        }
        if (state.mode === 'wait') {
            waitTimer -= dt;
            if (waitTimer <= 0) {
                waitThen();
            }
        }
        if (state.role === 'host' && session?.isOpen && state.kind === 'online') {
            sendState();
        }
    }
    for (const item of state.sparks) {
        item.age += dt;
    }
    state.sparks = state.sparks.filter((item) => item.age < item.life);
    state.backFlash = Math.max(0, state.backFlash - dt * 2.5);
}

let last = performance.now();
let hudTimer = 0;
function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!state.paused) {
        update(dt);
        hudTimer -= dt;
        if (hudTimer <= 0) {
            hudTimer = 0.1;
            updateHud();
        }
    }
    renderer.draw(state);
    requestAnimationFrame(frame);
}

/* ---------- palettes ---------- */

function applyPalette(key) {
    const palette = PALETTES[key] ?? Object.values(PALETTES)[0];
    renderer.setPalette(palette);
    for (const [name, value] of Object.entries(palette.ui)) {
        document.documentElement.style.setProperty(`--${name}`, value);
    }
    try {
        localStorage.setItem('twistball-palette', key);
    } catch {
        // Not remembering the palette is fine.
    }
}

function initPalettes() {
    const select = $('palette');
    select.replaceChildren(...Object.entries(PALETTES).map(([key, palette]) => Object.assign(document.createElement('option'), { value: key, textContent: palette.name })));
    let saved = null;
    try {
        saved = localStorage.getItem('twistball-palette');
    } catch {
        // Use the first palette.
    }
    select.value = PALETTES[saved] ? saved : Object.keys(PALETTES)[0];
    applyPalette(select.value);
    select.addEventListener('change', () => applyPalette(select.value));
}

/* ---------- input ---------- */

function pointerToTarget(event) {
    if (!near.human) {
        return;
    }
    const rect = canvas.getBoundingClientRect();
    const point = renderer.toTunnel(event.clientX - rect.left, event.clientY - rect.top);
    near.target.x = clamp(point.x, limitX);
    near.target.y = clamp(point.y, limitY);
}

canvas.addEventListener('pointermove', pointerToTarget);
canvas.addEventListener('pointerdown', (event) => {
    pointerToTarget(event);
    sounds.unlock();
    serve(near);
});

const ALL_MOVE_KEYS = Object.values(MOVE_KEYS).flat();
addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
        return;
    }
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const playing = $('overlay').hidden;
    if (ALL_MOVE_KEYS.includes(key) && playing) {
        keys.add(key);
        event.preventDefault();
    } else if (key === ' ' && playing) {
        event.preventDefault();
        sounds.unlock();
        serve(near);
    } else if (key === 'Escape' && state.kind === 'demo' && state.mode !== 'title') {
        toMenu();
    } else if (key === 'p' || key === 'Escape') {
        togglePause();
    } else if (key === 'm') {
        toggleMute();
    }
});
addEventListener('keyup', (event) => keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key));
addEventListener('blur', () => {
    keys.clear();
    if (state.kind === 'solo' && ['serve', 'play', 'wait'].includes(state.mode) && !state.paused) {
        togglePause();
    }
});
addEventListener('resize', () => renderer.resize());
// Leaving the page closes the connection properly, so the other player hears about it at once.
addEventListener('pagehide', () => session?.close());

// A heartbeat on a timer, which keeps running in a background tab (animation frames do not): so a
// player who switches tabs for a moment is not taken for gone. A closed tab is not always noticed
// by WebRTC straight away, so silence for a few seconds means the other player left.
setInterval(() => {
    if (!session) {
        return;
    }
    session.send({ t: 'ping' });
    if (state.kind === 'online' && lastHeard && performance.now() - lastHeard > R.onlineTimeout * 1000) {
        leaveOnline('The other player left.');
    }
}, 1000);

function toggleMute() {
    setMuted(!isMuted());
    $('mute').setAttribute('aria-pressed', String(isMuted()));
    $('mute').textContent = isMuted() ? 'Sound off' : 'Sound on';
}

$('startSolo').addEventListener('click', () => startGame('solo'));
$('startOnline').addEventListener('click', openOnline);
$('startDemo').addEventListener('click', () => startGame('demo'));
$('hostRoom').addEventListener('click', hostRoom);
$('joinForm').addEventListener('submit', (event) => {
    event.preventDefault();
    joinRoom($('joinCode').value);
});
$('copyLink').addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText($('roomLink').value);
        $('onlineStatus').textContent = 'Link copied. Waiting for the other player…';
    } catch {
        $('roomLink').select();
    }
});
$('onlineBack').addEventListener('click', toMenu);
$('continue').addEventListener('click', nextLevel);
$('resume').addEventListener('click', togglePause);
$('pauseMenu').addEventListener('click', toMenu);
$('playAgain').addEventListener('click', playAgain);
$('endMenu').addEventListener('click', toMenu);
$('pause').addEventListener('click', togglePause);
$('mute').addEventListener('click', toggleMute);
$('scoreForm').addEventListener('submit', saveScore);
$('speed').value = String(R.matchLevel);
$('startLevel').replaceChildren(...LEVELS.map((_, index) => Object.assign(document.createElement('option'), { value: String(index + 1), textContent: String(index + 1) })));
try {
    $('startLevel').value = localStorage.getItem('twistball-start-level') ?? '1';
} catch {
    // Start at level 1.
}
if (!$('startLevel').value) {
    $('startLevel').value = '1';
}
$('startLevel').addEventListener('change', () => {
    try {
        localStorage.setItem('twistball-start-level', $('startLevel').value);
    } catch {
        // Not remembering it is fine.
    }
});
try {
    $('playerName').value = localStorage.getItem('twistball-name') ?? '';
} catch {
    // No remembered name.
}

initPalettes();
renderHighScores();
updateHud();
showScreen('screenTitle');
requestAnimationFrame(frame);

// A shared link (?room=CODE) joins that room straight away.
const linkedRoom = cleanCode(new URLSearchParams(location.search).get('room') ?? '');
if (isValidCode(linkedRoom)) {
    openOnline();
    $('joinCode').value = linkedRoom;
    joinRoom(linkedRoom);
}
