/**
 * Draws a skater (src/game/skater.js): the Kenney skateboard and a skate character, tilted to the
 * ground, with the character's skate clips (config/assets.js). Reads the skater's state, never changes it.
 */
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { gltf, sharedMaterial } from './models.js';

/** Height of the board's deck above the ground, in model units (the character stands on it). */
const DECK = 0.11;

const UP = new THREE.Vector3(0, 1, 0);

/**
 * @param {THREE.Scene} scene
 * @param {object} config the game config
 * @param {number} look which character (config.assets.characters)
 */
export function createSkaterView(scene, config, look = 0) {
    const { assets, world } = config;
    const root = new THREE.Group();
    const tilt = new THREE.Group();
    const body = new THREE.Group();
    root.add(tilt);
    tilt.add(body);
    body.scale.setScalar(world.scale);
    scene.add(root);

    const board = gltf(assets.board).scene.clone();
    const characterModel = gltf(assets.characters[look % assets.characters.length]);
    const character = cloneSkinned(characterModel.scene);
    character.position.y = DECK;
    body.add(board, character);
    for (const object of [board, character]) {
        object.traverse((part) => {
            if (part.isMesh) {
                part.material = sharedMaterial();
                part.castShadow = true;
            }
        });
    }

    const mixer = new THREE.AnimationMixer(character);
    const actions = {};
    for (const clip of characterModel.animations) {
        actions[clip.name] = mixer.clipAction(clip);
    }
    let current = null;
    function play(name) {
        const action = actions[assets.clips[name]];
        if (!action || action === current) {
            return;
        }
        action.reset();
        action.setLoop(name === 'bail' ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = true;
        action.play();
        if (current) {
            current.crossFadeTo(action, assets.blend, false);
        }
        current = action;
    }

    const normal = new THREE.Vector3(0, 1, 0);
    const target = new THREE.Quaternion();

    return {
        /**
         * @param {{x: number, y: number, z: number, heading: number}} pose interpolated position and heading
         * @param {ReturnType<import('../game/skater.js').createSkater>} s the skater's state
         * @param {ReturnType<import('../game/park.js').buildPark>} park
         * @param {number} dt seconds since the last frame
         */
        update(pose, s, park, dt) {
            root.position.set(pose.x, pose.y, pose.z);
            root.rotation.y = pose.heading;

            // Lean the board onto the ground, or back upright in the air.
            if (s.grounded) {
                const [nx, ny, nz] = park.normal(pose.x, pose.z);
                normal.set(nx, ny, nz);
            } else {
                normal.copy(UP);
            }
            // The normal in the skater's own (turned) frame.
            normal.applyAxisAngle(UP, -pose.heading);
            target.setFromUnitVectors(UP, normal);
            tilt.quaternion.slerp(target, 1 - Math.exp(-(s.grounded ? 18 : 5) * dt));

            // A little nose-up pop at the start of an ollie.
            const pop = !s.grounded && s.ollied ? Math.max(0, 1 - s.airTime / 0.35) : 0;
            board.rotation.x = -0.45 * Math.sin(pop * Math.PI);

            const crouch = s.grounded && s.charge > 0 && s.bail === 0;
            character.scale.y += ((crouch ? 0.8 : 1) - character.scale.y) * Math.min(1, dt * 20);

            if (s.bail > 0) {
                play('bail');
            } else if (!s.grounded) {
                play('air');
            } else if (s.pushing) {
                play('push');
            } else {
                play('roll');
            }
            mixer.update(dt);
        },
    };
}
