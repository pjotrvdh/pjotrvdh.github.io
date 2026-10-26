/**
 * What the pointer is about to do: an outline on the tile under it (light = the tool works there,
 * red = it does not) and, while dragging, the rectangle with every tile it would change.
 */
import * as THREE from 'three';
import { inb, ix } from '../game/constants.js';
import { affects, toolValid } from '../game/actions.js';
import { G, app } from '../game/state.js';
import { solid } from '../game/tiles.js';
import { dragRect } from '../game/ui.js';
import { Instances, place } from './instances.js';
import { TOP } from './terrain.js';

/** The height of the surface you see on tile i: block tops (undiscovered tiles look solid) or the floor. */
export const surface = (i) => (!G.seen[i] || solid(i) ? TOP : 0);

const m = new THREE.Matrix4();
const col = new THREE.Color();
const DRAG = { mark: '#e3b23c', unmark: '#e0483c', sell: '#e0483c' };

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
        this.rect = square('#e3b23c');
        scene.add(this.rect);
        this.tiles = new Instances(scene, [{
            geometry: new THREE.PlaneGeometry(0.98, 0.98).rotateX(-Math.PI / 2),
            material: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.3, depthTest: false, depthWrite: false }),
        }], { renderOrder: 19 });
    }

    update() {
        const R = dragRect();
        this.tiles.begin();
        this.rect.visible = false;
        this.outline.visible = false;
        if (R && app.drag) {
            col.set(DRAG[app.drag.mode] || '#bedca0');
            let top = 0;
            for (let y = R.y0; y <= R.y1; y++) {
                for (let x = R.x0; x <= R.x1; x++) {
                    const i = ix(x, y);
                    top = Math.max(top, surface(i));
                    if (affects(app.drag.mode, i)) {
                        this.tiles.add(place(x + 0.5, surface(i) + 0.03, y + 0.5, 0, 1, m), col);
                    }
                }
            }
            this.rect.visible = true;
            this.rect.material.color.copy(col);
            this.rect.position.set(R.x0, top + 0.05, R.y0);
            this.rect.scale.set(R.x1 - R.x0 + 1, 1, R.y1 - R.y0 + 1);
        } else if (app.hover.in && G && inb(app.hover.x, app.hover.y)) {
            const i = ix(app.hover.x, app.hover.y);
            const ok = toolValid(i, app.hover.unit && app.hover.unit.side === 0 ? app.hover.unit : null);
            this.outline.visible = true;
            this.outline.material.color.set(ok ? '#f0dcb4' : '#e0483c');
            this.outline.position.set(app.hover.x, surface(i) + 0.04, app.hover.y);
        }
        this.tiles.end();
    }
}
