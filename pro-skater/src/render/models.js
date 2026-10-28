/**
 * Loads the .glb models in pro-skater/models (see tools/import-models.mjs) and hands them out: as
 * triangles for the collision grid (src/game/park.js), as geometry for instanced drawing, and as the
 * glTF scenes and clips of the skater.
 *
 * Every Kenney Mini Skate model shares one texture (models/Textures/colormap.png), so everything is
 * drawn with one material.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// The models all refer to the same texture: load it once.
THREE.Cache.enabled = true;

const loaded = new Map();
let material = null;

/** Loads every model in `names` (file names in models/ without .glb); rejects when one fails. */
export async function loadModels(names, onProgress) {
    const loader = new GLTFLoader();
    let done = 0;
    await Promise.all([...new Set(names)].map(async (name) => {
        loaded.set(name, await loader.loadAsync(`./models/${name}.glb`));
        onProgress?.(++done, names.length);
    }));
}

/** A loaded model's glTF (scene and animations). */
export function gltf(name) {
    const model = loaded.get(name);
    if (!model) {
        throw new Error(`models/${name}.glb is not loaded.`);
    }

    return model;
}

/** The material every model is drawn with: unlit-looking Lambert with the shared colour map, pixel-sharp. */
export function sharedMaterial() {
    if (!material) {
        let map = null;
        for (const model of loaded.values()) {
            model.scene.traverse((object) => {
                map ??= object.material?.map ?? null;
            });
        }
        if (map) {
            map.magFilter = THREE.NearestFilter;
            map.minFilter = THREE.NearestFilter;
            map.generateMipmaps = false;
        }
        material = new THREE.MeshLambertMaterial({ map });
    }

    return material;
}

/** A model's meshes as {geometry, matrix} (the matrix places the mesh inside the model). */
export function meshParts(name) {
    const { scene } = gltf(name);
    scene.updateMatrixWorld(true);
    const parts = [];
    scene.traverse((object) => {
        if (object.isMesh) {
            parts.push({ geometry: object.geometry, matrix: object.matrixWorld.clone() });
        }
    });

    return parts;
}

/** A model's triangles in its own units: x, y, z of three corners per triangle. */
export function triangles(name) {
    const out = [];
    const point = new THREE.Vector3();
    for (const { geometry, matrix } of meshParts(name)) {
        const position = geometry.attributes.position;
        const index = geometry.index;
        const count = index ? index.count : position.count;
        for (let k = 0; k < count; k++) {
            point.fromBufferAttribute(position, index ? index.getX(k) : k).applyMatrix4(matrix);
            out.push(point.x, point.y, point.z);
        }
    }

    return new Float32Array(out);
}
