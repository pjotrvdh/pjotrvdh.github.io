/**
 * The character viewer (open the game with ?characters). A tab per creature and hero: pick one to see
 * it alone, or switch on Compare and pick several to see them side by side ("All" shows everyone).
 * Buttons play each animation on the figures in view. Drag to orbit, scroll to zoom. For checking
 * models, sizes, tints, weapons and animations without playing.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ASSETS, KINDS } from '../game/config.js';
import { CLIPS, Figure } from './units.js';
import { parts } from './models.js';

const ACTS = ['idle', 'walk', 'run', 'attack', 'dig', 'claim', 'reinforce', 'train', 'study', 'eat', 'sleep', 'stun', 'hurt', 'held', 'guard', 'cheer', 'wave', 'die'];
const SPACING = 1.3;

export function showGallery() {
    document.querySelector('.app').hidden = true;
    const root = document.createElement('div');
    root.className = 'gallery';
    root.innerHTML = '<canvas aria-label="Character viewer"></canvas><div class="glabels" aria-hidden="true"></div>'
        + '<div class="gtop"><div class="grow"><b>Characters</b><span class="gtabs" role="tablist" aria-label="Characters"></span>'
        + '<label class="gcmp"><input type="checkbox" class="compare"> Compare</label><a href="./">Back to the game</a></div>'
        + '<div class="grow"><span class="glbl">Animation</span><span class="acts"></span><label><input type="checkbox" class="spin"> Turn</label></div></div>'
        + '<p class="ginfo"></p>';
    document.body.appendChild(root);
    const canvas = root.querySelector('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0d0a09');
    scene.add(new THREE.AmbientLight('#8c7c94', 1.1));
    scene.add(new THREE.HemisphereLight('#d8c8ff', '#2a1a10', 0.7));
    const sun = new THREE.DirectionalLight('#ffe6c8', 1.6);
    sun.position.set(-4, 8, 6);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 100);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;

    // one figure per unit kind, each standing on a stone tile
    const kinds = Object.keys(KINDS);
    const figures = kinds.map((kind) => {
        const f = new Figure(kind, KINDS[kind].side || 0);
        f.gold.visible = false;
        const stand = new THREE.Group();
        stand.add(f.root);
        for (const p of parts(ASSETS.tiles.claimed)) {
            const tile = new THREE.Mesh(p.geometry, p.material);
            tile.applyMatrix4(p.matrix);
            tile.scale.multiplyScalar(0.55);
            tile.position.y = -0.55;
            stand.add(tile);
        }
        scene.add(stand);
        f.stand = stand;

        return f;
    });
    const labels = root.querySelector('.glabels');
    const tags = figures.map((f) => {
        const el = document.createElement('div');
        const cfg = ASSETS.units[f.kind] || {};
        el.className = 'gtag';
        el.innerHTML = '<b>' + KINDS[f.kind].n + '</b><small>' + (cfg.model || 'built-in') + '</small>';
        labels.appendChild(el);

        return el;
    });

    let act = 'idle';
    let shown = new Set(kinds);
    const info = root.querySelector('.ginfo');
    const compare = root.querySelector('.compare');
    const tabsEl = root.querySelector('.gtabs');

    const describe = (f) => {
        const cfg = ASSETS.units[f.kind] || {};
        const clip = cfg.rig ? { ...CLIPS[cfg.rig], ...cfg.clips }[act] : '(built-in)';
        const held = [cfg.right, cfg.left].filter(Boolean).join(' + ');

        return KINDS[f.kind].n + ': ' + (cfg.model || 'built-in') + ', height ' + (cfg.height || 0.6) + (cfg.width ? ', width ×' + cfg.width : '') + (held ? ', holds ' + held : '') + ', ' + act + ' = ' + (clip || 'missing, falls back to idle');
    };

    /** Lays the shown figures out in a row and frames the camera on them. */
    function layout() {
        const list = figures.filter((f) => shown.has(f.kind));
        figures.forEach((f, k) => {
            f.stand.visible = shown.has(f.kind);
            tags[k].hidden = !f.stand.visible;
        });
        list.forEach((f, k) => f.stand.position.set((k - (list.length - 1) / 2) * SPACING, 0, 0));
        const half = Math.max(0.9, (list.length * SPACING) / 2 + 0.3);
        const fit = half / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect) + 1;
        const z = list.length === 1 ? 2.4 : Math.max(3.2, fit);
        controls.target.set(0, 0.42, 0);
        camera.position.set(list.length === 1 ? 0.5 : 0, list.length === 1 ? 0.95 : z * 0.3, z);
        for (const b of tabsEl.children) {
            const on = b.dataset.k === 'all' ? shown.size === kinds.length : shown.has(b.dataset.k) && shown.size < kinds.length;
            b.classList.toggle('on', on);
            b.setAttribute('aria-selected', String(on));
        }
        info.textContent = list.length <= 3 ? list.map(describe).join(' · ') : 'Pick a tab to look at one character, or switch on Compare and pick several. Drag to orbit, scroll to zoom.';
    }

    const tab = (k, label) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'tab');
        b.dataset.k = k;
        b.textContent = label;
        b.onclick = () => {
            if (k === 'all') {
                shown = new Set(kinds);
            } else if (compare.checked && shown.size < kinds.length) {
                // compare: add or remove this one (keep at least one)
                if (shown.has(k) && shown.size > 1) {
                    shown.delete(k);
                } else {
                    shown.add(k);
                }
            } else {
                shown = new Set([k]);
            }
            layout();
        };
        tabsEl.appendChild(b);
    };
    tab('all', 'All');
    for (const k of kinds) {
        tab(k, KINDS[k].n);
    }
    compare.onchange = () => {
        // starting to compare from "All": begin with only the first character
        if (compare.checked && shown.size === kinds.length) {
            shown = new Set([kinds[0]]);
            layout();
        }
    };

    const actsEl = root.querySelector('.acts');
    for (const a of ACTS) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = a;
        b.onclick = () => {
            act = a;
            for (const x of actsEl.children) {
                x.classList.toggle('on', x === b);
            }
            for (const f of figures) {
                f.current?.stop();
                f.current = null;
                f.play(a);
            }
            layout();
        };
        actsEl.appendChild(b);
    }
    actsEl.firstChild.classList.add('on');

    // clicking a figure (when not comparing) shows it alone
    const ray = new THREE.Raycaster();
    canvas.addEventListener('click', (ev) => {
        if (compare.checked) {
            return;
        }
        const r = canvas.getBoundingClientRect();
        ray.setFromCamera(new THREE.Vector2((ev.clientX - r.left) / r.width * 2 - 1, -(ev.clientY - r.top) / r.height * 2 + 1), camera);
        const hit = ray.intersectObjects(figures.filter((f) => f.stand.visible).map((f) => f.root), true)[0];
        const f = hit && figures.find((x) => x.root.getObjectById(hit.object.id));
        if (f) {
            shown = new Set([f.kind]);
            layout();
        }
    });

    const resize = () => {
        renderer.setSize(innerWidth, innerHeight, false);
        canvas.style.width = innerWidth + 'px';
        canvas.style.height = innerHeight + 'px';
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
    };
    addEventListener('resize', () => {
        resize();
        layout();
    });
    resize();
    layout();
    for (const f of figures) {
        f.play('idle');
    }
    const spin = root.querySelector('.spin');
    const v = new THREE.Vector3();
    let last = performance.now();
    const frame = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const t = now / 1000;
        for (const f of figures) {
            if (!f.stand.visible) {
                continue;
            }
            if (spin.checked) {
                f.body.rotation.y += dt * 0.8;
            }
            f.mixer?.update(dt);
            f.animateBuiltIn(act, t);
        }
        controls.update();
        renderer.render(scene, camera);
        figures.forEach((f, k) => {
            if (!f.stand.visible) {
                return;
            }
            v.copy(f.stand.position).setY(-0.08);
            const p = v.project(camera);
            tags[k].style.transform = `translate(${((p.x + 1) / 2 * innerWidth).toFixed(1)}px, ${((1 - p.y) / 2 * innerHeight).toFixed(1)}px)`;
            tags[k].hidden = p.z > 1;
        });
        requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
}
