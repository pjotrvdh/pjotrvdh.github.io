/**
 * Loads the .glb models in underlord/models (see src/config/assets.js) and hands out copies:
 * parts() for instanced drawing (terrain, props), clone() for animated units, and the animation clips
 * of the KayKit rig.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const loaded = new Map();
const clips = new Map();

/** Loads every file in `files` (paths under models/) once; resolves when all are in, failed ones included. */
export async function loadModels(files, onProgress) {
    const loader = new GLTFLoader();
    const list = [...new Set(files)].filter((f) => !loaded.has(f));
    let done = 0;
    await Promise.all(list.map((file) => loader.loadAsync('./models/' + file)
        .then((gltf) => {
            loaded.set(file, gltf);
            for (const clip of gltf.animations) {
                if (!clips.has(clip.name)) {
                    clips.set(clip.name, clip);
                }
            }
        })
        .catch((err) => {
            console.warn('Underlord: could not load models/' + file, err);
        })
        .finally(() => onProgress?.(++done, list.length))));
}

export const hasModel = (file) => loaded.has(file);

/** The animation clips of the models whose file name contains `group` (e.g. 'Rig_Medium'), by name. */
export function animations(group) {
    const out = {};
    for (const [file, gltf] of loaded) {
        if (file.includes(group)) {
            for (const clip of gltf.animations) {
                out[clip.name] = clip;
            }
        }
    }

    return out;
}

/** A full copy of a model, with its own skeleton, for an animated unit. Null when it did not load. */
export function clone(file) {
    const gltf = loaded.get(file);

    return gltf ? cloneSkinned(gltf.scene) : null;
}

const partsCache = new Map();

/**
 * The meshes of a static model as { geometry, material, matrix } (matrix relative to the model's
 * root), for drawing many copies with InstancedMesh. Empty when the model did not load.
 */
export function parts(file) {
    if (partsCache.has(file)) {
        return partsCache.get(file);
    }
    const out = [];
    const gltf = loaded.get(file);
    if (gltf) {
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((o) => {
            if (o.isMesh) {
                out.push({ geometry: o.geometry, material: o.material, matrix: o.matrixWorld.clone() });
            }
        });
    }
    partsCache.set(file, out);

    return out;
}

/** The height of a model's bounding box (for scaling units to a size in tiles). */
export function modelHeight(file) {
    const gltf = loaded.get(file);
    if (!gltf) {
        return 1;
    }
    const box = new THREE.Box3().setFromObject(gltf.scene);

    return Math.max(0.01, box.max.y - box.min.y);
}
