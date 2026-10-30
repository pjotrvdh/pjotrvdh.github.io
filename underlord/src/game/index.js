/**
 * Starts Underlord: reads the config, wires the page, loads the 3D models and runs the frame loop.
 * Loaded by src/main.js; the page is index.html.
 */
import config from '../config/index.js';
import { applyConfig } from './config.js';
import { initInput, keyPan } from './input.js';
import { newGame } from './map.js';
import { drawMini } from './minimap.js';
import { isMuted, setMuted } from './audio.js';
import { applyGameChanges, claimGame, refreshContinue, saveGame, syncGame } from './save.js';
import { G, app } from './state.js';
import { store } from './storage.js';
import { initUi, showTab, syncCpu, syncSound, ui } from './ui.js';
import { update } from './world.js';
import { showGallery } from '../render/gallery.js';
import { view } from '../render/view.js';

applyConfig(config);
initUi();
initInput();

const start = document.getElementById('bStart');
const label = start.textContent;
start.disabled = true;
document.getElementById('bContinue').disabled = true;

await view.init(document.getElementById('cv'), document.getElementById('stage'), document.getElementById('labels'), (done, total) => {
    start.textContent = 'Loading ' + Math.round(100 * done / total) + '%';
});

start.textContent = label;
start.disabled = false;
document.getElementById('bContinue').disabled = false;
if (new URLSearchParams(location.search).has('characters')) {
    // the character viewer instead of the game (see render/gallery.js)
    showGallery();
} else {
    startGame();
}

function startGame() {
    newGame();
    showTab(app.tab);
    syncCpu();
    refreshContinue();
    claimGame();
    // localStorage holds the running game (save.js): values changed there by hand show at once, and
    // what the game changes is written back twice a second.
    const check = store.watch((keys) => {
        if (keys.includes('option.sound') && isMuted() === store.readBool('option.sound', true)) {
            setMuted(!isMuted());
            syncSound();
        }
        const tab = store.read('option.tab');
        if (keys.includes('option.tab') && tab && document.getElementById('tab-' + tab)) {
            showTab(tab);
        }
        if (keys.some((key) => key.startsWith('game.') || key.startsWith('save.'))) {
            applyGameChanges(keys);
        }
    });
    setInterval(() => syncGame(check), 500);

    let last = performance.now();
    let uiT = 0;
    let autoT = 120;

    function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (app.running && !app.paused) {
            for (let k = 0; k < app.speed; k++) {
                update(dt);
            }
            if ((autoT -= dt) <= 0) {
                autoT = 120;
                saveGame(true);
            }
        }
        keyPan(dt);
        view.render(app.running && !app.paused ? dt * app.speed : 0, now / 1000);
        if ((uiT -= dt) <= 0 && G) {
            uiT = 0.2;
            ui();
            drawMini();
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}
