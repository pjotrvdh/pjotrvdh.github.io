/**
 * Building a unit's figure from its KayKit model and its config in src/config/assets.js: dressing it up
 * (hidden, borrowed and extra parts, silhouette, head size, gloss) and the hand-held things the packs do
 * not have (the whip, the pickaxe and the mattock), made in code in the same style.
 */
import * as THREE from 'three';
import { clone } from './models.js';

/** Hand-held things made in code instead of loaded: `right` / `left` in assets.js may name these. */
const BUILT_IN = {
    whip: () => makeWhip(),
    pickaxe: () => makeTool('pickaxe'),
    mattock: () => makeTool('mattock'),
};

/** Is this hand-held thing a digging tool (held while digging, unlike a weapon)? */
export const isTool = (file) => file === 'pickaxe' || file === 'mattock';

/** A copy of a hand-held model: a built-in one, or a .glb under models/. Null when it did not load. */
export function heldModel(file) {
    return BUILT_IN[file] ? BUILT_IN[file]() : clone(file);
}

/** A mesh's part name: its own name and its parent's (a multi-material part is a group of meshes). */
export const partName = (o) => o.name + ' ' + (o.parent?.name || '');

/** A node by name; GLTFLoader drops '.' from names ('handslot.r' becomes 'handslotr'). */
export const byName = (root, name) => root.getObjectByName(name) || root.getObjectByName(name.replace(/\./g, ''));

/**
 * Dresses a KayKit figure up from its config: hides parts (`hide`), borrows parts from other KayKit
 * models (`borrow`: { from, part }, rebound to this figure's skeleton; every KayKit figure shares the
 * same rig) and adds small built-in pieces on the head (`extras`: 'crown', 'horns').
 */
export function dress(model, cfg) {
    for (const part of cfg.hide || []) {
        model.traverse((o) => {
            if (o.name.includes(part)) {
                o.visible = false;
            }
        });
    }
    for (const { from, part } of cfg.borrow || []) {
        const donor = clone(from);
        const node = donor && (donor.getObjectByName(part) || donor.getObjectByName(findName(donor, part)));
        if (!node) {
            continue;
        }
        const meshes = [];
        node.traverse((o) => o.isSkinnedMesh && meshes.push(o));
        for (const sm of meshes) {
            const bones = sm.skeleton.bones.map((b) => byName(model, b.name));
            if (bones.some((b) => !b)) {
                continue;
            }
            const parent = byName(model, sm.parent.name) || model;
            sm.removeFromParent();
            parent.add(sm);
            sm.bind(new THREE.Skeleton(bones, sm.skeleton.boneInverses), sm.bindMatrix);
        }
    }
    if (cfg.shape === 'hourglass') {
        hourglass(model);
    }
    if (cfg.headSize) {
        resizeHead(model, cfg.headSize);
    }
    if (cfg.gloss) {
        // tight, shiny leather on the named parts
        model.traverse((o) => {
            if (o.isMesh && cfg.gloss.some((part) => partName(o).includes(part))) {
                o.material = o.material.clone();
                o.material.roughness = 0.32;
                o.material.metalness = 0.15;
            }
        });
    }
    const head = byName(model, 'head');
    if (!head || !cfg.extras?.length) {
        return;
    }
    // the top of the head, in the head bone's space (measured in the rest pose)
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const at = head.getWorldPosition(new THREE.Vector3());
    const top = head.worldToLocal(new THREE.Vector3(at.x, box.max.y, at.z));
    const gold = new THREE.MeshStandardMaterial({ color: '#ffcf4a', emissive: '#6a4300', emissiveIntensity: 0.5, metalness: 0.7, roughness: 0.3, flatShading: true });
    if (cfg.extras.includes('crown')) {
        const crown = new THREE.Group();
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.27, 0.16, 10, 1, true), gold);
        band.material.side = THREE.DoubleSide;
        crown.add(band);
        for (let k = 0; k < 5; k++) {
            const a = k / 5 * Math.PI * 2;
            const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 4), gold);
            spike.position.set(Math.cos(a) * 0.27, 0.16, Math.sin(a) * 0.27);
            crown.add(spike);
            const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.04), new THREE.MeshStandardMaterial({ color: '#d42a1f', emissive: '#5a0806', flatShading: true }));
            gem.position.set(Math.cos(a) * 0.3, 0.02, Math.sin(a) * 0.3);
            crown.add(gem);
        }
        crown.position.copy(top).add(new THREE.Vector3(0, 0.02, 0));
        head.add(crown);
    }
    if (cfg.extras.includes('horns')) {
        const horn = new THREE.MeshStandardMaterial({ color: '#e9c48a', roughness: 0.6, flatShading: true });
        for (const s of [-1, 1]) {
            const h = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.42, 5), horn);
            h.position.copy(top).add(new THREE.Vector3(s * 0.32, -0.12, 0));
            h.rotation.z = -s * 0.55;
            head.add(h);
        }
    }
}

/**
 * A more feminine silhouette for a KayKit figure: the torso (the mesh named "...Body") gets a narrower
 * waist, wider hips and a fuller chest. Works on a copy of the geometry, so other figures built on the
 * same model keep theirs. Positions are in the rest pose, so the skinning still fits.
 */
function hourglass(model) {
    const bell = (t, at, width) => Math.exp(-(((t - at) / width) ** 2));
    model.traverse((o) => {
        if (!o.isSkinnedMesh || !partName(o).includes('Body')) {
            return;
        }
        o.geometry = o.geometry.clone();
        const pos = o.geometry.attributes.position;
        o.geometry.computeBoundingBox();
        const { min, max } = o.geometry.boundingBox;
        const cx = (min.x + max.x) / 2;
        const cz = (min.z + max.z) / 2;
        for (let i = 0; i < pos.count; i++) {
            const t = (pos.getY(i) - min.y) / (max.y - min.y || 1);
            const side = (1 - 0.22 * bell(t, 0.45, 0.14)) * (1 + 0.18 * bell(t, 0.06, 0.15));
            const front = pos.getZ(i) > cz ? 1 + 0.24 * bell(t, 0.74, 0.11) : 1 - 0.1 * bell(t, 0.45, 0.14);
            pos.setX(i, cx + (pos.getX(i) - cx) * side);
            pos.setZ(i, cz + (pos.getZ(i) - cz) * front);
        }
        pos.needsUpdate = true;
        o.geometry.computeVertexNormals();
    });
}

/**
 * Makes a KayKit figure's head (the mesh named "...Head", hair included) `size` times as big, around the
 * bottom of the head, so the figure looks less like a child. Works on a copy of the geometry.
 */
function resizeHead(model, size) {
    model.traverse((o) => {
        if (!o.isSkinnedMesh || !partName(o).includes('Head')) {
            return;
        }
        o.geometry = o.geometry.clone();
        o.geometry.computeBoundingBox();
        const { min, max } = o.geometry.boundingBox;
        const pivot = new THREE.Vector3((min.x + max.x) / 2, min.y + (max.y - min.y) * 0.08, (min.z + max.z) / 2);
        const pos = o.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            pos.setXYZ(i, pivot.x + (pos.getX(i) - pivot.x) * size, pivot.y + (pos.getY(i) - pivot.y) * size, pivot.z + (pos.getZ(i) - pivot.z) * size);
        }
        pos.needsUpdate = true;
        o.geometry.computeVertexNormals();
    });
}

/** The name of the first node whose name contains `part`. */
function findName(root, part) {
    let name = part;
    root.traverse((o) => {
        if (name === part && o.name.includes(part) && o.name !== part) {
            name = o.name;
        }
    });

    return name;
}

/**
 * The Dark Mistress's whip in the KayKit style: a leather grip with a pommel, and a lash that leaves the
 * grip ahead (+Y) and curls down to the ground (+Z once the right hand turns the weapon over, see attach()).
 */
function makeWhip() {
    const g = new THREE.Group();
    const leather = new THREE.MeshStandardMaterial({ color: '#2a1a24', roughness: 0.6, flatShading: true });
    const metal = new THREE.MeshStandardMaterial({ color: '#b8b0a8', metalness: 0.6, roughness: 0.35, flatShading: true });
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.42, 6).translate(0, 0.08, 0), leather));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 4).translate(0, -0.15, 0), metal));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.05, 6).translate(0, 0.3, 0), metal));
    const lash = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.3, 0),
        new THREE.Vector3(0.02, 0.6, 0.06),
        new THREE.Vector3(0.1, 0.88, 0.3),
        new THREE.Vector3(0.05, 0.98, 0.62),
        new THREE.Vector3(-0.12, 0.86, 0.9),
        new THREE.Vector3(-0.2, 0.62, 1.02),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(lash, 24, 0.028, 5, false), leather));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 4), leather);
    tip.position.copy(lash.getPoint(1));
    tip.lookAt(lash.getPoint(1).add(lash.getTangent(1)));
    tip.rotateX(Math.PI / 2);
    g.add(tip);

    return g;
}

/**
 * A digging tool in the KayKit style (the Adventurers pack has none), held like KayKit weapons: grip at
 * the origin, along +Y. 'pickaxe': a point on both sides; 'mattock': an axe blade on one side.
 */
function makeTool(kind) {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: '#8a5a34', roughness: 0.85, flatShading: true });
    const iron = new THREE.MeshStandardMaterial({ color: '#9aa0a8', metalness: 0.5, roughness: 0.45, flatShading: true });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.0, 6).translate(0, 0.42, 0), wood);
    g.add(handle);
    const hub = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14).translate(0, 0.9, 0), iron);
    g.add(hub);
    for (const s of [-1, 1]) {
        if (kind === 'mattock' && s < 0) {
            // a broad axe blade on -X, the side KayKit's axes have their blade on
            const shape = new THREE.Shape();
            shape.moveTo(0, -0.07);
            shape.lineTo(0.3, -0.2);
            shape.quadraticCurveTo(0.38, 0, 0.3, 0.2);
            shape.lineTo(0, 0.07);
            shape.lineTo(0, -0.07);
            const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false }).rotateY(Math.PI).translate(-0.05, 0.9, 0.02), iron);
            g.add(blade);
            continue;
        }
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.42, 5), iron);
        // the point faces outwards, curving down a little
        blade.rotation.z = -s * (Math.PI / 2 + 0.35);
        blade.position.set(s * 0.22, 0.84, 0);
        g.add(blade);
    }
    g.scale.setScalar(1.35);

    return g;
}
