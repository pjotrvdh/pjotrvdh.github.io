/**
 * The three.js renderer, scene and lights. The sun's shadow box follows the skater, so shadows stay
 * sharp without covering the whole park.
 */
import * as THREE from 'three';

const SKY = 0x8fd3ff;
const SHADOW_SIZE = 24;

/** @param {HTMLCanvasElement} canvas */
export function createView(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SKY);
    scene.fog = new THREE.Fog(SKY, 60, 140);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb8a99a, 2.4));
    const sun = new THREE.DirectionalLight(0xfff2dd, 1.8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -SHADOW_SIZE, right: SHADOW_SIZE, top: SHADOW_SIZE, bottom: -SHADOW_SIZE, near: 1, far: 120 });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.03;
    scene.add(sun, sun.target);

    function resize() {
        const { clientWidth: width, clientHeight: height } = canvas;
        if (canvas.width !== Math.floor(width * renderer.getPixelRatio()) || canvas.height !== Math.floor(height * renderer.getPixelRatio())) {
            renderer.setSize(width, height, false);
            camera.aspect = width / Math.max(1, height);
            camera.updateProjectionMatrix();
        }
    }

    return {
        renderer, scene, camera,
        /** Draws a frame; `focus` is where the shadows should be sharp (the skater). */
        render(focus) {
            resize();
            sun.target.position.set(focus.x, 0, focus.z);
            sun.position.set(focus.x + 30, 50, focus.z + 18);
            renderer.render(scene, camera);
        },
    };
}
