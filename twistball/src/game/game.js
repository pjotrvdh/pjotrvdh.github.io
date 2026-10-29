/**
 * Twistball: 3D pong down a tunnel. The near paddle is see-through, the far paddle guards the other
 * end. Move a paddle as it hits the ball to put spin on it: the ball then curves on its way down the
 * tunnel. Three ways to play:
 *   solo    you (near) against the computer (far), through ten levels, with scores and high scores
 *   online  against someone else over the internet (online.js, net.js). The host plays the near paddle
 *           and runs the game; the guest only sends its paddle and draws what the host sends, mirrored,
 *           so both players see their own paddle at the front.
 *   demo    the computer against itself, match after match
 * This file holds the rules (serving, hits, points, levels, the end of a game) and the frame loop; the
 * shared state is context.js, the simulation physics.js, the page around it screens.js.
 */
import { isMuted, setMuted, sounds } from './audio.js';
import { $, CPUS, LEVELS, R, S, T, clock, far, isGuest, isSolo, levelData, near, renderer, sideKey, state } from './context.js';
import { addHighScore, qualifies } from './highscores.js';
import { initInput } from './input.js';
import { cleanCode, isValidCode } from './net.js';
import { emit, hostRoom, inRoom, initOnline, joinRoom, leaveOnline, openOnline, openReady, readyToResume, readyUp, send, sendState } from './online.js';
import { initPalettes } from './palette-menu.js';
import { accent, ageEffects, moveBall, moveHuman, movePaddles, spark } from './physics.js';
import { call, cancelCountdown, initMenus, renderHighScores, resetServeCountdown, setHint, showScreen, showServeCountdown, startCountdown, updateHud } from './screens.js';
import { initShare } from './share.js';
import { keepAwake } from './wake.js';

/* ---------- events: what the host also sends to the guest ---------- */

/** Plays an event: a sound, a call or a spark. `mirrored` when it comes from the host's point of view. */
export function playEvent(event, mirrored) {
    const side = event.side && ((event.side === 'near') !== Boolean(mirrored) ? near : far);
    switch (event.e) {
        case 'wall': sounds.wall(); break;
        case 'hit':
            (side === near ? sounds.playerHit : sounds.opponentHit)();
            spark(state.ball, accent(sideKey(side)));
            break;
        case 'point': {
            // `side` lost the point.
            if (side === far) {
                state.backFlash = 1;
                sounds.point();
                call(`Point! +${S.matchPoint}`, 'good');
            } else {
                call('Missed!', 'bad');
            }
            break;
        }
        case 'bonus': callBonus(side, event.words, event.points); break;
        case 'start': call('Online match', 'good'); break;
        case 'explode': explodePaddle(side); break;
        case 'end': showMatchEnd(side); break;
        default: break;
    }
}

/** Plays an event here and, as the host, sends it to the guest too. */
function happen(event) {
    playEvent(event, false);
    emit(event);
}

/**
 * Calls a bonus: yours as is, the other side's in its colour with its name. Not in CPU vs CPU: the
 * computer scores one on nearly every return, so the calls would never stop (the score still counts).
 */
function callBonus(side, words, points) {
    if (state.kind === 'demo') {
        return;
    }
    sounds.bonus();
    if (side === near) {
        call(`${words.join(' ')} +${points}`, 'bonus');
    } else {
        call(`${side.name}: ${words.join(' ')} +${points}`, 'them');
    }
}

/** Blows up a paddle (a missed ball; it is whole again at the next serve). */
function explodePaddle(side) {
    renderer.explode(sideKey(side), side);
    sounds.explosion();
}

/* ---------- starting ---------- */

/** Starts a game of the given kind: solo, online (as the host) or demo. */
export function startGame(kind) {
    sounds.unlock();
    state.kind = kind;
    state.score = 0;
    near.score = 0;
    far.score = 0;
    state.paused = false;
    near.human = kind !== 'demo';
    far.human = kind === 'online';
    near.name = { solo: 'You', online: 'You', demo: 'CPU 1' }[kind];
    far.name = { solo: 'Opponent', online: 'Opponent', demo: 'CPU 2' }[kind];
    if (kind === 'demo') {
        // CPU vs CPU: two different kinds of computer, picked at random for every match.
        const [first, second] = shuffled(Object.values(CPUS));
        near.cpu = first;
        far.cpu = second;
        near.name = first.name;
        far.name = second.name;
    }
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
            send({ t: 'start', level: state.level });
            emit({ e: 'start' });
        }
        startMatch();
    }
}

export function resetPaddles() {
    renderer.restore();
    for (const side of [near, far]) {
        Object.assign(side, { x: 0, y: 0, vx: 0, vy: 0 });
        Object.assign(side.target, { x: 0, y: 0 });
    }
}

/** A list in a random order. */
function shuffled(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
}

/** Solo: the computer you picked on the title screen, or a random one for every level (Auto). */
function pickSoloCpu() {
    const choice = $('cpuKind').value;
    far.cpu = CPUS[choice] ?? shuffled(Object.values(CPUS))[0];
    far.name = far.cpu.name;
}

function startLevel() {
    pickSoloCpu();
    far.lives = R.opponentLives;
    state.levelBonus = S.levelBonus;
    resetPaddles();
    showScreen(null);
    call(`Level ${state.level + 1} · ${far.cpu.name}`);
    toServe(near);
}

function startMatch() {
    resetPaddles();
    showScreen(null);
    call(state.kind === 'demo' ? `${near.cpu.name} vs ${far.cpu.name}` : 'Online match');
    toServe(Math.random() < 0.5 ? near : far);
}

/* ---------- serving, hits and points ---------- */

/** The ball waits on the serving paddle for a 3-2-1 countdown, then serves by itself. */
function toServe(server) {
    state.mode = 'serve';
    state.server = server;
    state.serveTimer = R.serveCountdown;
    resetServeCountdown();
    renderer.restore();
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

/**
 * Sends the ball down the tunnel from a paddle. A human puts spin on it by moving the paddle; the
 * computer adds a random spin that grows with the level.
 */
export function launch(side, isReturn) {
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
        // The computer's kind (cpus.js) sets how sharp, how curved and how hard its returns are.
        const cpu = side.cpu;
        ball.vx = (offsetX * R.angleFromOffset * 0.8 + (Math.random() - 0.5) * 0.6) * cpu.angle;
        ball.vy = (offsetY * R.angleFromOffset * 0.8 + (Math.random() - 0.5) * 0.4) * cpu.angle;
        ball.vz *= cpu.smash;
        const angle = Math.random() * Math.PI * 2;
        const wild = Math.random() < cpu.wild ? 2 : 1;
        const spin = (level.opponentSpin * cpu.spin + cpu.minSpin) * (1 + Math.random() * 1.5) * wild;
        ball.sx = Math.cos(angle) * spin;
        ball.sy = Math.sin(angle) * spin;
    }
    happen({ e: 'hit', side: sideKey(side) });

    // Solo: only your returns score. In a match (online, CPU vs CPU) both sides score their returns.
    if (isReturn && (side === near || !isSolo())) {
        scoreReturn(side, offsetX, offsetY);
    }
}

/** Points for a return, plus a bonus for a big curve or a hit in the middle of the paddle. */
function scoreReturn(side, offsetX, offsetY) {
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
    if (isSolo()) {
        state.score += points;
    } else {
        side.score += points;
    }
    if (words.length) {
        happen({ e: 'bonus', side: sideKey(side), words, points });
    }
}

/** A match ends when a side runs out of lives; then the higher score wins (on a tie, the side with lives left). */
function matchWinner(out) {
    const other = out === near ? far : near;

    return out.score > other.score ? out : other;
}

/** A paddle missed the ball: it loses a life and serves the next point. */
export function missed(side) {
    const other = side === near ? far : near;
    side.lives--;
    state.ballVisible = false;
    if (!isSolo()) {
        // In a match, taking a life scores too.
        other.score += S.matchPoint;
    }

    // Every miss breaks the paddle that missed; it is whole again at the next serve.
    happen({ e: 'explode', side: sideKey(side) });
    if (state.kind === 'online') {
        happen({ e: 'point', side: sideKey(side) });
    } else if (side === far) {
        state.backFlash = 1;
        sounds.point();
    }

    if (side.lives <= 0) {
        // Out of lives: after the paddle has broken apart, the level or match ends.
        if (isSolo()) {
            pauseThen(R.explosionTime, side === far ? levelCleared : () => endSolo(false));
        } else if (state.kind === 'demo') {
            endMatch(matchWinner(side));
        } else {
            state.mode = 'over';
            setTimeout(() => endMatch(matchWinner(side)), R.explosionTime * 1000);
        }

        return;
    }

    if (isSolo()) {
        call(side === far ? 'Point!' : 'Missed!', side === far ? 'good' : 'bad');
        pauseThen(0.8, () => toServe(near));
    } else {
        if (state.kind === 'demo') {
            call(`Point for ${other.name}! +${S.matchPoint}`, other === near ? 'good' : 'them');
        }
        pauseThen(0.8, () => toServe(side));
    }
}

let waitTimer = 0;
let waitThen = null;
/** Waits `seconds` of game time (paused time does not count), then runs `next`. */
function pauseThen(seconds, next) {
    state.mode = 'wait';
    waitTimer = seconds;
    waitThen = next;
    setHint();
}

/* ---------- the end of a level, game or match ---------- */

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
    $('matchSummary').hidden = true;
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
        call(`${winner.name} wins! ${near.score.toLocaleString('en')} – ${far.score.toLocaleString('en')}`, winner === near ? 'good' : 'them');
        setHint();
        pauseThen(R.demoRestartDelay, () => startGame('demo'));

        return;
    }
    // Online: the winner's side, from the host's point of view; the guest mirrors it.
    emit({ e: 'end', side: sideKey(winner) });
    showMatchEnd(winner);
}

/** Online: the end screen, for whoever won. */
function showMatchEnd(winner) {
    state.mode = 'over';
    state.ballVisible = false;
    (winner === near ? sounds.levelClear : sounds.gameOver)();
    $('endTitle').textContent = winner === near ? 'You win!' : 'Your opponent wins';
    $('endSummary').hidden = true;
    const outOfLives = near.lives <= 0 ? near : far;
    $('matchSummary').hidden = false;
    $('matchYou').textContent = near.score.toLocaleString('en');
    $('matchThem').textContent = far.score.toLocaleString('en');
    // Out of lives but still the winner: say so, it is the surprising case.
    $('matchNote').textContent = outOfLives === winner
        ? (winner === near ? 'You ran out of lives, but your trick shots won it.' : 'Your opponent ran out of lives, but their trick shots won it.')
        : '';
    $('scoreForm').hidden = true;
    $('endBoard').hidden = true;
    $('playAgain').textContent = 'Rematch';
    showScreen('screenEnd');
}

function playAgain() {
    if (state.kind !== 'online') {
        startGame(state.kind);
    } else if (inRoom()) {
        // A rematch needs both players ready again.
        openReady();
        readyUp();
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

/* ---------- pause, menu, sound ---------- */

export function togglePause() {
    // An online match cannot be paused: the other player is still playing.
    if (state.kind === 'online' || !['serve', 'play', 'wait'].includes(state.mode)) {
        return;
    }
    if (state.countingDown) {
        // Paused again during the countdown: back to the pause screen.
        cancelCountdown();
        showScreen('screenPause');
    } else if (!state.paused) {
        state.paused = true;
        showScreen('screenPause');
    } else {
        // Resume: a short countdown first, with the ball hidden.
        startCountdown();
    }
}

export function toMenu() {
    if (inRoom()) {
        leaveOnline();
    }
    state.mode = 'title';
    state.kind = 'solo';
    state.paused = false;
    cancelCountdown();
    state.ballVisible = false;
    $('hint').textContent = '';
    renderHighScores();
    showScreen('screenTitle');
}

export function toggleMute() {
    setMuted(!isMuted());
    $('mute').setAttribute('aria-pressed', String(isMuted()));
    $('mute').textContent = isMuted() ? 'Sound off' : 'Sound on';
}

/* ---------- the frame loop ---------- */

function update(dt) {
    if (isGuest()) {
        // The guest only moves its own paddle and tells the host where it is.
        moveHuman(near, dt, true);
        send({ t: 'input', x: near.target.x, y: near.target.y });
    } else {
        movePaddles(dt);
        if (state.mode === 'serve') {
            stickBallToServer();
            state.serveTimer -= dt;
            showServeCountdown(state.serveTimer);
            if (state.serveTimer <= 0) {
                showServeCountdown(null);
                launch(state.server, false);
            }
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
        if (state.role === 'host' && state.kind === 'online') {
            sendState();
        }
    }
    ageEffects(dt);
}

let hudTimer = 0;
function frame(now) {
    const dt = Math.min(0.05, (now - clock.last) / 1000);
    clock.last = now;
    if (!state.paused) {
        update(dt);
        hudTimer -= dt;
        if (hudTimer <= 0) {
            hudTimer = 0.1;
            updateHud();
        }
    }
    renderer.draw(state);
    keepAwake();
    requestAnimationFrame(frame);
}

/* ---------- start ---------- */

const BUTTONS = {
    startSolo: () => startGame('solo'),
    startOnline: openOnline,
    startDemo: () => startGame('demo'),
    hostRoom,
    onlineBack: toMenu,
    readyButton: readyUp,
    resumeButton: readyToResume,
    resumeLeave: toMenu,
    readyLeave: toMenu,
    continue: nextLevel,
    resume: togglePause,
    pauseMenu: toMenu,
    playAgain,
    endMenu: toMenu,
    pause: togglePause,
    mute: toggleMute,
};
for (const [id, onClick] of Object.entries(BUTTONS)) {
    $(id).addEventListener('click', onClick);
}
$('joinForm').addEventListener('submit', (event) => {
    event.preventDefault();
    joinRoom($('joinCode').value);
});
$('scoreForm').addEventListener('submit', saveScore);

initInput();
initOnline();
initShare();
initMenus();
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
