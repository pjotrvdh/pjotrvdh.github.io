/**
 * Draws a park (src/game/park.js): one InstancedMesh per model, so the whole park takes a few dozen
 * draw calls. A floor tile goes under every tile, and a large plain ground round the park.
 */
import * as THREE from 'three';
import { meshParts, sharedMaterial } from './models.js';

/**
 * @param {THREE.Scene} scene
 * @param {ReturnType<import('../game/park.js').buildPark>} park
 * @param {object} config the game config
 */
export function addPark(scene, park, config) {
    const { tile } = park;
    const material = sharedMaterial();

    // [model, col, row, turn] for every piece, plus a floor tile under each tile.
    const placements = new Map();
    const place = (model, col, row, turn) => {
        if (!placements.has(model)) {
            placements.set(model, []);
        }
        placements.get(model).push([col, row, turn]);
    };
    for (const { piece, col, row, turn } of park.tiles) {
        const { model } = config.pieces[piece];
        if (model !== config.pieces.floor.model) {
            place(model, col, row, turn);
        }
        place(config.pieces.floor.model, col, row, 0);
    }

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const size = new THREE.Vector3(tile, tile, tile);
    const up = new THREE.Vector3(0, 1, 0);
    for (const [model, list] of placements) {
        const isFloor = model === config.pieces.floor.model;
        for (const part of meshParts(model)) {
            const mesh = new THREE.InstancedMesh(part.geometry, material, list.length);
            list.forEach(([col, row, turn], index) => {
                position.set((col + 0.5) * tile, isFloor ? -0.002 : 0, (row + 0.5) * tile);
                rotation.setFromAxisAngle(up, turn * Math.PI / 2);
                mesh.setMatrixAt(index, matrix.compose(position, rotation, size).multiply(part.matrix));
            });
            mesh.castShadow = !isFloor;
            mesh.receiveShadow = true;
            mesh.computeBoundingSphere();
            scene.add(mesh);
        }
    }

    // The ground round the park.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshLambertMaterial({ color: 0x8c9a6b }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(park.width / 2, -0.02, park.depth / 2);
    ground.receiveShadow = true;
    scene.add(ground);
}
