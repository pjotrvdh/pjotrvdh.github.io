/**
 * Many copies of one model in a few draw calls: an InstancedMesh per mesh of the model. Fill it with
 * begin(), add() per copy (a matrix and an optional tint) and end(). It grows as needed.
 */
import * as THREE from 'three';
import { parts } from './models.js';

const WHITE = new THREE.Color(1, 1, 1);
const m4 = new THREE.Matrix4();

export class Instances {
    /**
     * @param {THREE.Object3D} parent
     * @param {string|{geometry: THREE.BufferGeometry, material: THREE.Material}[]} source A model file, or meshes.
     * @param {{transparent?: boolean, opacity?: number, castShadow?: boolean, renderOrder?: number}} [options]
     */
    constructor(parent, source, options = {}) {
        this.parent = parent;
        this.source = source;
        this.options = options;
        this.capacity = 0;
        this.count = 0;
        this.meshes = [];
        this.parts = typeof source === 'string' ? parts(source) : source.map((p) => ({ matrix: new THREE.Matrix4(), ...p }));
        this.grow(16);
    }

    grow(capacity) {
        for (const m of this.meshes) {
            this.parent.remove(m);
            m.dispose();
        }
        this.capacity = capacity;
        this.meshes = this.parts.map((p) => {
            let material = p.material;
            if (this.options.transparent) {
                material = material.clone();
                material.transparent = true;
                material.opacity = this.options.opacity ?? 1;
                material.depthWrite = false;
            }
            const mesh = new THREE.InstancedMesh(p.geometry, material, capacity);
            mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
            mesh.count = 0;
            mesh.frustumCulled = false;
            mesh.renderOrder = this.options.renderOrder ?? 0;
            mesh.userData.local = p.matrix;
            this.parent.add(mesh);

            return mesh;
        });
    }

    begin() {
        this.count = 0;
    }

    /** One more copy at `matrix` (model root to world), tinted with `color` (multiplied). */
    add(matrix, color = WHITE) {
        if (this.count >= this.capacity) {
            const keep = this.meshes.map((m) => ({ matrix: m.instanceMatrix.array.slice(), color: m.instanceColor.array.slice() }));
            this.grow(this.capacity * 2);
            this.meshes.forEach((m, k) => {
                m.instanceMatrix.array.set(keep[k].matrix);
                m.instanceColor.array.set(keep[k].color);
            });
        }
        for (const mesh of this.meshes) {
            m4.multiplyMatrices(matrix, mesh.userData.local);
            mesh.setMatrixAt(this.count, m4);
            mesh.setColorAt(this.count, color);
        }
        this.count++;
    }

    end() {
        for (const mesh of this.meshes) {
            mesh.count = this.count;
            mesh.instanceMatrix.needsUpdate = true;
            mesh.instanceColor.needsUpdate = true;
        }
    }

    set visible(v) {
        for (const mesh of this.meshes) {
            mesh.visible = v;
        }
    }
}

/** A matrix for a model placed at (x, y, z), turned `rotY` around the vertical axis and scaled by `s`. */
export function place(x, y, z, rotY = 0, s = 1, out = new THREE.Matrix4()) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);

    return out.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s));
}
