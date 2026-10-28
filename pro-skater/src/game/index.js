/**
 * Boots the game and runs the frame loop: loads the models, builds the park, then steps the skater at
 * a fixed rate (world.tickRate) and draws in between, interpolating the skater's position.
 */
import config from '../config/index.js';
import { createFollowCamera } from '../render/camera.js';
import { loadModels, triangles } from '../render/models.js';
import { addPark } from '../render/park.js';
import { createSkaterView } from '../render/skater.js';
import { createView } from '../render/view.js';
import { gamepadName, poll } from './input.js';
import { buildPark } from './park.js';
import { createSkater, resetSkater, stepSkater, wrapAngle } from './skater.js';
import { createTunePanel } from './tune.js';
import { flash, hideTitle, showError, showGamepad, showLoading, showPause, showTitle } from './ui.js';

async function boot() {
    const parkConfig = config.parks.warehouse;
    const pieceModels = [...new Set(Object.values(config.pieces).map((piece) => piece.model))];
    await loadModels([...pieceModels, ...config.assets.characters, config.assets.board], showLoading);

    const park = buildPark(parkConfig, config, Object.fromEntries(pieceModels.map((model) => [model, triangles(model)])));
    const view = createView(document.getElementById('stage'));
    addPark(view.scene, park, config);

    const spawnIndex = Math.floor(Math.random() * parkConfig.spawns.length);
    const skater = createSkater(park.spawn(spawnIndex));
    const skaterView = createSkaterView(view.scene, config, spawnIndex);
    const camera = createFollowCamera(view.camera, config);
    const params = new URLSearchParams(location.search);
    if (params.has('tune')) {
        createTunePanel(config);
    }
    if (params.has('debug')) {
        // For checking things from the browser console.
        window.proSkater = { skater, park, config, view, camera };
    }

    let mode = 'title';
    const step = 1 / config.world.tickRate;
    let pending = 0;
    let last = performance.now();
    const previous = { x: skater.x, y: skater.y, z: skater.z, heading: skater.heading };
    const pose = { ...previous };

    const start = () => {
        mode = 'play';
        hideTitle();
    };
    const setPaused = (paused) => {
        mode = paused ? 'pause' : 'play';
        showPause(paused, { resume: () => setPaused(false), reset: () => {
            reset();
            setPaused(false);
        } });
    };
    const reset = () => {
        resetSkater(skater, park.spawn(spawnIndex));
        Object.assign(previous, { x: skater.x, y: skater.y, z: skater.z, heading: skater.heading });
        camera.snap();
    };
    showTitle(start);

    function frame(now) {
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        const input = poll(config.controls);
        showGamepad(gamepadName());

        if (mode === 'title' && input.confirm) {
            start();
        } else if (mode !== 'title' && input.pause) {
            setPaused(mode === 'play');
        }

        if (mode === 'play') {
            if (input.reset) {
                reset();
            }
            pending += dt;
            while (pending >= step) {
                Object.assign(previous, { x: skater.x, y: skater.y, z: skater.z, heading: skater.heading });
                stepSkater(skater, input, park, config.physics, step);
                pending -= step;
            }
            for (const event of skater.events) {
                if (event === 'bail') {
                    flash('Bail!', 'bad');
                } else if (event === 'ollie') {
                    flash('Ollie');
                }
            }
            skater.events.length = 0;
        }

        const alpha = mode === 'play' ? pending / step : 1;
        pose.x = previous.x + (skater.x - previous.x) * alpha;
        pose.y = previous.y + (skater.y - previous.y) * alpha;
        pose.z = previous.z + (skater.z - previous.z) * alpha;
        pose.heading = previous.heading + wrapAngle(skater.heading - previous.heading) * alpha;
        skaterView.update(pose, skater, park, mode === 'pause' ? 0 : dt);
        camera.update(pose, skater, park, mode === 'pause' ? 0 : dt);
        view.render(pose);
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

boot().catch((error) => {
    console.error(error);
    showError(`The game could not start: ${error.message}`);
});
