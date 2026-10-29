/**
 * Exports the graphics, fonts, texts, animations and sounds of the original Flash game into
 * learn-to-fly/src/assets, so the HTML5 version draws and plays the very same assets.
 *
 * Usage, from the repository root, with the original SWF at ./downloads/learn-to-fly.swf (ignored by git):
 *     node learn-to-fly/tools/import-swf.mjs
 *
 * It writes:
 * - src/assets/library.json: every shape (as SVG path data per fill and line style), morph shape,
 *   font, static and dynamic text field, button and sprite timeline, plus the root timeline.
 * - src/assets/bitmaps/<id>.png|jpg: the bitmaps (JPEGs with an alpha channel get a <id>.alpha.png mask).
 * - src/assets/sounds/<id>.mp3: event sounds, and stream-<sprite>.mp3 for sound streamed in a timeline.
 *
 * Left out (see LEFT_OUT): the loader, the intro cutscene and the sponsor (MaxGames); the game
 * starts in the main menu. Characters nothing uses any more are dropped too.
 *
 * The ActionScript is not exported: the game logic is rewritten in src/game. Frame scripts that only
 * stop, play or jump are kept as timeline actions; every other frame script is marked `script` and has
 * a handler in src/game/scripts.js. See .docs/assets.md.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

const SOURCE = 'downloads/learn-to-fly.swf';
const TARGET = 'learn-to-fly/src/assets';

/**
 * Characters that are not exported, with their placements: the loader (background 9, percentage 11,
 * animation 31, texts 32-35 and version number 39), the sponsor intro (sprite 103 with 65, 44-47),
 * the MaxGames logo (bitmaps 36, 43, shape 37, buttons 38 and "Play more games at" 310), its jingle
 * (41), the intro cutscene (259) and the main menu's "A game by Light Bringer" (262). The game starts
 * in the main menu (src/game/start.js).
 */
const LEFT_OUT = new Set([9, 11, 31, 32, 33, 34, 35, 36, 37, 38, 39, 41, 43, 44, 45, 46, 47, 65, 103, 259, 262, 310]);

/** Reads bytes and bit fields from a SWF buffer. */
class Reader {
    constructor(buf, pos = 0) {
        this.buf = buf;
        this.pos = pos;
        this.bitPos = 0;
        this.bitBuf = 0;
    }

    align() {
        this.bitPos = 0;
    }

    u8() {
        this.align();
        return this.buf[this.pos++];
    }

    u16() {
        this.align();
        const v = this.buf.readUInt16LE(this.pos);
        this.pos += 2;
        return v;
    }

    s16() {
        this.align();
        const v = this.buf.readInt16LE(this.pos);
        this.pos += 2;
        return v;
    }

    u32() {
        this.align();
        const v = this.buf.readUInt32LE(this.pos);
        this.pos += 4;
        return v;
    }

    bytes(n) {
        this.align();
        const b = this.buf.subarray(this.pos, this.pos + n);
        this.pos += n;
        return b;
    }

    str() {
        this.align();
        const end = this.buf.indexOf(0, this.pos);
        const s = this.buf.subarray(this.pos, end).toString('latin1');
        this.pos = end + 1;
        return s;
    }

    ub(n) {
        let v = 0;
        for (let i = 0; i < n; i++) {
            if (this.bitPos === 0) {
                this.bitBuf = this.buf[this.pos++];
                this.bitPos = 8;
            }
            this.bitPos--;
            v = v * 2 + ((this.bitBuf >> this.bitPos) & 1);
        }
        return v;
    }

    sb(n) {
        if (n === 0) {
            return 0;
        }
        const v = this.ub(n);
        return v >= 2 ** (n - 1) ? v - 2 ** n : v;
    }

    fb(n) {
        return this.sb(n) / 65536;
    }

    rect() {
        this.align();
        const n = this.ub(5);
        const r = [this.sb(n), this.sb(n), this.sb(n), this.sb(n)];
        this.align();
        // xmin, xmax, ymin, ymax in twips -> [xmin, ymin, xmax, ymax] in pixels.
        return [r[0] / 20, r[2] / 20, r[1] / 20, r[3] / 20];
    }

    /** A MATRIX as [a, b, c, d, tx, ty], translation still in twips. */
    matrixRaw() {
        this.align();
        let a = 1;
        let d = 1;
        let b = 0;
        let c = 0;
        if (this.ub(1)) {
            const n = this.ub(5);
            a = this.fb(n);
            d = this.fb(n);
        }
        if (this.ub(1)) {
            const n = this.ub(5);
            b = this.fb(n);
            c = this.fb(n);
        }
        const n = this.ub(5);
        const tx = this.sb(n);
        const ty = this.sb(n);
        this.align();
        return [a, b, c, d, tx, ty];
    }

    /** A display MATRIX, translation in pixels. */
    matrix() {
        const m = this.matrixRaw();
        return [r4(m[0]), r4(m[1]), r4(m[2]), r4(m[3]), m[4] / 20, m[5] / 20];
    }

    /** A CXFORM(WITHALPHA) as [rMul, gMul, bMul, aMul, rAdd, gAdd, bAdd, aAdd]. */
    cxform(withAlpha) {
        this.align();
        const hasAdd = this.ub(1);
        const hasMul = this.ub(1);
        const n = this.ub(4);
        const cx = [1, 1, 1, 1, 0, 0, 0, 0];
        if (hasMul) {
            cx[0] = this.sb(n) / 256;
            cx[1] = this.sb(n) / 256;
            cx[2] = this.sb(n) / 256;
            if (withAlpha) {
                cx[3] = this.sb(n) / 256;
            }
        }
        if (hasAdd) {
            cx[4] = this.sb(n);
            cx[5] = this.sb(n);
            cx[6] = this.sb(n);
            if (withAlpha) {
                cx[7] = this.sb(n);
            }
        }
        this.align();
        return cx;
    }

    rgb() {
        return [this.u8(), this.u8(), this.u8(), 255];
    }

    rgba() {
        return [this.u8(), this.u8(), this.u8(), this.u8()];
    }
}

const r4 = (v) => Math.round(v * 10000) / 10000;
const px = (twips) => Math.round(twips * 5) / 100;

/* ---------- shapes ---------- */

function readGradient(r, shapeVersion, morph) {
    r.align();
    const spread = r.ub(2);
    const interp = r.ub(2);
    const count = r.ub(4);
    const stops = [];
    const endStops = [];
    for (let i = 0; i < count; i++) {
        if (morph) {
            stops.push([r.u8() / 255, ...r.rgba()]);
            endStops.push([r.u8() / 255, ...r.rgba()]);
        } else {
            stops.push([r.u8() / 255, ...(shapeVersion >= 3 ? r.rgba() : r.rgb())]);
        }
    }
    return { spread, interp, stops, endStops };
}

/** Gradient matrices map the -16384..16384 twip gradient square to shape twips. */
const gradientMatrix = (m) => [r4(m[0]), r4(m[1]), r4(m[2]), r4(m[3]), m[4] / 20, m[5] / 20];
/** Bitmap fill matrices map bitmap pixels to shape twips. */
const bitmapMatrix = (m) => [r4(m[0] / 20), r4(m[1] / 20), r4(m[2] / 20), r4(m[3] / 20), m[4] / 20, m[5] / 20];

function readFillStyle(r, shapeVersion, morph) {
    const type = r.u8();
    if (type === 0x00) {
        if (morph) {
            return { k: 's', c: r.rgba(), c2: r.rgba() };
        }
        return { k: 's', c: shapeVersion >= 3 ? r.rgba() : r.rgb() };
    }
    if (type === 0x10 || type === 0x12 || type === 0x13) {
        const m = r.matrixRaw();
        const m2 = morph ? r.matrixRaw() : null;
        const g = readGradient(r, shapeVersion, morph);
        const style = { k: type === 0x10 ? 'l' : 'r', m: gradientMatrix(m), spread: g.spread, st: g.stops };
        if (morph) {
            style.m2 = gradientMatrix(m2);
            style.st2 = g.endStops;
        }
        if (type === 0x13) {
            style.focal = r.s16() / 256;
        }
        return style;
    }
    if (type >= 0x40 && type <= 0x43) {
        const id = r.u16();
        const m = r.matrixRaw();
        const style = { k: 'b', id, m: bitmapMatrix(m), rep: type === 0x40 || type === 0x42, smooth: type < 0x42 };
        if (morph) {
            style.m2 = bitmapMatrix(r.matrixRaw());
        }
        return style;
    }
    throw new Error(`Unknown fill style ${type}`);
}

function readStyles(r, shapeVersion, morph) {
    let n = r.u8();
    if (n === 0xff && (shapeVersion >= 2 || morph)) {
        n = r.u16();
    }
    const fills = [];
    for (let i = 0; i < n; i++) {
        fills.push(readFillStyle(r, shapeVersion, morph));
    }
    let ln = r.u8();
    if (ln === 0xff) {
        ln = r.u16();
    }
    const lines = [];
    for (let i = 0; i < ln; i++) {
        if (shapeVersion === 4) {
            const w = r.u16();
            const w2 = morph ? r.u16() : 0;
            r.align();
            const startCap = r.ub(2);
            const join = r.ub(2);
            const hasFill = r.ub(1);
            r.ub(3);
            r.ub(5);
            r.ub(1);
            const endCap = r.ub(2);
            const style = { w: w / 20, cap: ['round', 'butt', 'square'][startCap] ?? 'round', join: ['round', 'bevel', 'miter'][join] ?? 'round' };
            if (join === 2) {
                style.miter = r.u16() / 256;
            }
            if (hasFill) {
                const f = readFillStyle(r, shapeVersion, morph);
                style.c = f.c ?? f.st?.[0]?.slice(1) ?? [0, 0, 0, 255];
                if (morph) {
                    style.c2 = f.c2 ?? style.c;
                }
            } else {
                style.c = r.rgba();
                if (morph) {
                    style.c2 = r.rgba();
                }
            }
            if (morph) {
                style.w2 = w2 / 20;
            }
            void endCap;
            lines.push(style);
        } else if (morph) {
            const w = r.u16();
            const w2 = r.u16();
            lines.push({ w: w / 20, w2: w2 / 20, c: r.rgba(), c2: r.rgba() });
        } else {
            const w = r.u16();
            lines.push({ w: w / 20, c: shapeVersion >= 3 ? r.rgba() : r.rgb() });
        }
    }
    return { fills, lines };
}

/**
 * Reads SHAPERECORDS into edges. Each edge: {x0, y0, cx?, cy?, x1, y1, f0, f1, ln, group}, in twips.
 * Style indices are global (offset by the styles of earlier groups), 0 = none.
 */
function readShapeRecords(r, shapeVersion, styles, morph, onlyMoves = false) {
    r.align();
    let fillBits = r.ub(4);
    let lineBits = r.ub(4);
    const edges = [];
    const moves = [];
    let x = 0;
    let y = 0;
    let f0 = 0;
    let f1 = 0;
    let ln = 0;
    let fillBase = 0;
    let lineBase = 0;
    let group = 0;
    for (;;) {
        if (r.ub(1) === 0) {
            const newStyles = r.ub(1);
            const lineFlag = r.ub(1);
            const fill1Flag = r.ub(1);
            const fill0Flag = r.ub(1);
            const moveFlag = r.ub(1);
            if (!newStyles && !lineFlag && !fill1Flag && !fill0Flag && !moveFlag) {
                break;
            }
            if (moveFlag) {
                const n = r.ub(5);
                x = r.sb(n);
                y = r.sb(n);
                moves.push(edges.length);
            }
            if (fill0Flag) {
                const v = r.ub(fillBits);
                f0 = v ? v + fillBase : 0;
            }
            if (fill1Flag) {
                const v = r.ub(fillBits);
                f1 = v ? v + fillBase : 0;
            }
            if (lineFlag) {
                const v = r.ub(lineBits);
                ln = v ? v + lineBase : 0;
            }
            if (newStyles) {
                fillBase = styles.fills.length;
                lineBase = styles.lines.length;
                const s = readStyles(r, shapeVersion, morph);
                styles.fills.push(...s.fills);
                styles.lines.push(...s.lines);
                group++;
                f0 = 0;
                f1 = 0;
                ln = 0;
                r.align();
                fillBits = r.ub(4);
                lineBits = r.ub(4);
            }
        } else if (r.ub(1)) {
            const n = r.ub(4) + 2;
            let dx = 0;
            let dy = 0;
            if (r.ub(1)) {
                dx = r.sb(n);
                dy = r.sb(n);
            } else if (r.ub(1)) {
                dy = r.sb(n);
            } else {
                dx = r.sb(n);
            }
            edges.push({ x0: x, y0: y, x1: x + dx, y1: y + dy, f0, f1, ln, group });
            x += dx;
            y += dy;
        } else {
            const n = r.ub(4) + 2;
            const cx = x + r.sb(n);
            const cy = y + r.sb(n);
            const ax = cx + r.sb(n);
            const ay = cy + r.sb(n);
            edges.push({ x0: x, y0: y, cx, cy, x1: ax, y1: ay, f0, f1, ln, group });
            x = ax;
            y = ay;
        }
    }
    void onlyMoves;
    return { edges, moves };
}

const key = (x, y) => `${x},${y}`;

/** Chains the edges of one fill style into closed loops (fill1 edges as they are, fill0 edges reversed). */
function chainFill(edges, style) {
    const list = [];
    for (const e of edges) {
        if (e.f1 === style) {
            list.push(e);
        }
        if (e.f0 === style) {
            list.push(reverse(e));
        }
    }
    const byStart = new Map();
    list.forEach((e, i) => {
        const k = key(e.x0, e.y0);
        if (!byStart.has(k)) {
            byStart.set(k, []);
        }
        byStart.get(k).push(i);
    });
    const used = new Uint8Array(list.length);
    const loops = [];
    for (let i = 0; i < list.length; i++) {
        if (used[i]) {
            continue;
        }
        used[i] = 1;
        const loop = [list[i]];
        const start = key(list[i].x0, list[i].y0);
        let end = key(list[i].x1, list[i].y1);
        while (end !== start) {
            const next = (byStart.get(end) ?? []).find((j) => !used[j]);
            if (next === undefined) {
                break;
            }
            used[next] = 1;
            loop.push(list[next]);
            end = key(list[next].x1, list[next].y1);
        }
        loops.push(loop);
    }
    return loops;
}

function reverse(e) {
    const r = { ...e, x0: e.x1, y0: e.y1, x1: e.x0, y1: e.y0 };
    if (e.ex0 !== undefined) {
        Object.assign(r, { ex0: e.ex1, ey0: e.ey1, ex1: e.ex0, ey1: e.ey0 });
    }
    return r;
}

/** Runs of connected edges of one line style, in drawing order. */
function chainLine(edges, style) {
    const runs = [];
    let run = null;
    for (const e of edges) {
        if (e.ln !== style) {
            continue;
        }
        if (run && run.at(-1).x1 === e.x0 && run.at(-1).y1 === e.y0) {
            run.push(e);
        } else {
            run = [e];
            runs.push(run);
        }
    }
    return runs;
}

function pathData(loops, close) {
    let d = '';
    for (const loop of loops) {
        d += `M${px(loop[0].x0)} ${px(loop[0].y0)}`;
        for (const e of loop) {
            d += e.cx === undefined ? `L${px(e.x1)} ${px(e.y1)}` : `Q${px(e.cx)} ${px(e.cy)} ${px(e.x1)} ${px(e.y1)}`;
        }
        if (close && loop[0].x0 === loop.at(-1).x1 && loop[0].y0 === loop.at(-1).y1) {
            d += 'Z';
        }
    }
    return d;
}

/**
 * The drawing order of a shape: per style group, its fills (in style order), then its lines.
 * Each entry is ['f' | 'l', styleIndex (0-based), pathData].
 */
function buildPaths(edges, styles, build) {
    const groups = [...new Set(edges.map((e) => e.group))].sort((a, b) => a - b);
    const out = [];
    for (const g of groups) {
        const ge = edges.filter((e) => e.group === g);
        const fillIds = [...new Set(ge.flatMap((e) => [e.f0, e.f1]).filter(Boolean))].sort((a, b) => a - b);
        for (const f of fillIds) {
            out.push(['f', f - 1, build(chainFill(ge, f), true)]);
        }
        const lineIds = [...new Set(ge.map((e) => e.ln).filter(Boolean))].sort((a, b) => a - b);
        for (const l of lineIds) {
            out.push(['l', l - 1, build(chainLine(ge, l), false)]);
        }
    }
    void styles;
    return out;
}

function parseShape(d, code) {
    const version = { 2: 1, 22: 2, 32: 3, 83: 4 }[code];
    const r = new Reader(d);
    const id = r.u16();
    const bounds = r.rect();
    if (version === 4) {
        r.rect();
        r.u8();
    }
    const styles = readStyles(r, version, false);
    const { edges } = readShapeRecords(r, version, styles, false);
    return { id, shape: { t: 'shape', b: bounds, fills: styles.fills, lines: styles.lines, paths: buildPaths(edges, styles, pathData) } };
}

/** Morph paths: a command string plus the start and end coordinates, interpolated at run time. */
function morphData(loops, close) {
    let cmd = '';
    const a = [];
    const b = [];
    for (const loop of loops) {
        cmd += 'M';
        a.push(px(loop[0].x0), px(loop[0].y0));
        b.push(px(loop[0].ex0), px(loop[0].ey0));
        for (const e of loop) {
            cmd += 'Q';
            a.push(px(e.cx), px(e.cy), px(e.x1), px(e.y1));
            b.push(px(e.ecx), px(e.ecy), px(e.ex1), px(e.ey1));
        }
        if (close && loop[0].x0 === loop.at(-1).x1 && loop[0].y0 === loop.at(-1).y1) {
            cmd += 'Z';
        }
    }
    return { cmd, a, b };
}

const asQuad = (e) => (e.cx === undefined ? { ...e, cx: (e.x0 + e.x1) / 2, cy: (e.y0 + e.y1) / 2 } : e);

function parseMorph(d, code) {
    const r = new Reader(d);
    const id = r.u16();
    const b1 = r.rect();
    const b2 = r.rect();
    if (code === 84) {
        r.rect();
        r.rect();
        r.u8();
    }
    const offset = r.u32();
    const endPos = r.pos + offset;
    const styles = readStyles(r, code === 84 ? 4 : 3, true);
    const start = readShapeRecords(r, code === 84 ? 4 : 3, styles, true);
    const endReader = new Reader(d, endPos);
    const end = readShapeRecords(endReader, code === 84 ? 4 : 3, { fills: [], lines: [] }, true, true);
    // Pair the edges one to one; both as quadratic curves so they interpolate.
    const edges = start.edges.map((e, i) => {
        const q = asQuad(e);
        const f = asQuad(end.edges[i] ?? e);
        return { ...q, ex0: f.x0, ey0: f.y0, ecx: f.cx, ecy: f.cy, ex1: f.x1, ey1: f.y1 };
    });
    return {
        id,
        shape: {
            t: 'morph',
            b: b1,
            b2,
            fills: styles.fills,
            lines: styles.lines,
            paths: buildPaths(edges, styles, morphData),
        },
    };
}

/* ---------- fonts and texts ---------- */

function parseFont3(d) {
    const r = new Reader(d);
    const id = r.u16();
    const flags = r.u8();
    r.u8();
    const nameLen = r.u8();
    const name = r.bytes(nameLen).toString('latin1').replace(/\0+$/, '');
    const n = r.u16();
    const wide = flags & 0x08;
    const tableStart = r.pos;
    const offsets = [];
    for (let i = 0; i < n; i++) {
        offsets.push(wide ? r.u32() : r.u16());
    }
    const codeOffset = n ? (wide ? r.u32() : r.u16()) : 0;
    const glyphs = [];
    for (let i = 0; i < n; i++) {
        const gr = new Reader(d, tableStart + offsets[i]);
        const styles = { fills: [{ k: 's', c: [0, 0, 0, 255] }], lines: [] };
        const { edges } = readShapeRecords(gr, 1, styles, false);
        // DefineFont3 glyphs are in a 20480-unit em square; store them in a 1024-unit em.
        const loops = chainFill(edges, 1);
        glyphs.push(pathData(loops, true));
    }
    r.pos = tableStart + codeOffset;
    const codes = [];
    for (let i = 0; i < n; i++) {
        codes.push(flags & 0x04 ? r.u16() : r.u8());
    }
    const font = { t: 'font', name, bold: !!(flags & 0x01), italic: !!(flags & 0x02), glyphs, codes };
    if (flags & 0x80) {
        font.ascent = r.u16() / 20;
        font.descent = r.u16() / 20;
        font.leading = r.s16() / 20;
        font.advances = [];
        for (let i = 0; i < n; i++) {
            font.advances.push(r.s16() / 20);
        }
    }
    return { id, font };
}

function parseText(d, code) {
    const r = new Reader(d);
    const id = r.u16();
    const bounds = r.rect();
    const matrix = r.matrix();
    const glyphBits = r.u8();
    const advanceBits = r.u8();
    const records = [];
    let font = 0;
    let color = [0, 0, 0, 255];
    let x = 0;
    let y = 0;
    let size = 12;
    for (;;) {
        const flags = r.u8();
        if (flags === 0) {
            break;
        }
        if (flags & 0x08) {
            font = r.u16();
        }
        if (flags & 0x04) {
            color = code === 33 ? r.rgba() : r.rgb();
        }
        if (flags & 0x01) {
            x = r.s16() / 20;
        }
        if (flags & 0x02) {
            y = r.s16() / 20;
        }
        if (flags & 0x08) {
            size = r.u16() / 20;
        }
        const count = r.u8();
        const glyphs = [];
        let gx = x;
        for (let i = 0; i < count; i++) {
            const g = r.ub(glyphBits);
            const adv = r.sb(advanceBits) / 20;
            glyphs.push([g, Math.round((gx - x) * 100) / 100]);
            gx += adv;
        }
        r.align();
        records.push({ font, color, x, y, size, glyphs });
        x = gx;
    }
    return { id, text: { t: 'text', b: bounds, m: matrix, records } };
}

function parseEditText(d) {
    const r = new Reader(d);
    const id = r.u16();
    const bounds = r.rect();
    const f1 = r.u8();
    const f2 = r.u8();
    const edit = { t: 'edit', b: bounds };
    edit.wordWrap = !!(f1 & 0x40);
    edit.multiline = !!(f1 & 0x20);
    edit.password = !!(f1 & 0x10);
    edit.readOnly = !!(f1 & 0x08);
    edit.noSelect = !!(f2 & 0x10);
    edit.border = !!(f2 & 0x08);
    edit.html = !!(f2 & 0x02);
    edit.outlines = !!(f2 & 0x01);
    edit.autoSize = !!(f2 & 0x40);
    if (f1 & 0x01) {
        edit.font = r.u16();
    }
    if (f2 & 0x80) {
        edit.fontClass = r.str();
    }
    if (f1 & 0x01) {
        edit.size = r.u16() / 20;
    }
    edit.color = f1 & 0x04 ? r.rgba() : [0, 0, 0, 255];
    if (f1 & 0x02) {
        edit.maxLength = r.u16();
    }
    if (f2 & 0x20) {
        edit.align = ['left', 'right', 'center', 'justify'][r.u8()];
        edit.leftMargin = r.u16() / 20;
        edit.rightMargin = r.u16() / 20;
        edit.indent = r.u16() / 20;
        edit.leading = r.s16() / 20;
    }
    edit.variable = r.str();
    if (f1 & 0x80) {
        edit.text = r.str();
    }
    return { id, edit };
}

/* ---------- bitmaps ---------- */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    return c >>> 0;
});

function crc32(buf) {
    let c = 0xffffffff;
    for (const b of buf) {
        c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
}

function png(width, height, rgba, channels = 4) {
    const chunk = (type, data) => {
        const len = Buffer.alloc(4);
        len.writeUInt32BE(data.length);
        const td = Buffer.concat([Buffer.from(type), data]);
        const crc = Buffer.alloc(4);
        crc.writeUInt32BE(crc32(td));
        return Buffer.concat([len, td, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = channels === 4 ? 6 : 0;
    const raw = Buffer.alloc((width * channels + 1) * height);
    for (let y = 0; y < height; y++) {
        raw[y * (width * channels + 1)] = 0;
        rgba.copy(raw, y * (width * channels + 1) + 1, y * width * channels, (y + 1) * width * channels);
    }
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(raw)),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

function parseLossless(d, code) {
    const r = new Reader(d);
    const id = r.u16();
    const format = r.u8();
    const w = r.u16();
    const h = r.u16();
    const tableSize = format === 3 ? r.u8() + 1 : 0;
    const data = inflateSync(d.subarray(r.pos));
    const alpha = code === 36;
    const out = Buffer.alloc(w * h * 4);
    const unpremultiply = (i, a) => {
        if (alpha && a > 0 && a < 255) {
            out[i] = Math.min(255, Math.round((out[i] * 255) / a));
            out[i + 1] = Math.min(255, Math.round((out[i + 1] * 255) / a));
            out[i + 2] = Math.min(255, Math.round((out[i + 2] * 255) / a));
        }
    };
    if (format === 3) {
        const entry = alpha ? 4 : 3;
        const pitch = (w + 3) & ~3;
        const base = tableSize * entry;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = data[base + y * pitch + x];
                const o = (y * w + x) * 4;
                out[o] = data[idx * entry];
                out[o + 1] = data[idx * entry + 1];
                out[o + 2] = data[idx * entry + 2];
                out[o + 3] = alpha ? data[idx * entry + 3] : 255;
                unpremultiply(o, out[o + 3]);
            }
        }
    } else if (format === 5) {
        for (let i = 0; i < w * h; i++) {
            const a = alpha ? data[i * 4] : 255;
            out[i * 4] = data[i * 4 + 1];
            out[i * 4 + 1] = data[i * 4 + 2];
            out[i * 4 + 2] = data[i * 4 + 3];
            out[i * 4 + 3] = a;
            unpremultiply(i * 4, a);
        }
    } else if (format === 4) {
        const pitch = (w * 2 + 3) & ~3;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const v = data.readUInt16BE(y * pitch + x * 2);
                const o = (y * w + x) * 4;
                out[o] = ((v >> 10) & 31) * 8;
                out[o + 1] = ((v >> 5) & 31) * 8;
                out[o + 2] = (v & 31) * 8;
                out[o + 3] = 255;
            }
        }
    }
    return { id, w, h, file: `${id}.png`, data: png(w, h, out) };
}

/** Strips the stray FFD9 FFD8 pair Flash puts in some JPEG streams. */
function cleanJpeg(buf) {
    let b = buf;
    if (b[0] === 0xff && b[1] === 0xd9 && b[2] === 0xff && b[3] === 0xd8) {
        b = b.subarray(4);
    }
    const parts = [];
    let start = 0;
    for (let i = 2; i < b.length - 3; i++) {
        if (b[i] === 0xff && b[i + 1] === 0xd9 && b[i + 2] === 0xff && b[i + 3] === 0xd8) {
            parts.push(b.subarray(start, i));
            start = i + 4;
        }
    }
    parts.push(b.subarray(start));
    return Buffer.concat(parts);
}

function jpegSize(b) {
    let i = 2;
    while (i < b.length) {
        if (b[i] !== 0xff) {
            i++;
            continue;
        }
        const marker = b[i + 1];
        const len = b.readUInt16BE(i + 2);
        if (marker >= 0xc0 && marker <= 0xc3) {
            return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
        }
        i += 2 + len;
    }
    return { w: 0, h: 0 };
}

/* ---------- sounds ---------- */

function parseSound(d) {
    const r = new Reader(d);
    const id = r.u16();
    const flags = r.u8();
    const samples = r.u32();
    const format = flags >> 4;
    if (format !== 2) {
        throw new Error(`Sound ${id} is not MP3 (${format})`);
    }
    // MP3 sound data starts with SeekSamples (SI16).
    return { id, rate: [5512, 11025, 22050, 44100][(flags >> 2) & 3], samples, data: d.subarray(r.pos + 2) };
}

function parseSoundInfo(r) {
    const flags = r.u8();
    const info = {};
    if (flags & 0x20) {
        info.stop = true;
    }
    if (flags & 0x10) {
        info.noMultiple = true;
    }
    if (flags & 0x01) {
        r.u32();
    }
    if (flags & 0x02) {
        r.u32();
    }
    if (flags & 0x04) {
        info.loops = r.u16();
    }
    if (flags & 0x08) {
        const n = r.u8();
        r.bytes(n * 8);
    }
    return info;
}

/* ---------- actions ---------- */

/**
 * Frame actions that only stop, play or jump become data ({stop}, {play}, {goto, play}); anything else
 * returns null, and the frame is marked as having a script for src/game/scripts.js.
 */
function simpleActions(code) {
    const out = [];
    let i = 0;
    while (i < code.length) {
        const op = code[i];
        if (op === 0) {
            break;
        }
        let len = 0;
        if (op >= 0x80) {
            len = code.readUInt16LE(i + 1);
        }
        const body = code.subarray(i + 3, i + 3 + len);
        if (op === 0x07) {
            out.push({ stop: true });
        } else if (op === 0x06) {
            out.push({ play: true });
        } else if (op === 0x81) {
            out.push({ goto: body.readUInt16LE(0) + 1 });
        } else if (op === 0x8c) {
            out.push({ goto: body.subarray(0, body.indexOf(0)).toString('latin1') });
        } else {
            return null;
        }
        i += op >= 0x80 ? 3 + len : 1;
    }
    // A goto followed by play is gotoAndPlay.
    const merged = [];
    for (const a of out) {
        if (a.play && merged.at(-1)?.goto !== undefined) {
            merged.at(-1).play = true;
        } else {
            merged.push(a);
        }
    }
    return merged;
}

const EVENTS = [
    [0x80, 'keyUp'], [0x40, 'keyDown'], [0x20, 'mouseUp'], [0x10, 'mouseDown'], [0x08, 'mouseMove'], [0x04, 'unload'], [0x02, 'enterFrame'], [0x01, 'load'],
    [0x8000, 'dragOver'], [0x4000, 'rollOut'], [0x2000, 'rollOver'], [0x1000, 'releaseOutside'], [0x0800, 'release'], [0x0400, 'press'], [0x0200, 'initialize'], [0x0100, 'data'],
    [0x040000, 'construct'], [0x020000, 'keyPress'], [0x010000, 'dragOut'],
];

/* ---------- timelines ---------- */

function parsePlace(d, version = 2) {
    const r = new Reader(d);
    const flags = r.u8();
    const flags2 = version === 3 ? r.u8() : 0;
    const depth = r.u16();
    const p = { depth };
    if (flags2 & 0x08 || (flags2 & 0x10 && flags & 0x02)) {
        p.className = r.str();
    }
    if (flags & 0x01) {
        p.move = true;
    }
    if (flags & 0x02) {
        p.c = r.u16();
    }
    if (flags & 0x04) {
        p.m = r.matrix();
    }
    if (flags & 0x08) {
        p.cx = r.cxform(true);
    }
    if (flags & 0x10) {
        p.ratio = r.u16() / 65535;
    }
    if (flags & 0x20) {
        p.name = r.str();
    }
    if (flags & 0x40) {
        p.clip = r.u16();
    }
    if (flags2 & 0x01) {
        const filters = readFilters(r);
        if (filters.length) {
            p.filters = filters;
        }
    }
    if (flags2 & 0x02) {
        const blend = r.u8();
        if (blend > 1) {
            p.blend = blend;
        }
    }
    if (flags2 & 0x04) {
        r.u8();
    }
    if (flags & 0x80) {
        r.u16();
        r.u32();
        const events = [];
        for (;;) {
            const ev = r.u32();
            if (ev === 0) {
                break;
            }
            const size = r.u32();
            r.bytes(size);
            events.push(...EVENTS.filter(([bit]) => ev & bit).map(([, nm]) => nm));
        }
        p.events = events;
    }
    return p;
}

function parseTimeline(tags, owner, out) {
    const frames = [];
    let frame = { ops: [] };
    let stream = null;
    let streamStart = 0;
    const streamParts = [];
    for (const [code, d] of tags) {
        if (code === 1) {
            frames.push(frame);
            frame = { ops: [] };
        } else if (code === 26 || code === 70) {
            frame.ops.push(['place', parsePlace(d, code === 70 ? 3 : 2)]);
        } else if (code === 28) {
            frame.ops.push(['remove', d.readUInt16LE(0)]);
        } else if (code === 5) {
            frame.ops.push(['remove', d.readUInt16LE(2)]);
        } else if (code === 43) {
            frame.label = d.subarray(0, d.indexOf(0)).toString('latin1');
        } else if (code === 12) {
            const simple = simpleActions(d);
            if (simple) {
                frame.actions = [...(frame.actions ?? []), ...simple];
            } else {
                frame.script = true;
            }
        } else if (code === 15) {
            const r = new Reader(d);
            const id = r.u16();
            frame.ops.push(['sound', id, parseSoundInfo(r)]);
        } else if (code === 18 || code === 45) {
            const compression = d[1] >> 4;
            if (compression === 2) {
                stream = true;
            }
        } else if (code === 19 && stream) {
            if (!streamParts.length) {
                streamStart = frames.length;
            }
            streamParts.push(d.subarray(4));
        } else if (code === 39) {
            parseSprite(d, out);
        } else if (code !== 0) {
            out.unhandled.add(code);
        }
    }
    const result = { frames: frames.map(compactFrame) };
    if (streamParts.length) {
        const file = `stream-${owner}.mp3`;
        out.sounds.push({ file, data: Buffer.concat(streamParts) });
        result.stream = { file, frame: streamStart + 1 };
    }
    return result;
}

function compactFrame(f) {
    const o = {};
    if (f.ops.length) {
        o.ops = f.ops;
    }
    if (f.label) {
        o.label = f.label;
    }
    if (f.actions?.length) {
        o.actions = f.actions;
    }
    if (f.script) {
        o.script = true;
    }
    return o;
}

function parseSprite(d, out) {
    const id = d.readUInt16LE(0);
    const tags = readTags(d, 4);
    out.chars[id] = { t: 'sprite', ...parseTimeline(tags, id, out) };
}

/** A FILTERLIST. Drop shadows and glows keep their colour and blur (drawn as canvas shadows); the rest is skipped. */
function readFilters(r) {
    const n = r.u8();
    const filters = [];
    for (let i = 0; i < n; i++) {
        const type = r.u8();
        if (type === 0 || type === 2) {
            const color = r.rgba();
            const blurX = r.u32() / 65536;
            const blurY = r.u32() / 65536;
            const filter = { k: type === 0 ? 'shadow' : 'glow', color, blur: (blurX + blurY) / 2 };
            if (type === 0) {
                filter.angle = r.u32() / 65536;
                filter.distance = r.u32() / 65536;
            }
            filter.strength = r.u16() / 256;
            filter.inner = !!(r.u8() & 0x80);
            filters.push(filter);
        } else if (type === 1) {
            r.bytes(9);
        } else if (type === 3) {
            r.bytes(27);
        } else if (type === 4 || type === 7) {
            const colors = r.u8();
            r.bytes(colors * 5 + 19);
        } else if (type === 5) {
            const x = r.u8();
            const y = r.u8();
            r.bytes(8 + 4 * x * y + 5);
        } else if (type === 6) {
            r.bytes(80);
        }
    }
    return filters;
}

function parseButton2(d) {
    const r = new Reader(d);
    const id = r.u16();
    const flags = r.u8();
    const actionOffset = r.u16();
    const records = [];
    for (;;) {
        const f = r.u8();
        if (f === 0) {
            break;
        }
        const rec = { states: f & 0x0f, c: r.u16(), depth: r.u16(), m: r.matrix(), cx: r.cxform(true) };
        if (f & 0x10) {
            rec.filters = readFilters(r);
        }
        if (f & 0x20) {
            r.u8();
        }
        records.push(rec);
    }
    return { id, button: { t: 'button', menu: !!(flags & 1), records, actions: actionOffset > 0 } };
}

/* ---------- main ---------- */

function readTags(buf, pos) {
    const tags = [];
    while (pos < buf.length) {
        const h = buf.readUInt16LE(pos);
        pos += 2;
        const code = h >> 6;
        let len = h & 0x3f;
        if (len === 0x3f) {
            len = buf.readUInt32LE(pos);
            pos += 4;
        }
        tags.push([code, buf.subarray(pos, pos + len)]);
        pos += len;
        if (code === 0) {
            break;
        }
    }
    return tags;
}

const file = readFileSync(SOURCE);
const signature = file.subarray(0, 3).toString('latin1');
const body = signature === 'CWS' ? inflateSync(file.subarray(8)) : file.subarray(8);
const header = new Reader(body);
const frameRect = header.rect();
const fps = header.u16() / 256;
header.u16();

const out = { chars: {}, sounds: [], bitmaps: [], unhandled: new Set() };
const exportsById = {};
let jpegTables = null;
let background = [255, 255, 255];
const topTags = readTags(body, header.pos);
const timelineTags = [];

for (const [code, d] of topTags) {
    if ([2, 22, 32, 83].includes(code)) {
        const { id, shape } = parseShape(d, code);
        out.chars[id] = shape;
    } else if (code === 46 || code === 84) {
        const { id, shape } = parseMorph(d, code);
        out.chars[id] = shape;
    } else if (code === 75) {
        const { id, font } = parseFont3(d);
        out.chars[id] = font;
    } else if (code === 11 || code === 33) {
        const { id, text } = parseText(d, code);
        out.chars[id] = text;
    } else if (code === 37) {
        const { id, edit } = parseEditText(d);
        out.chars[id] = edit;
    } else if (code === 34) {
        const { id, button } = parseButton2(d);
        out.chars[id] = button;
    } else if (code === 20 || code === 36) {
        const bmp = parseLossless(d, code);
        out.bitmaps.push(bmp);
        out.chars[bmp.id] = { t: 'bitmap', w: bmp.w, h: bmp.h, file: bmp.file };
    } else if (code === 8) {
        jpegTables = d;
    } else if (code === 6 || code === 21 || code === 35) {
        const id = d.readUInt16LE(0);
        let jpeg;
        let alpha = null;
        if (code === 35) {
            const offset = d.readUInt32LE(2);
            jpeg = cleanJpeg(d.subarray(6, 6 + offset));
            alpha = inflateSync(d.subarray(6 + offset));
        } else {
            jpeg = cleanJpeg(d.subarray(2));
            if (code === 6 && jpegTables?.length > 4) {
                jpeg = cleanJpeg(Buffer.concat([jpegTables.subarray(0, jpegTables.length - 2), jpeg.subarray(2)]));
            }
        }
        const { w, h } = jpegSize(jpeg);
        const bmp = { id, w, h, file: `${id}.jpg`, data: jpeg };
        out.bitmaps.push(bmp);
        out.chars[id] = { t: 'bitmap', w, h, file: bmp.file };
        if (alpha) {
            out.bitmaps.push({ id, file: `${id}.alpha.png`, data: png(w, h, alpha, 1) });
            out.chars[id].alpha = `${id}.alpha.png`;
        }
    } else if (code === 14) {
        const s = parseSound(d);
        out.sounds.push({ file: `${s.id}.mp3`, data: s.data });
        out.chars[s.id] = { t: 'sound', file: `${s.id}.mp3`, rate: s.rate, samples: s.samples };
    } else if (code === 39) {
        parseSprite(d, out);
    } else if (code === 56) {
        const r = new Reader(d);
        const n = r.u16();
        for (let i = 0; i < n; i++) {
            const id = r.u16();
            exportsById[id] = r.str();
        }
    } else if (code === 9) {
        background = [d[0], d[1], d[2]];
    } else if ([1, 26, 70, 28, 5, 43, 12, 15, 18, 45, 19].includes(code)) {
        timelineTags.push([code, d]);
    } else if (![0, 69, 74, 73, 88, 13, 62, 65, 58, 64, 24, 77, 78].includes(code)) {
        out.unhandled.add(code);
    }
}

const root = parseTimeline(timelineTags, 'root', out);

for (const id of LEFT_OUT) {
    delete out.chars[id];
}
out.bitmaps = out.bitmaps.filter((b) => !LEFT_OUT.has(b.id));
out.sounds = out.sounds.filter((s) => s.file !== 'stream-103.mp3' && !LEFT_OUT.has(Number.parseInt(s.file, 10)));
const dropLeftOut = (frames) => {
    for (const f of frames) {
        if (f.ops) {
            f.ops = f.ops.filter((op) => !(op[0] === 'place' && LEFT_OUT.has(op[1].c)) && !(op[0] === 'sound' && LEFT_OUT.has(op[1])));
            if (!f.ops.length) {
                delete f.ops;
            }
        }
    }
};
dropLeftOut(root.frames);
for (const c of Object.values(out.chars)) {
    if (c.t === 'sprite') {
        dropLeftOut(c.frames);
    } else if (c.t === 'button') {
        c.records = c.records.filter((r) => !LEFT_OUT.has(r.c));
    }
}

// Drop what nothing uses any more: keep what the root timeline, the exports (attachMovie, attachSound)
// and the kept characters refer to.
{
    const used = new Set();
    const visit = (id) => {
        const c = out.chars[id];
        if (!c || used.has(Number(id))) {
            return;
        }
        used.add(Number(id));
        if (c.t === 'sprite') {
            for (const f of c.frames) {
                for (const op of f.ops ?? []) {
                    if (op[0] === 'place' && op[1].c !== undefined) {
                        visit(op[1].c);
                    } else if (op[0] === 'sound') {
                        visit(op[1]);
                    }
                }
            }
        } else if (c.t === 'button') {
            c.records.forEach((r) => visit(r.c));
        } else if (c.t === 'shape' || c.t === 'morph') {
            c.fills.filter((f) => f.k === 'b').forEach((f) => visit(f.id));
        } else if (c.t === 'text') {
            c.records.forEach((r) => visit(r.font));
        } else if (c.t === 'edit' && c.font) {
            visit(c.font);
        }
    };
    for (const f of root.frames) {
        for (const op of f.ops ?? []) {
            if (op[0] === 'place' && op[1].c !== undefined) {
                visit(op[1].c);
            } else if (op[0] === 'sound') {
                visit(op[1]);
            }
        }
    }
    for (const [id, name] of Object.entries(exportsById)) {
        if (!LEFT_OUT.has(Number(id))) {
            visit(id);
        }
        void name;
    }
    for (const id of Object.keys(out.chars)) {
        if (!used.has(Number(id))) {
            LEFT_OUT.add(Number(id));
            delete out.chars[id];
        }
    }
    const streams = new Set(Object.values(out.chars).filter((c) => c.t === 'sprite' && c.stream).map((c) => c.stream.file));
    out.bitmaps = out.bitmaps.filter((b) => out.chars[b.id]);
    out.sounds = out.sounds.filter((x) => streams.has(x.file) || out.chars[Number.parseInt(x.file, 10)]);
}
const exportsByName = Object.fromEntries(Object.entries(exportsById).filter(([id]) => out.chars[id]).map(([id, name]) => [name, Number(id)]));

rmSync(`${TARGET}/bitmaps`, { recursive: true, force: true });
rmSync(`${TARGET}/sounds`, { recursive: true, force: true });
mkdirSync(`${TARGET}/bitmaps`, { recursive: true });
mkdirSync(`${TARGET}/sounds`, { recursive: true });
for (const b of out.bitmaps) {
    writeFileSync(`${TARGET}/bitmaps/${b.file}`, b.data);
}
for (const s of out.sounds) {
    writeFileSync(`${TARGET}/sounds/${s.file}`, s.data);
}

const library = {
    stage: { width: frameRect[2], height: frameRect[3], fps, background },
    exports: exportsByName,
    chars: out.chars,
    root,
};
writeFileSync(`${TARGET}/library.json`, JSON.stringify(library));

const counts = {};
for (const c of Object.values(out.chars)) {
    counts[c.t] = (counts[c.t] ?? 0) + 1;
}
console.log(`Wrote ${TARGET}/library.json:`, counts, `${out.bitmaps.length} bitmap files, ${out.sounds.length} sound files.`);
if (out.unhandled.size) {
    console.log('Tags not exported:', [...out.unhandled].sort((a, b) => a - b).join(', '));
}
