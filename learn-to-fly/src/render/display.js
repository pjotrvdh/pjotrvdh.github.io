import { CHARS, EXPORTS } from './library.js';
import { apply, invert, multiply, transformBounds, unionBounds } from './matrix.js';
import { hitShape } from './draw.js';

/*
 * The display list: the movie clips, buttons, shapes and texts of the original game, with the
 * ActionScript 2 properties and methods its scripts use (_x as x, gotoAndStop(), hitTest(), ...).
 * Timelines play the exported frames: placing, moving and removing children, starting sounds and
 * queueing frame scripts. See .docs/engine.md.
 *
 * Depths: timeline children use the Flash depth minus 16384 (so they are negative), children made
 * by scripts (attachMovie, duplicateMovieClip) use the depth the script asks for, as in AS2.
 */

const TIMELINE_DEPTH = 16384;
const DEG = Math.PI / 180;

/** Base of everything on the display list. */
export class DisplayObject {
    constructor(player, id, ch) {
        this.player = player;
        this.id = id;
        this.char = ch;
        this.parent = null;
        this.name = '';
        this.depth = 0;
        this.m = [1, 0, 0, 1, 0, 0];
        this.cx = null;
        this.ratio = 0;
        this.clipDepth = 0;
        this.filters = null;
        this.blend = 0;
        this.visibleFlag = true;
        // Set once a script changes the transform: the timeline then leaves it alone (as in Flash).
        this.scripted = false;
        // Index of the frame (1-based) whose PlaceObject made this child; 0 for children made by scripts.
        this.placedAt = 0;
        this.removed = false;
    }

    get root() {
        return this.player.root;
    }

    /* ----- AS2 properties ----- */

    get x() {
        return this.m[4];
    }

    set x(v) {
        this.m[4] = Number(v) || 0;
        this.scripted = true;
    }

    get y() {
        return this.m[5];
    }

    set y(v) {
        this.m[5] = Number(v) || 0;
        this.scripted = true;
    }

    /** Scale, rotation and skew from the matrix (rotation of the x and y axes). */
    decompose() {
        const [a, b, c, d] = this.m;
        return { sx: Math.hypot(a, b), sy: Math.hypot(c, d), rx: Math.atan2(b, a), ry: Math.atan2(-c, d) };
    }

    compose({ sx, sy, rx, ry }) {
        this.m[0] = sx * Math.cos(rx);
        this.m[1] = sx * Math.sin(rx);
        this.m[2] = -sy * Math.sin(ry);
        this.m[3] = sy * Math.cos(ry);
        this.scripted = true;
    }

    get xscale() {
        return this.decompose().sx * 100;
    }

    set xscale(v) {
        this.compose({ ...this.decompose(), sx: v / 100 });
    }

    get yscale() {
        return this.decompose().sy * 100;
    }

    set yscale(v) {
        this.compose({ ...this.decompose(), sy: v / 100 });
    }

    get rotation() {
        return this.decompose().rx / DEG;
    }

    set rotation(v) {
        const t = this.decompose();
        let deg = Number(v) % 360;
        if (deg > 180) {
            deg -= 360;
        } else if (deg < -180) {
            deg += 360;
        }
        const delta = deg * DEG - t.rx;
        this.compose({ ...t, rx: t.rx + delta, ry: t.ry + delta });
    }

    get alpha() {
        return (this.cx ? this.cx[3] : 1) * 100;
    }

    set alpha(v) {
        this.cx = this.cx ? this.cx.slice() : [1, 1, 1, 1, 0, 0, 0, 0];
        this.cx[3] = v / 100;
        this.scripted = true;
    }

    get visible() {
        return this.visibleFlag;
    }

    set visible(v) {
        this.visibleFlag = !!v;
    }

    /** Bounds in the parent's coordinates. */
    get width() {
        const b = this.getBounds(this.parent);
        return b ? b[2] - b[0] : 0;
    }

    set width(v) {
        const w = this.width;
        if (w) {
            this.xscale = (this.xscale * v) / w;
        }
    }

    get height() {
        const b = this.getBounds(this.parent);
        return b ? b[3] - b[1] : 0;
    }

    set height(v) {
        const h = this.height;
        if (h) {
            this.yscale = (this.yscale * v) / h;
        }
    }

    /** The matrix from this object's coordinates to the stage. */
    worldMatrix() {
        let m = this.m;
        for (let p = this.parent; p; p = p.parent) {
            m = multiply(p.m, m);
        }
        return m;
    }

    /** Mouse position in this object's coordinates. */
    get xmouse() {
        return this.globalToLocal(this.player.mouseX, this.player.mouseY)[0];
    }

    get ymouse() {
        return this.globalToLocal(this.player.mouseX, this.player.mouseY)[1];
    }

    globalToLocal(x, y) {
        const inv = invert(this.worldMatrix());
        return inv ? apply(inv, x, y) : [0, 0];
    }

    /** Own bounds in own coordinates, or null. */
    localBounds() {
        return this.char?.b ?? null;
    }

    /** Bounds in the coordinates of `space` (a display object; null = the stage). */
    getBounds(space) {
        const own = this.localBounds();
        if (!own) {
            return null;
        }
        let m = this.worldMatrix();
        if (space) {
            const inv = invert(space.worldMatrix());
            m = inv ? multiply(inv, m) : m;
        }
        return transformBounds(m, own);
    }

    /**
     * AS2 hitTest: with a point (stage coordinates) and shapeFlag, true when a filled shape of this
     * object is under the point; without shapeFlag, when the point is inside the bounds. With
     * another object, when the bounds overlap.
     */
    hitTest(x, y, shapeFlag) {
        if (x instanceof DisplayObject) {
            const a = this.getBounds(null);
            const b = x.getBounds(null);
            return !!(a && b && a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3]);
        }
        if (!shapeFlag) {
            const b = this.getBounds(null);
            return !!(b && x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]);
        }
        return this.hitShape(x, y);
    }

    hitShape(x, y) {
        const b = this.getBounds(null);
        if (!b || x < b[0] || x > b[2] || y < b[1] || y > b[3]) {
            return false;
        }
        if (this.char?.t === 'shape' || this.char?.t === 'morph') {
            const inv = invert(this.worldMatrix());
            if (!inv) {
                return false;
            }
            const [lx, ly] = apply(inv, x, y);
            return hitShape(this, lx, ly);
        }
        return true;
    }

    /** Called when the object leaves the display list. */
    destroy() {
        this.removed = true;
    }

    removeMovieClip() {
        this.parent?.removeChild(this);
    }

    swapDepths(depth) {
        const p = this.parent;
        if (!p) {
            return;
        }
        const target = typeof depth === 'number' ? depth : depth.depth;
        const other = p.children.find((c) => c.depth === target && c !== this);
        if (other) {
            other.depth = this.depth;
        }
        this.depth = target;
        // A clip moved by swapDepths is no longer controlled by the timeline.
        this.placedAt = 0;
        p.sortChildren();
    }

    getDepth() {
        return this.depth;
    }
}

/** A shape, morph shape or static text: drawn, never animated. */
export class Graphic extends DisplayObject {}

/** A dynamic text field. Its text comes from `variable` (an AS2 path) when it has one, else from `text`. */
export class TextField extends DisplayObject {
    constructor(player, id, ch) {
        super(player, id, ch);
        this.textValue = ch.text ?? '';
        this.textColor = null;
    }

    get text() {
        if (this.char.variable) {
            const v = this.player.resolveVariable(this.parent, this.char.variable);
            return v === undefined || v === null ? '' : formatValue(v);
        }
        return this.textValue;
    }

    set text(v) {
        if (this.char.variable) {
            this.player.assignVariable(this.parent, this.char.variable, v);
        } else {
            this.textValue = formatValue(v);
        }
    }
}

/** AS2 converts numbers to strings like this (no trailing zeros, at most 15 significant digits). */
export function formatValue(v) {
    if (typeof v === 'number') {
        if (!Number.isFinite(v)) {
            return Number.isNaN(v) ? 'NaN' : v > 0 ? 'Infinity' : '-Infinity';
        }
        return String(Number(v.toPrecision(15)));
    }
    return String(v);
}

/** A movie clip (sprite) or the root: a timeline with children, script variables and events. */
export class MovieClip extends DisplayObject {
    constructor(player, id, ch) {
        super(player, id, ch);
        this.children = [];
        this.frame = 0;
        this.playing = true;
        // Variables AS2 scripts set on this timeline (text fields bind to them).
        this.vars = {};
        // Clip events from the timeline's onClipEvent handlers (see scripts.js), and AS2 handlers
        // set by scripts: onEnterFrame, onMouseDown, onMouseUp, onMouseMove.
        this.clipEvents = null;
        this.onEnterFrame = null;
        this.onMouseDown = null;
        this.onMouseUp = null;
        this.onMouseMove = null;
        this.stream = null;
    }

    /** The key scripts.js uses for this clip's frame scripts: the sprite id, or 'root'. */
    get scriptKey() {
        return this.id;
    }

    get totalFrames() {
        return this.char.frames.length;
    }

    get currentFrame() {
        return this.frame;
    }

    /** A child by instance name (AS2 `clip.name`), or undefined. */
    get(name) {
        for (let i = this.children.length - 1; i >= 0; i--) {
            if (this.children[i].name === name) {
                return this.children[i];
            }
        }
        return undefined;
    }

    /** A child by name, or a stand-in that ignores everything, like AS2 calls on undefined. */
    c(name) {
        return this.get(name) ?? NULL_CLIP;
    }

    childAt(depth) {
        return this.children.find((c) => c.depth === depth);
    }

    sortChildren() {
        this.children.sort((a, b) => a.depth - b.depth);
    }

    addChild(child, depth) {
        const old = this.childAt(depth);
        if (old) {
            this.removeChild(old);
        }
        child.parent = this;
        child.depth = depth;
        this.children.push(child);
        this.sortChildren();
        return child;
    }

    removeChild(child) {
        const i = this.children.indexOf(child);
        if (i >= 0) {
            this.children.splice(i, 1);
        }
        child.destroy();
        child.parent = null;
    }

    destroy() {
        super.destroy();
        this.player.stopStream(this);
        this.player.fireClipEvent(this, 'unload');
        for (const c of [...this.children]) {
            c.destroy();
        }
    }

    localBounds() {
        let b = null;
        for (const c of this.children) {
            if (c.clipDepth) {
                continue;
            }
            const cb = c.localBounds();
            if (cb) {
                b = unionBounds(b, transformBounds(c.m, cb));
            }
        }
        return b;
    }

    hitShape(x, y) {
        return this.children.some((c) => !c.clipDepth && c.hitShape(x, y));
    }

    /* ----- timeline ----- */

    resolveFrame(f) {
        if (typeof f === 'number' || /^\d+$/.test(String(f))) {
            const n = Math.floor(Number(f));
            return Number.isFinite(n) ? Math.max(1, Math.min(this.totalFrames, n)) : 1;
        }
        const i = this.char.frames.findIndex((fr) => fr.label === f);
        return i >= 0 ? i + 1 : 0;
    }

    stop() {
        this.playing = false;
        this.player.stopStream(this);
    }

    play() {
        if (!this.playing) {
            this.playing = true;
            this.player.syncStream(this);
        }
    }

    gotoAndStop(f) {
        const n = this.resolveFrame(f);
        this.playing = false;
        if (n) {
            this.seek(n);
        }
        this.player.stopStream(this);
    }

    gotoAndPlay(f) {
        const n = this.resolveFrame(f);
        this.playing = true;
        if (n) {
            this.seek(n);
        }
        this.player.syncStream(this);
    }

    nextFrame() {
        this.gotoAndStop(Math.min(this.frame + 1, this.totalFrames));
    }

    prevFrame() {
        this.gotoAndStop(Math.max(this.frame - 1, 1));
    }

    /** Moves to frame n: forwards frame by frame, backwards by rebuilding from frame 1. Queues the frame's script. */
    seek(n) {
        if (n === this.frame) {
            return;
        }
        if (n > this.frame) {
            for (let f = this.frame + 1; f <= n; f++) {
                this.applyFrame(f, f === n);
            }
        } else {
            this.rebuild(n);
        }
        this.frame = n;
        this.enteredFrame(n);
        this.player.queueFrame(this, n);
    }

    /** The root tells the game when it changes frame (scene), before that frame's script runs. */
    enteredFrame(n) {
        if (this === this.player.root) {
            this.player.onRootFrame?.(n);
        }
    }

    /** One step of the timeline, at the frame rate: loops back to frame 1 at the end. */
    advance() {
        if (!this.playing || this.totalFrames <= 1) {
            return;
        }
        const next = this.frame >= this.totalFrames ? 1 : this.frame + 1;
        if (next === 1) {
            this.rebuild(1);
        } else {
            this.applyFrame(next, true);
        }
        this.frame = next;
        this.enteredFrame(next);
        this.player.queueFrame(this, next);
        if (this.stream && next === this.stream.frame) {
            this.player.syncStream(this);
        }
    }

    /** Applies the PlaceObject/RemoveObject/StartSound tags of frame f. */
    applyFrame(f, sounds) {
        const ops = this.char.frames[f - 1]?.ops;
        if (!ops) {
            return;
        }
        for (const op of ops) {
            if (op[0] === 'place') {
                this.place(op[1], f);
            } else if (op[0] === 'remove') {
                const child = this.childAt(op[1] - TIMELINE_DEPTH);
                if (child) {
                    this.removeChild(child);
                }
            } else if (op[0] === 'sound' && sounds) {
                this.player.audio.timelineSound(op[1], op[2]);
            }
        }
    }

    place(p, f) {
        const depth = p.depth - TIMELINE_DEPTH;
        let child = this.childAt(depth);
        if (!p.move || (p.c !== undefined && (!child || child.id !== p.c))) {
            if (p.c === undefined) {
                return;
            }
            const replaced = p.move ? child : null;
            child = this.player.create(p.c);
            if (!child) {
                return;
            }
            if (replaced) {
                child.m = replaced.m.slice();
                child.cx = replaced.cx;
                child.name = replaced.name;
                child.placedAt = replaced.placedAt;
            } else {
                child.placedAt = f;
            }
            this.applyPlacement(child, p, true);
            this.addChild(child, depth);
            this.player.initChild(child, this, p);
            return;
        }
        if (child) {
            this.applyPlacement(child, p, false);
        }
    }

    applyPlacement(child, p, fresh) {
        if (fresh || !child.scripted) {
            if (p.m) {
                child.m = p.m.slice();
            }
            if (p.cx) {
                child.cx = p.cx;
            }
        }
        if (p.ratio !== undefined) {
            child.ratio = p.ratio;
        }
        if (p.name !== undefined) {
            child.name = p.name;
        }
        if (p.clip !== undefined) {
            child.clipDepth = p.clip - TIMELINE_DEPTH;
        }
        if (p.filters) {
            child.filters = p.filters;
        }
        if (p.blend) {
            child.blend = p.blend;
        }
    }

    /**
     * Rebuilds the display list for frame n from frame 1: children placed by the same PlaceObject
     * stay (with their state), others are removed or created. Children made by scripts stay.
     */
    rebuild(n) {
        const state = new Map();
        const frames = this.char.frames;
        for (let f = 1; f <= n; f++) {
            for (const op of frames[f - 1]?.ops ?? []) {
                if (op[0] === 'place') {
                    const p = op[1];
                    const prev = state.get(p.depth);
                    if (!p.move || (p.c !== undefined && (!prev || prev.c !== p.c))) {
                        if (p.c !== undefined) {
                            state.set(p.depth, { ...p, at: p.move && prev ? prev.at : f, m: p.m ?? prev?.m, cx: p.cx ?? prev?.cx, name: p.name ?? prev?.name });
                        }
                    } else if (prev) {
                        state.set(p.depth, {
                            ...prev,
                            m: p.m ?? prev.m,
                            cx: p.cx ?? prev.cx,
                            ratio: p.ratio ?? prev.ratio,
                            name: p.name ?? prev.name,
                            clip: p.clip ?? prev.clip,
                            filters: p.filters ?? prev.filters,
                            blend: p.blend ?? prev.blend,
                        });
                    }
                } else if (op[0] === 'remove') {
                    state.delete(op[1]);
                }
            }
        }
        for (const child of [...this.children]) {
            if (!child.placedAt) {
                continue;
            }
            const s = state.get(child.depth + TIMELINE_DEPTH);
            if (!s || s.c !== child.id || s.at !== child.placedAt) {
                this.removeChild(child);
            }
        }
        for (const [depth, s] of state) {
            const d = depth - TIMELINE_DEPTH;
            const child = this.childAt(d);
            if (child && child.placedAt) {
                this.applyPlacement(child, { m: s.m, cx: s.cx, ratio: s.ratio, name: s.name, clip: s.clip, filters: s.filters, blend: s.blend }, false);
            } else if (!child) {
                const fresh = this.player.create(s.c);
                if (!fresh) {
                    continue;
                }
                fresh.placedAt = s.at;
                this.applyPlacement(fresh, { m: s.m, cx: s.cx, ratio: s.ratio, name: s.name, clip: s.clip, filters: s.filters, blend: s.blend }, true);
                this.addChild(fresh, d);
                this.player.initChild(fresh, this, s);
            }
        }
    }

    /* ----- AS2 methods for scripts ----- */

    getNextHighestDepth() {
        const max = this.children.reduce((m, c) => Math.max(m, c.depth), -1);
        return Math.max(0, max + 1);
    }

    /** attachMovie(exportName, newName, depth): a new instance of an exported sprite. */
    attachMovie(exportName, name, depth) {
        const id = EXPORTS[exportName];
        const child = id === undefined ? null : this.player.create(id);
        if (!child) {
            return undefined;
        }
        child.name = name;
        this.addChild(child, depth);
        this.player.initChild(child, this, null);
        return child;
    }

    /** duplicateMovieClip on a child: a copy at a new depth, from frame 1, with the same transform. */
    duplicate(source, name, depth) {
        const child = this.player.create(source.id);
        if (!child) {
            return undefined;
        }
        child.m = source.m.slice();
        child.cx = source.cx;
        child.name = name;
        child.clipEvents = source.clipEvents;
        this.addChild(child, depth);
        this.player.initChild(child, this, null, source.clipEvents);
        return child;
    }

    /** Like AS2 _root.stopAllSounds(). */
    stopAllSounds() {
        this.player.audio.stopAll();
    }
}

/** A button: up, over and down states, a hit area, and the release action from scripts.js. */
export class Button extends DisplayObject {
    constructor(player, id, ch) {
        super(player, id, ch);
        this.state = 'up';
        this.enabled = true;
        this.records = ch.records.map((r) => {
            const obj = player.create(r.c);
            if (obj) {
                obj.m = r.m.slice();
                obj.cx = r.cx;
                obj.filters = r.filters ?? null;
                obj.parent = this;
                obj.depth = r.depth;
                player.initChild(obj, null, null);
            }
            return { states: r.states, obj };
        }).filter((r) => r.obj);
        // MovieClip-like containers so the drawing and advancing code can walk into the states.
        this.children = [];
        this.updateState('up');
    }

    updateState(state) {
        this.state = state;
        const bit = { up: 1, over: 2, down: 4 }[state];
        this.children = this.records.filter((r) => r.states & bit).map((r) => r.obj).sort((a, b) => a.depth - b.depth);
    }

    localBounds() {
        let b = null;
        for (const r of this.records) {
            if (r.states & 8) {
                const cb = r.obj.localBounds();
                if (cb) {
                    b = unionBounds(b, transformBounds(r.obj.m, cb));
                }
            }
        }
        return b;
    }

    /** True when (x, y) on the stage is over the hit area. */
    hitArea(x, y) {
        return this.records.some((r) => r.states & 8 && r.obj.hitShape(x, y));
    }

    destroy() {
        super.destroy();
        for (const r of this.records) {
            r.obj.destroy();
        }
    }
}

/** Swallows property writes and method calls, like AS2 does for an undefined target. */
const NULL_CLIP = new Proxy({}, {
    get: (_t, prop) => (prop === 'get' || prop === 'c' ? () => NULL_CLIP : typeof prop === 'string' && /^[a-z]/i.test(prop) ? () => undefined : undefined),
    set: () => true,
});
