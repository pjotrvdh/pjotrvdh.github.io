/**
 * Every unit as an animated 3D figure. Models, sizes, tints and weapons come from src/config/assets.js:
 * KayKit Adventurers (animated with the shared Rig_Medium clips), Kenney Mini Dungeon characters (with
 * their own clips) and a small built-in imp. The animation follows what the unit does (walking, digging,
 * fighting, sleeping, ...); a ring underneath shows its side.
 */
import * as THREE from 'three';
import { ix, tx, ty } from '../game/constants.js';
import { ASSETS, KINDS } from '../game/config.js';
import { G, app } from '../game/state.js';
import { ti } from '../game/tiles.js';
import { animations, clone, modelHeight, ownAnimations } from './models.js';
import { bedQuarter, bedTurn } from './rooms.js';

/** Which clip plays for which activity, per rig. */
export const CLIPS = {
    kaykit: { idle: 'Idle_A', guard: 'Idle_B', walk: 'Walking_A', run: 'Running_A', attack: 'Melee_Unarmed_Attack_Punch_A', dig: 'Pickaxing', claim: 'Working_A', reinforce: 'Hammering', train: 'Melee_1H_Attack_Chop', study: 'Holding_A', eat: 'Use_Item', sleep: 'Lie_Idle', sit: 'Sit_Floor_Idle', stun: 'Hit_B', hurt: 'Hit_A', held: 'Jump_Idle', cheer: 'Cheering', wave: 'Waving', die: 'Death_A' },
    kenney: { idle: 'idle', guard: 'idle', walk: 'walk', run: 'sprint', attack: 'attack-melee-right', dig: 'interact-right', claim: 'interact-right', reinforce: 'interact-right', train: 'attack-melee-left', study: 'interact-left', eat: 'pick-up', sleep: 'sit', sit: 'sit', stun: 'crouch', hurt: 'crouch', held: 'fall', cheer: 'emote-yes', wave: 'emote-yes', die: 'die' },
};
const ONCE = new Set(['die']);
const mirrors = new Map();
/**
 * A clip mirrored left to right, for a model: played on a spare copy, sampled 30 times a second. Every
 * bone's pose in model space is reflected (x flips) and given to its twin (.l <-> .r), corrected by the
 * two bones' rest poses, then turned back into local rotations and positions. Swapping the local values
 * directly does not work: the bones' own axes are not mirror images of each other.
 */
function mirrored(clip, file) {
    const key = clip.name + '|' + file;
    if (mirrors.has(key)) {
        return mirrors.get(key);
    }
    const root = clone(file);
    if (!root) {
        return clip;
    }
    const bones = [];
    root.traverse((o) => o.isBone && bones.push(o));
    const byBone = new Map(bones.map((b) => [b.name, b]));
    // three.js drops the dot from bone names ('upperarm.l' is 'upperarml'): a twin is the same name
    // with the last letter l <-> r, when that bone exists
    const twin = (b) => (/[lr]$/.test(b.name) && byBone.get(b.name.slice(0, -1) + (b.name.endsWith('l') ? 'r' : 'l'))) || b;
    const reflect = (q) => new THREE.Quaternion(q.x, -q.y, -q.z, q.w);
    const modelSpace = (o) => {
        root.updateMatrixWorld(true);
        const m = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(o.matrixWorld);
        const p = new THREE.Vector3();
        const q = new THREE.Quaternion();
        const s = new THREE.Vector3();
        m.decompose(p, q, s);

        return { p, q, s };
    };
    // the rest pose, and per bone the turn that maps its reflected rest pose onto its twin's
    const rest = new Map(bones.map((b) => [b, modelSpace(b)]));
    const fix = new Map(bones.map((b) => [b, reflect(rest.get(b).q).invert().multiply(rest.get(twin(b)).q)]));
    const mixer = new THREE.AnimationMixer(root);
    mixer.clipAction(clip).play();
    const times = [];
    const values = new Map(bones.map((b) => [b, { q: [], p: [] }]));
    const steps = Math.max(2, Math.ceil(clip.duration * 30) + 1);
    for (let k = 0; k < steps; k++) {
        const t = Math.min(clip.duration, k / 30);
        times.push(t);
        mixer.setTime(t);
        const pose = new Map(bones.map((b) => [b, modelSpace(b)]));
        // the mirrored pose of each bone, in model space
        const mirror = new Map();
        for (const b of bones) {
            const from = pose.get(twin(b));
            const q = reflect(from.q).multiply(fix.get(twin(b)));
            mirror.set(b, new THREE.Matrix4().compose(new THREE.Vector3(-from.p.x, from.p.y, from.p.z), q, from.s));
        }
        for (const b of bones) {
            const parent = b.parent?.isBone ? mirror.get(b.parent) : (() => {
                const r = modelSpace(b.parent);

                return new THREE.Matrix4().compose(r.p, r.q, r.s);
            })();
            const local = parent.clone().invert().multiply(mirror.get(b));
            const p = new THREE.Vector3();
            const q = new THREE.Quaternion();
            local.decompose(p, q, new THREE.Vector3());
            values.get(b).q.push(q.x, q.y, q.z, q.w);
            values.get(b).p.push(p.x, p.y, p.z);
        }
    }
    const tracks = [];
    for (const b of bones) {
        tracks.push(new THREE.QuaternionKeyframeTrack(b.name + '.quaternion', times, values.get(b).q));
        tracks.push(new THREE.VectorKeyframeTrack(b.name + '.position', times, values.get(b).p));
    }
    const out = new THREE.AnimationClip(clip.name + '_mirrored', clip.duration, tracks);
    mirrors.set(key, out);

    return out;
}

/** Seconds a unit stands idle before it may wave or cheer, and the chance per second that it then does. */
const IDLE_FUN = 3;
const IDLE_FUN_CHANCE = 0.25;
/** Seconds a dropped weapon lies on the floor before it fades. */
const DROP_LIE = 3;
/** How high a sleeper lies: on top of the bed's mattress (bed_floor at the Lair's scale), not sunk into it. */
const SLEEP_LIFT = 0.1;
/** Attack clips play this much faster than modelled: a swing takes about half a second. */
const ATTACK_SPEED = 1.8;
/** Ring colour per side: yours (the keeper colour in assets.js), heroes, wanderers. */
const ringColor = (side) => (side === 0 ? ASSETS.keeper : side === 1 ? '#bcd2f0' : '#8a8178');

/** The built-in imp: a little red devil with horns, in the same low-poly style. */
function makeImp() {
    const mat = (c, e = '#000000') => new THREE.MeshStandardMaterial({ color: c, emissive: e, roughness: 0.7, flatShading: true });
    const skin = mat('#c8552f');
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6).scale(1, 1.15, 0.9), skin);
    body.position.y = 0.2;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), skin);
    head.position.set(0, 0.42, 0.02);
    const horn = new THREE.ConeGeometry(0.035, 0.12, 5);
    const hornMat = mat('#e9a04a');
    for (const s of [-1, 1]) {
        const h = new THREE.Mesh(horn, hornMat);
        h.position.set(s * 0.07, 0.54, 0);
        h.rotation.z = -s * 0.5;
        g.add(h);
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 4), skin);
        ear.position.set(s * 0.13, 0.44, 0);
        ear.rotation.z = -s * 1.3;
        g.add(ear);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), mat('#ffe9a0', '#ffd24a'));
        eye.position.set(s * 0.05, 0.44, 0.12);
        g.add(eye);
    }
    const legs = [];
    for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.14, 5).translate(0, -0.07, 0), skin);
        leg.position.set(s * 0.07, 0.12, 0);
        g.add(leg);
        legs.push(leg);
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.15, 5).translate(0, -0.075, 0), skin);
        arm.position.set(s * 0.16, 0.3, 0);
        arm.rotation.z = s * 0.4;
        g.add(arm);
        legs.push(arm);
    }
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, 0.22, 4), skin);
    tail.position.set(0, 0.15, -0.15);
    tail.rotation.x = -1;
    g.add(body, head, tail);
    g.userData.limbs = legs;
    g.userData.body = body;

    return g;
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

/** A mesh's part name: its own name and its parent's (a multi-material part is a group of meshes). */
const partName = (o) => o.name + ' ' + (o.parent?.name || '');

/** A node by name; GLTFLoader drops '.' from names ('handslot.r' becomes 'handslotr'). */
const byName = (root, name) => root.getObjectByName(name) || root.getObjectByName(name.replace(/\./g, ''));

/**
 * Dresses a KayKit figure up from its config: hides parts (`hide`), borrows parts from other KayKit
 * models (`borrow`: { from, part }, rebound to this figure's skeleton; every KayKit figure shares the
 * same rig) and adds small built-in pieces on the head (`extras`: 'crown', 'horns').
 */
function dress(model, cfg) {
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

/** A unit's figure: model, animation mixer, ring and carried gold. */
export class Figure {
    constructor(kind, side) {
        const cfg = ASSETS.units[kind] || {};
        this.kind = kind;
        this.cfg = cfg;
        this.root = new THREE.Group();
        this.body = new THREE.Group();
        this.root.add(this.body);
        this.mixer = null;
        this.actions = {};
        /** What the hands hold, each shown only while it is in use (see `itemShown()`). */
        this.items = [];
        this.current = null;
        this.materials = [];
        let model = cfg.model ? clone(cfg.model) : null;
        if (model) {
            dress(model, cfg);
            const tint = cfg.tint ? new THREE.Color(cfg.tint) : null;
            // a tint is a colour, or [colour, brightness] to lift dark parts (grey armour to gold)
            const tints = Object.entries(cfg.tints || {}).map(([part, c]) => [part, Array.isArray(c) ? new THREE.Color(c[0]).multiplyScalar(c[1]) : new THREE.Color(c)]);
            model.traverse((o) => {
                if (o.isMesh) {
                    o.material = o.material.clone();
                    if (tint) {
                        o.material.color.multiply(tint);
                    }
                    // a tint per part, matched on the mesh name ('Helmet' tints 'Knight_Helmet')
                    const own = tints.find(([part]) => partName(o).includes(part));
                    if (own) {
                        o.material.color.multiply(own[1]);
                    }
                    o.frustumCulled = false;
                    this.materials.push(o.material);
                }
            });
            const s = (cfg.height || 0.75) / modelHeight(cfg.model);
            const w = cfg.width || 1;
            model.scale.set(s * w, s, s * w);
            this.attach(model, cfg.right, 'handslot.r');
            this.attach(model, cfg.left, 'handslot.l');
            // what any unit holds while studying, eating, reinforcing or digging (a pick only when it has no tool of its own)
            this.attach(model, ASSETS.props.book, 'handslot.r', 'book');
            this.attach(model, ASSETS.props.steak, 'handslot.r', 'steak');
            this.attach(model, ASSETS.props.hammer, 'handslot.r', 'hammer');
            if (!this.items.some((item) => item.use === 'tool')) {
                this.attach(model, 'pickaxe', 'handslot.r', 'pickaxe');
            }
            this.mixer = new THREE.AnimationMixer(model);
            const clips = cfg.rig === 'kaykit' ? animations('Rig_Medium') : ownAnimations(cfg.model);
            // a unit's own `clips` (assets.js) replace the defaults: an archer shoots, a warlock casts
            const names = { ...(CLIPS[cfg.rig] || CLIPS.kenney), ...cfg.clips };
            for (const [what, name] of Object.entries(names)) {
                if (clips[name]) {
                    const a = this.mixer.clipAction(cfg.mirror?.includes(what) ? mirrored(clips[name], cfg.model) : clips[name]);
                    if (ONCE.has(what)) {
                        a.setLoop(THREE.LoopOnce, 1);
                        a.clampWhenFinished = true;
                    }
                    this.actions[what] = a;
                }
            }
        } else {
            model = makeImp();
            model.traverse((o) => o.isMesh && this.materials.push(o.material));
            this.imp = model;
        }
        this.model = model;
        this.body.add(model);
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.31, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: ringColor(side), transparent: true, opacity: 0.75, depthWrite: false }));
        ring.position.y = 0.015;
        ring.scale.setScalar(KINDS[kind]?.big ? 1.4 : kind === 'imp' ? 0.75 : 1);
        this.ring = ring;
        this.root.add(ring);
        this.gold = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), new THREE.MeshStandardMaterial({ color: '#f2c64a', emissive: '#7a5208', metalness: 0.6, roughness: 0.35, flatShading: true }));
        this.gold.position.set(0, (cfg.height || 0.45) + 0.05, 0);
        this.root.add(this.gold);
        this.heading = 0;
        this.lastX = null;
        this.lastY = null;
        this.speed = 0;
        this.opacity = 1;
    }

    /** Puts a model in a hand: the unit's own weapon or tool, or (`prop`) something it only holds for one activity. */
    attach(model, file, bone, prop = null) {
        if (!file) {
            return;
        }
        const slot = byName(model, bone);
        const w = file === 'whip' ? makeWhip() : file === 'pickaxe' || file === 'mattock' ? makeTool(file) : clone(file);
        if (slot && w) {
            const materials = [];
            w.traverse((o) => {
                if (o.isMesh) {
                    o.material = o.material.clone();
                    materials.push(o.material);
                    this.materials.push(o.material);
                }
            });
            // KayKit's right hand slot points a weapon straight ahead with its blade (-X) up; half a turn
            // around the weapon's length puts axe blades and picks downwards. Shields, bows and books in
            // the left hand stay as KayKit set them.
            if (bone === 'handslot.r') {
                w.rotation.y = Math.PI;
            }
            const hand = bone === 'handslot.r' ? 'right' : 'left';
            if (prop) {
                const how = PROPS[prop];
                w.rotation.set(...how.turn);
                w.position.set(...(how.at ?? [0, 0, 0]));
                w.scale.setScalar(how.scale);
            } else {
                w.rotation.y += THREE.MathUtils.degToRad(this.cfg.turn?.[hand] ?? 0);
            }
            slot.add(w);
            const use = prop ?? (file === 'pickaxe' || file === 'mattock' ? 'tool' : 'weapon');
            this.items.push({ object: w, use, hand, prop, materials });
        }
    }

    /**
     * Death: the unit lets go of what it holds (not the props). Each item keeps its place in the world,
     * falls beside the body and lies flat; `Units.updateDrops()` moves it and fades it out.
     */
    dropItems(scene) {
        const out = [];
        for (const item of this.items) {
            if (item.prop) {
                continue;
            }
            item.object.visible = true;
            for (const m of item.materials) {
                this.materials.splice(this.materials.indexOf(m), 1);
            }
            scene.attach(item.object);
            const yaw = Math.random() * Math.PI * 2;
            const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, yaw, 0, 'YXZ'));
            out.push({ object: item.object, materials: item.materials, vy: 0.6, vx: Math.sin(yaw) * 0.5, vz: Math.cos(yaw) * 0.5, flat, t: 0 });
        }
        this.items = this.items.filter((item) => item.prop);

        return out;
    }

    /**
     * A unit idle for IDLE_FUN seconds or more now and then waves or cheers (once through), then idles
     * again for at least as long. Anything else it does stops the fun.
     */
    pastime(what, dt, time) {
        if (what !== 'idle') {
            this.idleT = 0;
            this.fun = null;

            return what;
        }
        if (this.fun) {
            if (time < this.funUntil) {
                return this.fun;
            }
            this.fun = null;
            this.idleT = 0;
        }
        this.idleT = (this.idleT ?? 0) + dt;
        if (this.idleT >= IDLE_FUN && Math.random() < dt * IDLE_FUN_CHANCE) {
            const fun = Math.random() < 0.5 ? 'wave' : 'cheer';
            const a = this.actions[fun];
            if (a) {
                this.fun = fun;
                this.funUntil = time + a.getClip().duration;

                return fun;
            }
        }

        return what;
    }

    play(what, timeScale = 1) {
        for (const item of this.items) {
            item.object.visible = itemShown(item, what);
        }
        const a = this.actions[what] || this.actions.idle;
        if (!a || a === this.current) {
            if (a) {
                a.timeScale = timeScale;
            }

            return;
        }
        a.reset();
        a.timeScale = timeScale;
        a.play();
        if (this.current) {
            this.current.crossFadeTo(a, 0.2, false);
        }
        this.current = a;
    }

    setOpacity(o) {
        if (o === this.opacity) {
            return;
        }
        this.opacity = o;
        for (const m of this.materials) {
            m.transparent = o < 1;
            m.opacity = o;
            m.depthWrite = o >= 1;
        }
    }

    setGlow(r, g, b) {
        for (const m of this.materials) {
            if (m.emissive) {
                m.emissive.setRGB(r, g, b);
            }
        }
    }

    /** The built-in imp has no skeleton: bob, swing its limbs and lean in while digging. */
    animateBuiltIn(what, time) {
        if (!this.imp) {
            return;
        }
        const limbs = this.imp.userData.limbs;
        const walk = what === 'walk' || what === 'run';
        const swing = walk ? Math.sin(time * 16) * 0.7 : what === 'attack' || what === 'train' ? Math.sin(time * 12) * 1.1 : 0;
        limbs.forEach((l, k) => {
            l.rotation.x = (k % 2 ? -swing : swing) + (what === 'dig' && k % 2 ? -1.2 - Math.abs(Math.sin(time * 8)) : 0);
        });
        this.imp.position.y = walk ? Math.abs(Math.sin(time * 16)) * 0.03 : what === 'held' ? Math.sin(time * 5) * 0.02 : 0;
        this.imp.rotation.x = what === 'dig' ? 0.25 + Math.sin(time * 8) * 0.15 : what === 'sleep' ? 1.2 : 0;
        this.imp.rotation.z = what === 'die' ? 1.4 : what === 'stun' || what === 'hurt' ? Math.sin(time * 20) * 0.15 : 0;
    }

    dispose(scene) {
        scene.remove(this.root);
        this.mixer?.stopAllAction();
    }
}

/**
 * Corrections for sleepers, per bed direction (`bedQuarter()` in rooms.js: where the pillow points with
 * the camera not turned). `turn`: extra degrees the sleeper turns around; `x`, `z`: tiles it moves on the
 * map (x to the right, z down the screen). Pillow right is correct as it is.
 */
const SLEEP_FIX = [
    { turn: 0, x: -0.1, z: 0.2 }, // pillow up
    { turn: 0, x: 0.2, z: 0.1 }, // pillow left
    { turn: 0, x: 0.1, z: -0.2 }, // pillow down
    { turn: 0, x: -0.2, z: 0 }, // pillow right
];

/**
 * The props a unit holds for one activity, in place of its own things: an open book to study, a steak
 * to eat, a pick to dig (units with a tool of their own dig with that). `turn` (radians, x y z), `at`
 * (a shift from the hand, in the hand's own units) and `scale` fit the model in the hand.
 */
const PROPS = {
    book: {
        during: 'study',
        turn: [Math.PI, -Math.PI / 2, 0],
        at: [0, 0.3, -0.35],
        scale: 1
    },
    steak: {
        during: 'eat',
        turn: [Math.PI / 2, 0, 0],
        at: [0.2, 0, -0.1],
        scale: 0.45
    },
    hammer: {
        during: 'reinforce',
        turn: [0, Math.PI, 0],
        scale: 1.1
    },
    pickaxe: {
        during: 'dig',
        turn: [0, Math.PI, 0],
        scale: 1
    },
};

/**
 * Is a held item in view during this activity? A unit always holds its own weapon, shield or tool,
 * except asleep or sitting in a cell (a death drops it, see `dropItems()`) and while it studies, eats, reinforces or digs:
 * then it holds that activity's prop instead (a unit's own tool stays in hand for digging).
 */
function itemShown(item, what) {
    if (item.prop) {
        return PROPS[item.prop].during === what;
    }
    if (what === 'sleep' || what === 'sit' || what === 'study' || what === 'eat' || what === 'reinforce') {
        return false;
    }
    if (what === 'dig') {
        return item.use === 'tool';
    }

    return true;
}

/** What a unit is doing, as an animation name. */
function activityOf(e, moving) {
    if (e.hitT > 0) {
        return 'attack';
    }
    if (moving) {
        return 'walk';
    }
    if (e.digging > 0) {
        return 'dig';
    }
    switch (e.state) {
        case 'out':
        case 'hauled':
            return 'sleep';
        case 'jailed':
            return 'sit';
        case 'dig':
        case 'claim':
        case 'reinforce':
            return e.state;
        case 'sleep':
            return 'sleep';
        case 'eat':
            return 'eat';
        case 'train':
            return 'train';
        case 'study':
            return 'study';
        case 'cheer':
            return 'cheer';
        case 'stun':
            return 'stun';
        case 'guard':
            return 'guard';
        default:
            return e.hurtT > 0 ? 'hurt' : 'idle';
    }
}

export class Units {
    constructor(scene) {
        this.scene = scene;
        this.figures = new Map();
        this.dying = [];
        /** Weapons dropped by the dead, lying on the floor until they fade. */
        this.drops = [];
        this.seenFx = new WeakSet();
    }

    /** Is this unit drawn? Your own always; heroes and wanderers only on discovered ground. */
    visible(e) {
        return !e.dead && !e.held && (e.side === 0 || !!G.seen[ti(e)]);
    }

    update(dt, time, cursor) {
        const alive = new Set();
        const held = G.held.slice(-4).reverse();
        for (const e of G.ents) {
            const inHand = e.held && held.includes(e);
            if (!this.visible(e) && !inHand) {
                continue;
            }
            alive.add(e.id);
            let f = this.figures.get(e.id);
            if (!f || f.kind !== e.kind) {
                f?.dispose(this.scene);
                f = new Figure(e.kind, e.side);
                this.figures.set(e.id, f);
                this.scene.add(f.root);
            }
            f.ring.material.color.set(ringColor(e.side));
            if (inHand) {
                const k = held.indexOf(e);
                f.root.position.set(cursor.x + 0.25 + k * 0.18, 0.9 + k * 0.12 + Math.sin(time * 3 + k) * 0.04, cursor.z + 0.1 - k * 0.1);
                f.ring.visible = false;
                f.gold.visible = false;
                f.play('held');
                f.lastX = null;
                f.mixer?.update(dt);
                f.animateBuiltIn('held', time);
                continue;
            }
            f.ring.visible = true;
            // movement since the last frame decides walking and facing
            let moving = false;
            if (f.lastX !== null) {
                const dx = e.x - f.lastX;
                const dz = e.y - f.lastY;
                const d = Math.hypot(dx, dz);
                f.speed = f.speed * 0.8 + (dt > 0 ? d / dt : 0) * 0.2;
                moving = f.speed > 0.15;
                if (d > 0.002) {
                    f.heading = Math.atan2(dx, dz);
                }
            }
            if (!moving) {
                const t = e.target && !e.target.dead ? e.target : null;
                if (t && e.state === 'fight') {
                    f.heading = Math.atan2(t.x - e.x, t.y - e.y);
                } else if ((e.state === 'dig' || e.state === 'reinforce') && e.task >= 0) {
                    f.heading = Math.atan2(tx(e.task) + 0.5 - e.x, ty(e.task) + 0.5 - e.y);
                } else if ((e.state === 'march' || e.digging > 0) && e.aim !== undefined) {
                    f.heading = Math.atan2(Math.cos(e.aim), Math.sin(e.aim));
                }
            }
            f.lastX = e.x;
            f.lastY = e.y;
            f.root.position.set(e.x, 0, e.y);
            if (e.state === 'sleep' && e.bed === ti(e)) {
                // in the middle of the bed, on the mattress, along it: Lie_Idle puts the head towards the
                // figure's back (-Z), the same end as bed_floor's pillow, so the head lies on the pillow.
                // It stays there when neighbours nudge the sleeper.
                const fix = SLEEP_FIX[bedQuarter(e.bed)];
                f.heading = bedTurn(e.bed) + THREE.MathUtils.degToRad(fix.turn);
                f.root.position.set(tx(e.bed) + 0.5 + fix.x, SLEEP_LIFT, ty(e.bed) + 0.5 + fix.z);
            } else if (e.state === 'hauled') {
                // carried over the imp's head
                f.root.position.y = 0.45;
            }
            let r = f.body.rotation.y;
            let d = f.heading - r;
            d = Math.atan2(Math.sin(d), Math.cos(d));
            r += d * Math.min(1, dt * 12);
            f.body.rotation.y = r;
            let what = activityOf(e, moving);
            // an attack plays to the end of its swing, however short the hit is in the game
            if (what === 'attack' && f.current !== f.actions.attack) {
                f.swingUntil = time + (f.actions.attack?.getClip().duration ?? 0.4) / ATTACK_SPEED;
            } else if (time < (f.swingUntil ?? 0) && what !== 'walk') {
                what = 'attack';
            }
            what = f.pastime(what, dt, time);
            const base = KINDS[e.kind].spd || 2;
            f.play(what, what === 'walk' ? Math.max(0.6, Math.min(2.2, f.speed / base * 1.4)) : what === 'attack' ? ATTACK_SPEED : 1);
            f.mixer?.update(dt);
            f.animateBuiltIn(what, time);
            f.gold.visible = e.carry > 0;
            if (f.gold.visible) {
                f.gold.scale.setScalar(0.7 + 0.5 * Math.min(1, e.carry / 100));
                f.gold.position.y = (f.cfg.height || 0.45) + 0.08 + Math.sin(time * 6 + e.id) * 0.02;
            }
            f.setOpacity(e.side === 2 ? 0.6 : 1);
            const slapped = e.slap > 0 && Math.sin(time * 30) > 0;
            if (e.hurtT > 0) {
                f.setGlow(0.6, 0.05, 0.02);
            } else if (slapped) {
                f.setGlow(0.45, 0.3, 0.15);
            } else {
                f.setGlow(0, 0, 0);
            }
        }
        for (const [id, f] of this.figures) {
            if (!alive.has(id)) {
                f.dispose(this.scene);
                this.figures.delete(id);
            }
        }
        this.updateDeaths(dt);
    }

    /** Fallen units play their death and fade out (fx type 'death'). */
    updateDeaths(dt) {
        for (const fx of G.fx) {
            if (fx.type !== 'death' || this.seenFx.has(fx)) {
                continue;
            }
            this.seenFx.add(fx);
            if (fx.side !== 0 && !G.seen[ix(Math.floor(fx.x), Math.floor(fx.y))]) {
                continue;
            }
            const f = new Figure(fx.kind, fx.side);
            f.root.position.set(fx.x, 0, fx.y);
            f.body.rotation.y = fx.face < 0 ? -Math.PI / 2 : Math.PI / 2;
            f.ring.visible = false;
            f.gold.visible = false;
            f.play('die');
            this.scene.add(f.root);
            this.dying.push({ f, fx });
        }
        this.dying = this.dying.filter(({ f, fx }) => {
            if (!G.fx.includes(fx)) {
                f.dispose(this.scene);

                return false;
            }
            f.mixer?.update(dt);
            f.animateBuiltIn('die', fx.t);
            // let go of the weapon once the fall has begun (the hand is then where the death put it)
            if (!f.dropped && fx.t > 0.15) {
                f.dropped = true;
                this.drops.push(...f.dropItems(this.scene));
            }
            f.setOpacity(Math.max(0, 1 - Math.max(0, fx.t / fx.dur - 0.5) * 2));

            return true;
        });
        this.updateDrops(dt);
    }

    /** Dropped weapons fall beside the body, lie flat for DROP_LIE seconds, then fade out. */
    updateDrops(dt) {
        this.drops = this.drops.filter((d) => {
            d.t += dt;
            const o = d.object;
            if (o.position.y > 0.03 || d.vy > 0) {
                d.vy -= 9 * dt;
                o.position.x += d.vx * dt;
                o.position.z += d.vz * dt;
                o.position.y = Math.max(0.03, o.position.y + d.vy * dt);
            }
            o.quaternion.slerp(d.flat, Math.min(1, dt * 8));
            const fade = Math.max(0, Math.min(1, (d.t - DROP_LIE) / 0.5));
            for (const m of d.materials) {
                m.transparent = fade > 0;
                m.opacity = 1 - fade;
                m.depthWrite = fade === 0;
            }
            if (fade >= 1) {
                this.scene.remove(o);

                return false;
            }

            return true;
        });
    }

    /** Screen-space picking support: every drawn unit with its world position and size. */
    targets() {
        const out = [];
        for (const e of G.ents) {
            if (this.visible(e)) {
                out.push({ e, height: ASSETS.units[e.kind]?.height || 0.45 });
            }
        }

        return out;
    }

    clear() {
        for (const f of this.figures.values()) {
            f.dispose(this.scene);
        }
        this.figures.clear();
        for (const d of this.drops) {
            this.scene.remove(d.object);
        }
        this.drops = [];
        app.hover.unit = null;
    }
}
