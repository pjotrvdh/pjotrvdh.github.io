/**
 * An outline on the tile under the pointer: light when the current tool works there, red when it does
 * not. Painting (marking, building, selling) changes tiles as the pointer sweeps over them, so there is
 * no drag preview.
 */
import * as THREE from 'three';
import { inb, ix } from '../game/constants.js';
import { toolValid } from '../game/actions.js';
import { G, app } from '../game/state.js';
import { solid } from '../game/tiles.js';
import { FOG_Y } from './fog.js';
import { TOP } from './terrain.js';

/** The height of the surface you see on tile i: block tops, the clouds, or the floor. */
export const surface = (i) => (!G.seen[i] ? FOG_Y : solid(i) ? TOP : 0);

function square(color) {
    const pts = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([x, z]) => new THREE.Vector3(x, 0, z));
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, depthTest: false }));
    line.renderOrder = 20;

    return line;
}

export class Cursor {
    constructor(scene) {
        this.outline = square('#f0dcb4');
        scene.add(this.outline);
    }

    update() {
        this.outline.visible = false;
        if (app.hover.in && G && inb(app.hover.x, app.hover.y)) {
            const i = ix(app.hover.x, app.hover.y);
            const ok = toolValid(i, app.hover.unit && app.hover.unit.side === 0 ? app.hover.unit : null);
            this.outline.visible = true;
            this.outline.material.color.set(ok ? '#f0dcb4' : '#e0483c');
            this.outline.position.set(app.hover.x, surface(i) + 0.04, app.hover.y);
        }
    }
}
