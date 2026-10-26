/**
 * Every unit as an animated 3D figure: a KayKit model from src/config/assets.js, built by
 * figure-parts.js and animated with the shared Rig_Medium clips by what the unit does (poses.js); a ring
 * underneath shows its side.
 */
import * as THREE from 'three';
import { HERO, NEUTRAL, OWN, ix, tx, ty } from '../game/constants.js';
import { ASSETS, KINDS } from '../game/config.js';
import { G, app } from '../game/state.js';
import { ti } from '../game/tiles.js';
import { byName, dress, heldModel, isTool, partName } from './figure-parts.js';
import { animations, clone, modelHeight } from './models.js';
import { CLIPS, ONCE, PROPS, activityOf, itemShown } from './poses.js';
import { sleepSpot } from './rooms.js';

/** Seconds a unit stands idle before it may wave or cheer, and the chance per second that it then does. */
const IDLE_FUN = 3;
const IDLE_FUN_CHANCE = 0.25;
/** Seconds a dropped weapon lies on the floor before it fades. */
const DROP_LIE = 3;
/** Attack clips play this much faster than modelled: a swing takes about half a second. */
const ATTACK_SPEED = 1.8;
/** Ring colour per side: yours (the keeper colour in assets.js), heroes, wanderers. */
const ringColor = (side) => (side === OWN ? ASSETS.keeper : side === HERO ? '#bcd2f0' : '#8a8178');

/** A unit's figure: model, animation mixer, ring and carried gold. A model that did not load leaves only the ring. */
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
        const model = cfg.model ? clone(cfg.model) : null;
        if (model) {
            this.build(model, cfg);
            this.body.add(model);
        }
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

    /** Dresses, tints and scales the model, puts things in its hands and sets up its clips. */
    build(model, cfg) {
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
        const clips = animations('Rig_Medium');
        // a unit's own `clips` (assets.js) replace the defaults: an archer shoots, a warlock casts
        for (const [what, name] of Object.entries({ ...CLIPS, ...cfg.clips })) {
            if (clips[name]) {
                const a = this.mixer.clipAction(clips[name]);
                if (ONCE.has(what)) {
                    a.setLoop(THREE.LoopOnce, 1);
                    a.clampWhenFinished = true;
                }
                this.actions[what] = a;
            }
        }
    }

    /** Puts a model in a hand: the unit's own weapon or tool, or (`prop`) something it only holds for one activity. */
    attach(model, file, bone, prop = null) {
        if (!file) {
            return;
        }
        const slot = byName(model, bone);
        const w = heldModel(file);
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
            const use = prop ?? (isTool(file) ? 'tool' : 'weapon');
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

    dispose(scene) {
        scene.remove(this.root);
        this.mixer?.stopAllAction();
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
        return !e.dead && !e.held && (e.side === OWN || !!G.seen[ti(e)]);
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
                // on its bed (rooms.js sleepSpot()), also when neighbours nudge the sleeper
                const spot = sleepSpot(e.bed);
                f.heading = spot.heading;
                f.root.position.set(spot.x, spot.y, spot.z);
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
            f.gold.visible = e.carry > 0;
            if (f.gold.visible) {
                f.gold.scale.setScalar(0.7 + 0.5 * Math.min(1, e.carry / 100));
                f.gold.position.y = (f.cfg.height || 0.45) + 0.08 + Math.sin(time * 6 + e.id) * 0.02;
            }
            f.setOpacity(e.side === NEUTRAL ? 0.6 : 1);
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
            if (fx.side !== OWN && !G.seen[ix(Math.floor(fx.x), Math.floor(fx.y))]) {
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
