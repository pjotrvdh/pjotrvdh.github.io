import { Button, DisplayObject, Graphic, MovieClip, TextField } from './display.js';
import { CHARS, library, STAGE } from './library.js';
import { Renderer } from './draw.js';

/*
 * Plays the exported movie: the root timeline at the original frame rate, input (mouse, keyboard,
 * buttons), frame scripts and clip events from a script table (src/game/scripts.js), and the sounds
 * the timelines start. The game code drives it through the AS2-like API of the display objects.
 *
 * Each frame: timelines advance (new frames place and remove children), then enterFrame handlers
 * run, then the queued frame scripts. Drawing is separate, at the display's refresh rate, with
 * positions interpolated between the last two frames.
 */

export class Player {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {object} scripts {frames, clips, buttons}: see src/game/scripts.js
     * @param {object} audio the sound engine (src/game/audio.js)
     */
    constructor(canvas, scripts, audio) {
        this.canvas = canvas;
        this.scripts = scripts;
        this.audio = audio;
        this.renderer = new Renderer(canvas);
        this.width = STAGE.width;
        this.height = STAGE.height;
        this.fps = STAGE.fps;
        // Off the stage until the mouse moves, so nothing starts out hovered.
        this.mouseX = -100;
        this.mouseY = -100;
        this.keys = new Set();
        this.keyListeners = new Set();
        this.queue = [];
        this.events = [];
        this.pressed = null;
        this.hover = null;
        this.tickCount = 0;
        this.root = this.makeRoot();
    }

    makeRoot() {
        const root = new MovieClip(this, 'root', library.root);
        root.name = '_root';
        Object.defineProperty(root, 'scriptKey', { value: 'root' });
        return root;
    }

    /** Starts the root timeline at frame 1. */
    start() {
        this.root.applyFrame(1, true);
        this.root.frame = 1;
        this.queueFrame(this.root, 1);
        this.runQueue();
    }

    /** A new display object for a character id. */
    create(id) {
        const ch = CHARS[id];
        if (!ch) {
            return null;
        }
        switch (ch.t) {
            case 'sprite':
                return new MovieClip(this, id, ch);
            case 'button':
                return new Button(this, id, ch);
            case 'edit':
                return new TextField(this, id, ch);
            case 'shape':
            case 'morph':
            case 'text':
                return new Graphic(this, id, ch);
            default:
                return null;
        }
    }

    /**
     * Sets up a child that was just placed: a movie clip gets frame 1 and its clip events
     * (onClipEvent handlers from scripts.clips, by "<parent sprite>:<depth>").
     */
    initChild(child, parent, placement, events = null) {
        if (!(child instanceof MovieClip)) {
            return;
        }
        // Shows frame 1 this frame; it starts advancing on the next one.
        child.bornTick = this.tickCount;
        if (events) {
            child.clipEvents = events;
        } else if (parent && placement) {
            child.clipEvents = this.scripts.clips?.[`${parent.scriptKey}:${placement.depth}`] ?? null;
        }
        child.applyFrame(1, true);
        child.frame = 1;
        // The game may add to a clip as it is placed (the pirate hat).
        this.onPlaced?.(child);
        if (child.char.stream?.frame === 1) {
            this.syncStream(child);
        }
        this.queueFrame(child, 1);
        if (child.clipEvents?.load) {
            this.queue.push(() => !child.removed && child.clipEvents.load(child));
        }
    }

    queueFrame(clip, frame) {
        const f = clip.char.frames[frame - 1];
        if (!f || (!f.actions && !f.script)) {
            return;
        }
        this.queue.push(() => {
            if (clip.removed) {
                return;
            }
            for (const a of f.actions ?? []) {
                if (a.stop) {
                    clip.stop();
                } else if (a.play) {
                    clip.play();
                }
                if (a.goto !== undefined) {
                    if (a.play) {
                        clip.gotoAndPlay(a.goto);
                    } else {
                        clip.gotoAndStop(a.goto);
                    }
                }
            }
            if (f.script) {
                const fn = this.scripts.frames?.[clip.scriptKey]?.[frame];
                if (fn) {
                    fn(clip);
                } else if (import.meta.env?.DEV) {
                    console.warn(`No script for ${clip.scriptKey} frame ${frame}`);
                }
            }
        });
    }

    runQueue() {
        let guard = 0;
        while (this.queue.length && guard++ < 10000) {
            this.queue.shift()();
        }
    }

    /** Calls fn for every movie clip on the display list (parents before children). */
    eachClip(fn, clip = this.root) {
        fn(clip);
        for (const c of [...(clip.children ?? [])]) {
            if (c.children && !c.removed) {
                this.eachClip(fn, c);
            }
        }
    }

    fireClipEvent(clip, name, ...args) {
        clip.clipEvents?.[name]?.(clip, ...args);
    }

    /* ----- the frame ----- */

    /** Remembers every object's matrix, so drawing can interpolate towards the next frame. */
    snapshot(obj = this.root) {
        obj.prevM = obj.m.slice();
        for (const c of obj.children ?? []) {
            this.snapshot(c);
        }
    }

    tick() {
        this.snapshot();
        this.tickCount++;
        // Scripts queued between frames (a goto from outside) run before the timelines move on.
        this.runQueue();
        this.handleEvents();
        this.eachClip((clip) => {
            if (clip instanceof MovieClip && clip.bornTick !== this.tickCount) {
                clip.advance();
            }
        });
        this.runQueue();
        this.eachClip((clip) => {
            if (!(clip instanceof MovieClip) || clip.removed) {
                return;
            }
            clip.clipEvents?.enterFrame?.(clip);
            if (!clip.removed && clip.onEnterFrame) {
                clip.onEnterFrame.call(clip, clip);
            }
        });
        this.runQueue();
    }

    /** Draws the frame; `alpha` (0..1) interpolates from the previous frame, `view` is the layout (see Renderer.render()). */
    draw(view, alpha = 1) {
        this.renderer.alpha = alpha;
        this.renderer.render(this.root, STAGE.background, this.width, this.height, view);
    }

    /* ----- input ----- */

    /** Input from the page, handled at the start of the next frame. */
    pushEvent(type, data = {}) {
        this.events.push({ type, ...data });
    }

    handleEvents() {
        const events = this.events;
        this.events = [];
        for (const e of events) {
            if (e.x !== undefined) {
                this.mouseX = e.x;
                this.mouseY = e.y;
            }
            if (e.type === 'mousemove') {
                this.updateHover();
                this.broadcast('onMouseMove', 'mouseMove');
            } else if (e.type === 'mousedown') {
                this.updateHover();
                if (this.hover) {
                    this.pressed = this.hover;
                    this.hover.updateState('down');
                }
                this.broadcast('onMouseDown', 'mouseDown');
            } else if (e.type === 'mouseup') {
                const btn = this.pressed;
                this.pressed = null;
                this.updateHover();
                if (btn && btn === this.hover && !btn.removed) {
                    this.scripts.buttons?.[btn.id]?.(btn, btn.parent);
                    this.runQueue();
                }
                this.broadcast('onMouseUp', 'mouseUp');
            } else if (e.type === 'keydown') {
                this.keys.add(e.code);
                for (const l of [...this.keyListeners]) {
                    l.onKeyDown?.(e.code);
                }
                this.eachClip((clip) => clip.clipEvents?.keyDown?.(clip, e.code));
            } else if (e.type === 'keyup') {
                this.keys.delete(e.code);
                for (const l of [...this.keyListeners]) {
                    l.onKeyUp?.(e.code);
                }
            }
            this.runQueue();
        }
    }

    broadcast(handler, clipEvent) {
        this.eachClip((clip) => {
            if (clip.removed) {
                return;
            }
            clip.clipEvents?.[clipEvent]?.(clip);
            if (!clip.removed && clip[handler]) {
                clip[handler].call(clip, clip);
            }
        });
    }

    /** The topmost enabled button under the mouse, with over/up states updated. */
    updateHover() {
        const btn = this.buttonAt(this.root, this.mouseX, this.mouseY);
        if (btn !== this.hover) {
            if (this.hover && !this.hover.removed) {
                this.hover.updateState('up');
            }
            this.hover = btn;
        }
        if (btn) {
            btn.updateState(this.pressed === btn ? 'down' : 'over');
        }
        this.canvas.style.cursor = btn ? 'pointer' : '';
    }

    buttonAt(clip, x, y) {
        if (!clip.visibleFlag) {
            return null;
        }
        for (let i = (clip.children?.length ?? 0) - 1; i >= 0; i--) {
            const c = clip.children[i];
            if (c.clipDepth || !c.visibleFlag) {
                continue;
            }
            if (c instanceof Button) {
                if (c.enabled && c.hitArea(x, y)) {
                    return c;
                }
            } else if (c instanceof MovieClip) {
                const hit = this.buttonAt(c, x, y);
                if (hit) {
                    return hit;
                }
            }
        }
        return null;
    }

    /** Key.isDown with a DOM key code ('ArrowLeft', 'Space', ...). */
    isDown(code) {
        return this.keys.has(code);
    }

    /* ----- AS2 variables (text fields bind to them) ----- */

    /** Resolves a variable path like "_root.casha" or "rdis" from a timeline. */
    target(scope, path) {
        const parts = path.split(/[.:/]/);
        const name = parts.pop();
        let obj = scope;
        for (const p of parts) {
            if (p === '_root') {
                obj = this.root;
            } else if (p === '_parent') {
                obj = obj?.parent;
            } else if (p) {
                obj = obj?.get?.(p);
            }
        }
        return { obj, name };
    }

    resolveVariable(scope, path) {
        const { obj, name } = this.target(scope, path);
        return obj?.vars?.[name];
    }

    assignVariable(scope, path, value) {
        const { obj, name } = this.target(scope, path);
        if (obj?.vars) {
            obj.vars[name] = value;
        }
    }

    /* ----- streamed sound of a timeline ----- */

    /** Starts (or restarts in sync) the stream sound of a playing clip from its current frame. */
    syncStream(clip) {
        const s = clip.char?.stream;
        if (!s || !clip.playing || clip.removed) {
            return;
        }
        const offset = (clip.frame - s.frame) / this.fps;
        this.stopStream(clip);
        if (offset >= 0) {
            clip.stream = this.audio.playStream(s.file, offset);
        }
    }

    stopStream(clip) {
        if (clip.stream) {
            clip.stream.stop();
            clip.stream = null;
        }
    }
}

export { DisplayObject, MovieClip };
