import { CHARS } from './library.js';
import { cssColor, invert, multiply, multiplyColor, transformBounds } from './matrix.js';
import { drawEditText, drawStaticText } from './text.js';

/*
 * Draws the display list on a 2D canvas the way Flash did: vector shapes with solid and gradient
 * fills, strokes, morph shapes at their ratio, texts, colour transforms (applied to the fill
 * colours), masks (clip depths), and glow/drop-shadow filters and blend modes through an
 * offscreen layer. Also does the shape hit tests for hitTest(x, y, true).
 */

const G = 819.2; // Half the gradient square: 16384 twips.

const pathCache = new WeakMap();

/** Path2D objects for a shape's path entries. */
function shapePaths(ch) {
    let paths = pathCache.get(ch);
    if (!paths) {
        paths = ch.paths.map((p) => new Path2D(p[2]));
        pathCache.set(ch, paths);
    }
    return paths;
}

/** For gradient fills: the path mapped into the gradient's own space (cached per shape). */
const fillSpaceCache = new WeakMap();

function fillSpacePath(ch, i, path, m) {
    let cache = fillSpaceCache.get(ch);
    if (!cache) {
        cache = new Map();
        fillSpaceCache.set(ch, cache);
    }
    let entry = cache.get(i);
    if (entry === undefined) {
        const inv = invert(m);
        if (inv) {
            const p = new Path2D();
            p.addPath(path, new DOMMatrix(inv));
            entry = p;
        } else {
            entry = null;
        }
        cache.set(i, entry);
    }
    return entry;
}

const lerp = (a, b, t) => a + (b - a) * t;
const lerpArr = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));

/** Morph shapes: Path2D objects per path entry at a ratio (cached per ratio). */
const morphCache = new WeakMap();

function morphPaths(ch, ratio) {
    let cache = morphCache.get(ch);
    if (!cache) {
        cache = new Map();
        morphCache.set(ch, cache);
    }
    const k = Math.round(ratio * 1000);
    let paths = cache.get(k);
    if (!paths) {
        const t = k / 1000;
        paths = ch.paths.map(([, , d]) => {
            const p = new Path2D();
            let j = 0;
            const v = () => {
                const r = lerp(d.a[j], d.b[j], t);
                j++;
                return r;
            };
            let sx = 0;
            let sy = 0;
            for (const c of d.cmd) {
                if (c === 'M') {
                    sx = v();
                    sy = v();
                    p.moveTo(sx, sy);
                } else if (c === 'Q') {
                    p.quadraticCurveTo(v(), v(), v(), v());
                } else if (c === 'Z') {
                    p.closePath();
                }
            }
            return p;
        });
        if (cache.size > 64) {
            cache.clear();
        }
        cache.set(k, paths);
    }
    return paths;
}

function morphFill(f, t) {
    if (t === 0 || !f) {
        return f;
    }
    const out = { ...f };
    if (f.c2) {
        out.c = lerpArr(f.c, f.c2, t);
    }
    if (f.m2) {
        out.m = lerpArr(f.m, f.m2, t);
    }
    if (f.st2) {
        out.st = f.st.map((s, i) => lerpArr(s, f.st2[i], t));
    }
    if (f.w2 !== undefined) {
        out.w = lerp(f.w, f.w2, t);
    }
    return out;
}

/** A canvas fill style for a gradient fill, in the gradient's own space. */
function gradientStyle(ctx, f, cx) {
    const g = f.k === 'l' ? ctx.createLinearGradient(-G, 0, G, 0) : ctx.createRadialGradient((f.focal ?? 0) * G, 0, 0, 0, 0, G);
    for (const [ratio, r, gg, b, a] of f.st) {
        g.addColorStop(Math.min(1, Math.max(0, ratio)), cssColor([r, gg, b, a], cx));
    }
    return g;
}

/** Fills one path with fill style f; the context is in the shape's coordinates. */
function fillPath(ctx, ch, i, path, f, cx, morph) {
    if (f.k === 's') {
        ctx.fillStyle = cssColor(f.c, cx);
        ctx.fill(path, 'evenodd');
        return;
    }
    const inGradientSpace = morph ? mapPath(path, f.m) : fillSpacePath(ch, i, path, f.m);
    if (!inGradientSpace) {
        return;
    }
    ctx.save();
    ctx.transform(...f.m);
    ctx.fillStyle = gradientStyle(ctx, f, cx);
    ctx.fill(inGradientSpace, 'evenodd');
    ctx.restore();
}

function mapPath(path, m) {
    const inv = invert(m);
    if (!inv) {
        return null;
    }
    const p = new Path2D();
    p.addPath(path, new DOMMatrix(inv));
    return p;
}

function strokePath(ctx, path, l, cx, pixel) {
    ctx.strokeStyle = cssColor(l.c, cx);
    ctx.lineWidth = Math.max(l.w, pixel);
    ctx.lineCap = l.cap ?? 'round';
    ctx.lineJoin = l.join ?? 'round';
    if (l.miter) {
        ctx.miterLimit = l.miter;
    }
    ctx.stroke(path);
}

function drawShape(ctx, obj, cx, pixel) {
    const ch = obj.char;
    const morph = ch.t === 'morph';
    const paths = morph ? morphPaths(ch, obj.ratio) : shapePaths(ch);
    for (let i = 0; i < ch.paths.length; i++) {
        const [kind, idx] = ch.paths[i];
        if (kind === 'f') {
            const f = morph ? morphFill(ch.fills[idx], obj.ratio) : ch.fills[idx];
            if (f) {
                fillPath(ctx, ch, i, paths[i], f, cx, morph);
            }
        } else {
            const l = morph ? morphFill(ch.lines[idx], obj.ratio) : ch.lines[idx];
            if (l) {
                strokePath(ctx, paths[i], l, cx, pixel);
            }
        }
    }
}

/** Shape hit test in the shape's own coordinates (fills, and strokes of line-only shapes). */
const hitCtx = (() => {
    const c = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    return c ? c.getContext('2d') : null;
})();

export function hitShape(obj, x, y) {
    const ch = obj.char;
    const paths = ch.t === 'morph' ? morphPaths(ch, obj.ratio) : shapePaths(ch);
    for (let i = 0; i < ch.paths.length; i++) {
        if (ch.paths[i][0] === 'f') {
            if (hitCtx.isPointInPath(paths[i], x, y, 'evenodd')) {
                return true;
            }
        } else {
            hitCtx.lineWidth = Math.max(1, ch.lines[ch.paths[i][1]]?.w ?? 1);
            if (hitCtx.isPointInStroke(paths[i], x, y)) {
                return true;
            }
        }
    }
    return false;
}

const BLEND = { 3: 'multiply', 4: 'screen', 5: 'lighten', 6: 'darken', 7: 'difference', 8: 'lighter', 13: 'overlay', 14: 'hard-light' };

/** Adds the outlines of a mask object (and its children) to a Path2D in device space. */
function addMaskGeometry(target, obj, m) {
    if (!obj.visibleFlag && obj.parent && !obj.clipDepth) {
        // Invisible masks still mask in Flash; keep going.
    }
    const ch = obj.char;
    if (ch?.t === 'shape' || ch?.t === 'morph') {
        const paths = ch.t === 'morph' ? morphPaths(ch, obj.ratio) : shapePaths(ch);
        ch.paths.forEach((p, i) => {
            if (p[0] === 'f') {
                target.addPath(paths[i], new DOMMatrix(m));
            }
        });
    } else if (ch?.t === 'text') {
        const b = ch.b;
        const r = new Path2D();
        r.rect(b[0], b[1], b[2] - b[0], b[3] - b[1]);
        target.addPath(r, new DOMMatrix(multiply(m, ch.m)));
    }
    for (const c of obj.children ?? []) {
        addMaskGeometry(target, c, multiply(m, c.m));
    }
}

/** Interpolates a matrix between the last two frames, unless it jumped (teleports, flips). */
function between(prev, m, t) {
    if (!prev || t >= 1) {
        return m;
    }
    if (Math.abs(prev[4] - m[4]) + Math.abs(prev[5] - m[5]) > 120) {
        return m;
    }
    if (Math.abs(prev[0] - m[0]) + Math.abs(prev[1] - m[1]) + Math.abs(prev[2] - m[2]) + Math.abs(prev[3] - m[3]) > 0.6) {
        return m;
    }
    return [0, 1, 2, 3, 4, 5].map((i) => prev[i] + (m[i] - prev[i]) * t);
}

/**
 * The renderer. The canvas is the whole window; `base` maps stage coordinates to it (see `view` in
 * render()). The stage is shown as large as fits; to fill the rest of the window:
 * - in every scene, backgrounds (shapes that cover the stage, or span its full width or height) are
 *   scaled or stretched to the window's edges (`fillMatrix()`), so menus and boards stay whole and the
 *   scene goes edge to edge;
 * - in flight (`view.mode === 'world'`) the world around the stage is drawn as well, and `stretch`
 *   clips (the sky) are stretched over the window.
 * `overlays` (the scene fades) always cover the whole window. Root children in `skip` are not drawn
 * (the options menu, HUD and score board, replaced by HTML in src/game/hud.js).
 * `alpha` (0..1) is how far the display is between the last frame and the next: positions are
 * interpolated from `prevM` for smooth motion at any refresh rate.
 */
export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.base = [1, 0, 0, 1, 0, 0];
        this.layers = [];
        this.alpha = 1;
        this.skip = new Set();
        this.overlays = new Set();
        this.stretch = new Set();
        /**
         * Clips whose picture area is scaled evenly to cover the window's width and the height below
         * `top` (CSS px): {rect: [x0, y0, x1, y1] in stage coordinates, top}.
         */
        this.coverRects = new Map();
        /**
         * Shapes that go on to the window's left (or top) edge: a slice [a, b] of the shape (in its own
         * coordinates; x for `left`, y for `up`) is stretched from that edge to `from`, where the
         * shape's land (or sky) starts, and over its first `overlap` units, which hides the shape's
         * edge there (drawExtension()). Entries: {from, slice: [a, b], up?, overlap?}.
         */
        this.extend = new Map();
        this.fill = null;
    }

    /**
     * @param {object} view {mode: 'world' | 'scene', dpr, s (CSS px per stage px), ox, oy (CSS px of the stage's top left)}
     */
    render(root, background, stageW, stageH, view) {
        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;
        const k = view.s * view.dpr;
        const base = [k, 0, 0, k, view.ox * view.dpr, view.oy * view.dpr];
        this.dpr = view.dpr;
        this.base = base;
        const children = root.children.filter((c) => !this.skip.has(c.id) && !this.overlays.has(c.id));
        const rootM = multiply(base, root.m);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.fillStyle = `rgb(${background.join(',')})`;
        ctx.fillRect(0, 0, W, H);

        // The stage in canvas pixels, for finding backgrounds to scale up.
        const sx0 = base[4];
        const sy0 = base[5];
        // (Not in flight: there the world itself fills the window.)
        this.fill = view.mode === 'world' ? null : { x0: sx0, y0: sy0, x1: sx0 + stageW * k, y1: sy0 + stageH * k, cx: sx0 + (stageW * k) / 2, cy: sy0 + (stageH * k) / 2, W, H };
        if (view.mode === 'world') {
            // The visible part of the world, in stage coordinates.
            const x0 = -view.ox / view.s;
            const y0 = -view.oy / view.s;
            const vw = W / k;
            const vh = H / k;
            this.drawChildren(ctx, children, rootM, root.cx, (c) => (this.stretch.has(c.id) ? multiply(rootM, [vw / stageW, 0, 0, vh / stageH, x0, y0]) : null));
        } else {
            this.extendEdges(ctx, children, root, stageW, stageH, sx0, sy0, k);
            this.drawChildren(ctx, children, rootM, root.cx);
        }

        // Fades over the whole window, on their own canvas above the HTML screens (`fxCanvas`) if there is one.
        this.fill = null;
        const octx = this.fxCanvas ? this.fxCanvas.getContext('2d') : ctx;
        if (this.fxCanvas) {
            octx.setTransform(1, 0, 0, 1, 0, 0);
            octx.clearRect(0, 0, this.fxCanvas.width, this.fxCanvas.height);
        }
        const overlays = root.children.filter((c) => this.overlays.has(c.id));
        if (overlays.length) {
            const cs = Math.max(W / stageW, H / stageH);
            const cover = [cs, 0, 0, cs, (W - stageW * cs) / 2, (H - stageH * cs) / 2];
            this.drawChildren(octx, overlays, multiply(cover, root.m), root.cx);
        }
    }

    /**
     * Draws slice [a, b] of a shape stretched from the window's left edge to x `from` of the shape,
     * or with `up` from the top edge to y `from`.
     */
    drawExtension(ctx, obj, m, cx, { from, slice: [a, b], up = false, overlap = 0 }) {
        const scale = up ? m[3] : m[0];
        const start = scale * from + (up ? m[5] : m[4]);
        if (start <= 0 || !scale) {
            return;
        }
        // Over the shape's first `overlap` units (its edge), plus a pixel against seams.
        const end = start + overlap * Math.abs(scale) + 1;
        const k = end / (scale * (b - a));
        const shift = -k * (scale * a + (up ? m[5] : m[4]));
        const stretched = multiply(up ? [1, 0, 0, k, 0, shift] : [k, 0, 0, 1, shift, 0], m);
        const bounds = obj.char.b;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.beginPath();
        ctx.rect(0, 0, up ? this.canvas.width : end, up ? end : this.canvas.height);
        ctx.clip();
        ctx.setTransform(...stretched);
        ctx.beginPath();
        if (up) {
            ctx.rect(bounds[0], a, bounds[2] - bounds[0], b - a);
        } else {
            ctx.rect(a, bounds[1], b - a, bounds[3] - bounds[1]);
        }
        ctx.clip();
        drawShape(ctx, obj, cx, 1 / Math.sqrt(Math.abs(stretched[0] * stretched[3]) || 1));
        ctx.restore();
    }

    /** The matrix (in canvas pixels) that scales a stage rect evenly to cover the window below `top`. */
    coverMatrix({ rect: [x0, y0, x1, y1], top = 0 }) {
        const b = this.base;
        const f = this.fill;
        const inset = top * this.dpr;
        const rx0 = b[0] * x0 + b[4];
        const ry0 = b[3] * y0 + b[5];
        const rw = b[0] * (x1 - x0);
        const rh = b[3] * (y1 - y0);
        const k = Math.max(f.W / rw, (f.H - inset) / rh);
        // Centred sideways; the top at `inset`, the rest goes below the window's bottom edge.
        return [k, 0, 0, k, f.W / 2 - k * (rx0 + rw / 2), inset - k * ry0];
    }

    /**
     * Fills the window outside the stage with the scene's own edge colours: the scene is drawn small
     * and its outermost rows and columns are stretched out to the window's edges. Backgrounds drawn
     * over it (fillMatrix()) cover most of that; this fills what their shapes leave open.
     */
    extendEdges(ctx, children, root, stageW, stageH, x0, y0, k) {
        const W = this.canvas.width;
        const H = this.canvas.height;
        const x1 = x0 + stageW * k;
        const y1 = y0 + stageH * k;
        if (x0 <= 0.5 && y0 <= 0.5 && x1 >= W - 0.5 && y1 >= H - 0.5) {
            return;
        }
        const ew = 160;
        const eh = 120;
        if (!this.edgeCanvas) {
            this.edgeCanvas = document.createElement('canvas');
            this.edgeCanvas.width = ew;
            this.edgeCanvas.height = eh;
        }
        const ectx = this.edgeCanvas.getContext('2d');
        ectx.setTransform(1, 0, 0, 1, 0, 0);
        ectx.fillStyle = ctx.fillStyle;
        ectx.fillRect(0, 0, ew, eh);
        const fill = this.fill;
        const base = this.base;
        this.fill = null;
        this.base = [ew / stageW, 0, 0, eh / stageH, 0, 0];
        this.drawChildren(ectx, children, multiply(this.base, root.m), root.cx);
        this.fill = fill;
        this.base = base;
        const e = this.edgeCanvas;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = true;
        // Each side gets the stage's edge row or column, stretched outwards; each corner its corner pixel.
        const sides = [
            [0, 0, ew, 1, x0, 0, x1 - x0, y0],
            [0, eh - 1, ew, 1, x0, y1, x1 - x0, H - y1],
            [0, 0, 1, eh, 0, y0, x0, y1 - y0],
            [ew - 1, 0, 1, eh, x1, y0, W - x1, y1 - y0],
            [0, 0, 1, 1, 0, 0, x0, y0],
            [ew - 1, 0, 1, 1, x1, 0, W - x1, y0],
            [0, eh - 1, 1, 1, 0, y1, x0, H - y1],
            [ew - 1, eh - 1, 1, 1, x1, y1, W - x1, H - y1],
        ];
        for (const [sx, sy, sw, sh, dx, dy, dw, dh] of sides) {
            if (dw > 0 && dh > 0) {
                // One pixel of overlap hides the seam at the stage's edge.
                ctx.drawImage(e, sx, sy, sw, sh, Math.floor(dx) - (dx > 0 ? 1 : 0), Math.floor(dy) - (dy > 0 ? 1 : 0), Math.ceil(dw) + 2, Math.ceil(dh) + 2);
            }
        }
    }

    /**
     * Backgrounds go edge to edge. A shape about the size of the stage (a board, a gradient) is
     * stretched so its edges meet the window's; a bigger one that covers the stage is scaled up evenly
     * around the stage's centre until it covers the window. A band that spans the stage's full width (a sky,
     * the snow) is stretched sideways to the window's edges; one that spans its full height, up and
     * down. Anything else is drawn as it is.
     */
    fillMatrix(obj, m) {
        const f = this.fill;
        const t = obj.char?.t;
        if (!f || (t !== 'shape' && t !== 'morph') || (f.x0 <= 0 && f.y0 <= 0 && f.x1 >= f.W && f.y1 >= f.H)) {
            return m;
        }
        const b = transformBounds(m, obj.char.b);
        const sw = f.x1 - f.x0;
        const sh = f.y1 - f.y0;
        const tol = 0.03;
        const spansX = b[0] <= f.x0 + sw * tol && b[2] >= f.x1 - sw * tol;
        const spansY = b[1] <= f.y0 + sh * tol && b[3] >= f.y1 - sh * tol;
        if (!spansX && !spansY) {
            return m;
        }
        const reachX = (v0, v1) => Math.max(1, f.cx / Math.max(1e-6, f.cx - v0), (f.W - f.cx) / Math.max(1e-6, v1 - f.cx));
        const reachY = (v0, v1) => Math.max(1, f.cy / Math.max(1e-6, f.cy - v0), (f.H - f.cy) / Math.max(1e-6, v1 - f.cy));
        let kx = 1;
        let ky = 1;
        const stageSized = spansX && spansY && b[2] - b[0] <= sw * 1.12 && b[3] - b[1] <= sh * 1.12;
        if (stageSized) {
            // A backdrop the size of the stage (a board, a gradient): its edges go to the window's edges.
            const kx2 = f.W / (b[2] - b[0]);
            const ky2 = f.H / (b[3] - b[1]);
            return multiply([kx2, 0, 0, ky2, -b[0] * kx2, -b[1] * ky2], m);
        }
        if (spansX && spansY) {
            // A bigger picture: scaled evenly, so nothing in it is distorted.
            kx = ky = Math.max(reachX(b[0], b[2]), reachY(b[1], b[3]));
        } else if (spansX) {
            kx = reachX(b[0], b[2]);
        } else {
            ky = reachY(b[1], b[3]);
        }
        if (kx <= 1.0005 && ky <= 1.0005) {
            return m;
        }
        return multiply([kx, 0, 0, ky, f.cx * (1 - kx), f.cy * (1 - ky)], m);
    }

    drawChildren(ctx, children, m, cx, override = null) {
        let maskEnd = null;
        for (let i = 0; i < children.length; i++) {
            const c = children[i];
            if (maskEnd !== null && c.depth > maskEnd) {
                ctx.restore();
                maskEnd = null;
            }
            if (c.clipDepth) {
                if (maskEnd !== null) {
                    ctx.restore();
                }
                const path = new Path2D();
                addMaskGeometry(path, c, multiply(m, c.m));
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.clip(path, 'nonzero');
                maskEnd = c.clipDepth;
                continue;
            }
            this.drawObject(ctx, c, m, cx, override?.(c));
        }
        if (maskEnd !== null) {
            ctx.restore();
        }
    }

    drawObject(ctx, obj, parentM, parentCx, fixedM = null) {
        if (!obj.visibleFlag) {
            return;
        }
        let m = fixedM ?? this.fillMatrix(obj, multiply(parentM, between(obj.prevM, obj.m, this.alpha)));
        const rect = this.fill && this.coverRects.get(obj.id);
        if (rect) {
            m = multiply(this.coverMatrix(rect), m);
        }
        const cx = multiplyColor(parentCx, obj.cx);
        if (cx && cx[3] <= 0 && cx[7] <= 0) {
            return;
        }
        if ((obj.filters?.length || BLEND[obj.blend]) && !this.inLayer) {
            this.drawLayer(ctx, obj, m, cx);
        } else {
            this.drawContent(ctx, obj, m, cx);
        }
        // Drawn over the shape's own edge, so its outline at `from` doesn't show.
        const extend = this.fill && this.extend.get(obj.id);
        if (extend) {
            this.drawExtension(ctx, obj, m, cx, extend);
        }
    }

    drawContent(ctx, obj, m, cx) {
        const ch = obj.char;
        if (obj.children) {
            this.drawChildren(ctx, obj.children, m, cx);
            return;
        }
        if (!ch) {
            return;
        }
        ctx.setTransform(...m);
        const pixel = 1 / Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]) || 1);
        if (ch.t === 'shape' || ch.t === 'morph') {
            drawShape(ctx, obj, cx, pixel);
        } else if (ch.t === 'text') {
            drawStaticText(ctx, ch, (c) => cssColor(c, cx));
        } else if (ch.t === 'edit') {
            drawEditText(ctx, ch, obj.text, (c) => cssColor(c, cx), obj.textColor);
        }
    }

    /** Draws an object with filters or a blend mode: into an offscreen canvas, then composited. */
    drawLayer(ctx, obj, m, cx) {
        const local = obj.localBounds();
        if (!local) {
            return;
        }
        const pad = Math.ceil(Math.max(0, ...(obj.filters ?? []).map((f) => f.blur + (f.distance ?? 0))) * Math.hypot(this.base[0], this.base[1])) + 2;
        const b = transformBounds(m, local);
        // A layer as big as most of the stage may hold a background that fills the window: then the
        // layer is the whole canvas, so the background can reach the edges.
        const f = this.fill;
        const big = f && (b[2] - b[0] >= (f.x1 - f.x0) * 0.9 || b[3] - b[1] >= (f.y1 - f.y0) * 0.9);
        const x0 = big ? 0 : Math.floor(b[0]) - pad;
        const y0 = big ? 0 : Math.floor(b[1]) - pad;
        const w = Math.min(4096, big ? f.W : Math.ceil(b[2]) + pad - x0);
        const h = Math.min(4096, big ? f.H : Math.ceil(b[3]) + pad - y0);
        if (w <= 0 || h <= 0) {
            return;
        }
        let layer = this.layers.pop();
        if (!layer) {
            layer = document.createElement('canvas');
        }
        if (layer.width < w || layer.height < h) {
            layer.width = Math.max(layer.width, w);
            layer.height = Math.max(layer.height, h);
        }
        const lctx = layer.getContext('2d');
        lctx.setTransform(1, 0, 0, 1, 0, 0);
        lctx.clearRect(0, 0, layer.width, layer.height);
        this.inLayer = true;
        // Inside a whole-canvas layer the coordinates are the canvas's, so backgrounds still fill.
        this.fill = big ? f : null;
        this.drawContent(lctx, obj, multiply([1, 0, 0, 1, -x0, -y0], m), cx);
        this.fill = f;
        this.inLayer = false;

        const scale = Math.hypot(this.base[0], this.base[1]);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = BLEND[obj.blend] ?? 'source-over';
        for (const f of obj.filters ?? []) {
            if (f.inner) {
                continue;
            }
            const [r, g, bl, a] = f.color;
            ctx.shadowColor = `rgba(${r},${g},${bl},${Math.min(1, (a / 255) * Math.min(f.strength, 2))})`;
            ctx.shadowBlur = f.blur * scale;
            const dist = (f.distance ?? 0) * scale;
            ctx.shadowOffsetX = Math.cos(((f.angle ?? 0) * Math.PI) / 180) * dist;
            ctx.shadowOffsetY = Math.sin(((f.angle ?? 0) * Math.PI) / 180) * dist;
            ctx.drawImage(layer, 0, 0, w, h, x0, y0, w, h);
        }
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        if (!obj.filters?.length || obj.filters.every((f) => f.inner)) {
            ctx.drawImage(layer, 0, 0, w, h, x0, y0, w, h);
        }
        ctx.restore();
        this.layers.push(layer);
    }
}

export { CHARS };
