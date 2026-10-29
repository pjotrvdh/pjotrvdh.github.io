import { CHARS } from './library.js';

/*
 * Text drawing: static texts with the glyph outlines embedded in the SWF, and dynamic text fields,
 * with the embedded outlines when the field uses them and system fonts otherwise. Fonts are in a
 * 1024-unit em square (DefineFont3 / 20).
 */

/** System font stacks for the device fonts of the original. Comic Sans MS is replaced (see AGENTS.md). */
const SYSTEM_FONTS = {
    'Arial Black': { family: '"Arial Black", "Arial", sans-serif', weight: 900 },
    'Arial Rounded MT Bold': { family: '"Arial Rounded MT Bold", "Arial Rounded", "Helvetica Rounded", "Arial", sans-serif', weight: 700 },
    Arial: { family: 'Arial, Helvetica, sans-serif', weight: 400 },
    Tahoma: { family: 'Tahoma, Verdana, sans-serif', weight: 400 },
    tahoma: { family: 'Tahoma, Verdana, sans-serif', weight: 400 },
    'Comic Sans MS': { family: '"Arial Rounded MT Bold", "Arial Rounded", "Arial", sans-serif', weight: 700 },
};

/** Fonts whose embedded outlines are not drawn: their text uses the system stack above instead. */
const REPLACED_OUTLINES = new Set(['Comic Sans MS']);

const glyphCache = new Map();

/** The Path2D of glyph i of a font character. */
export function glyphPath(fontId, i) {
    const k = `${fontId}:${i}`;
    let p = glyphCache.get(k);
    if (!p) {
        p = new Path2D(CHARS[fontId].glyphs[i] || '');
        glyphCache.set(k, p);
    }
    return p;
}

const codeMaps = new Map();

function codeMap(fontId) {
    let map = codeMaps.get(fontId);
    if (!map) {
        map = new Map(CHARS[fontId].codes.map((code, i) => [code, i]));
        codeMaps.set(fontId, map);
    }
    return map;
}

function systemFont(font, size) {
    const sys = SYSTEM_FONTS[font?.name] ?? SYSTEM_FONTS.Arial;
    const weight = font?.bold ? Math.max(700, sys.weight) : sys.weight;
    return `${font?.italic ? 'italic ' : ''}${weight} ${size}px ${sys.family}`;
}

/** Draws a static text (DefineText). `fill(color)` returns the CSS colour after the colour transform. */
export function drawStaticText(ctx, ch, fill) {
    ctx.transform(...ch.m);
    for (const r of ch.records) {
        const font = CHARS[r.font];
        ctx.fillStyle = fill(r.color);
        if (!font || REPLACED_OUTLINES.has(font.name)) {
            // Rebuild the string from the glyph codes and draw it with a system font.
            const text = r.glyphs.map(([g]) => String.fromCharCode(font?.codes[g] ?? 32)).join('');
            ctx.font = systemFont(font, r.size);
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(text, r.x, r.y);
            continue;
        }
        const s = r.size / 1024;
        for (const [g, gx] of r.glyphs) {
            ctx.save();
            ctx.translate(r.x + gx, r.y);
            ctx.scale(s, s);
            ctx.fill(glyphPath(r.font, g));
            ctx.restore();
        }
    }
}

/** Plain text from a text field value: HTML tags removed, <br> and </p> as line breaks. */
export function plainText(text, html) {
    let t = String(text);
    if (html || /<\/?(p|font|br|b|i)\b/i.test(t)) {
        t = t.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]*>/g, '')
            .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
        t = t.replace(/\n$/, '');
    }
    return t.replace(/\r/g, '\n');
}

/** Draws a dynamic text field (DefineEditText) with the given text. */
export function drawEditText(ctx, ch, text, fill, colorOverride) {
    const font = CHARS[ch.font];
    const size = ch.size ?? 12;
    const useGlyphs = ch.outlines && font?.glyphs?.length && !REPLACED_OUTLINES.has(font.name);
    const scale = size / 1024;
    const ascent = useGlyphs && font.ascent ? font.ascent * scale : size * 0.9;
    const descent = useGlyphs && font.descent ? font.descent * scale : size * 0.22;
    const lineHeight = ascent + descent + (ch.leading ?? 0);
    const [x0, y0, x1] = ch.b;
    const left = x0 + 2 + (ch.leftMargin ?? 0);
    const right = x1 - 2 - (ch.rightMargin ?? 0);
    const width = right - left;
    ctx.fillStyle = fill(colorOverride ?? ch.color);
    if (!useGlyphs) {
        ctx.font = systemFont(font, size);
        ctx.textBaseline = 'alphabetic';
    }
    const map = useGlyphs ? codeMap(ch.font) : null;
    const advance = (c) => {
        if (!useGlyphs) {
            return ctx.measureText(c).width;
        }
        const i = map.get(c.charCodeAt(0));
        return i === undefined || !font.advances ? size * 0.5 : font.advances[i] * scale;
    };
    const measure = (s) => (useGlyphs ? [...s].reduce((w, c) => w + advance(c), 0) : ctx.measureText(s).width);

    const lines = [];
    for (const para of plainText(text, ch.html).split('\n')) {
        if (!ch.wordWrap || !ch.multiline) {
            lines.push(para);
            continue;
        }
        let line = '';
        for (const word of para.split(/(\s+)/)) {
            if (line && measure(line + word) > width && word.trim()) {
                lines.push(line.trimEnd());
                line = word.trimStart();
            } else {
                line += word;
            }
        }
        lines.push(line);
    }

    let y = y0 + 2 + ascent;
    for (const line of ch.multiline ? lines : [lines.join(' ')]) {
        const w = measure(line);
        let x = left;
        if (ch.align === 'right') {
            x = right - w;
        } else if (ch.align === 'center') {
            x = left + (width - w) / 2;
        }
        if (useGlyphs) {
            for (const c of line) {
                const i = map.get(c.charCodeAt(0));
                if (i !== undefined) {
                    ctx.save();
                    ctx.translate(x, y);
                    ctx.scale(scale, scale);
                    ctx.fill(glyphPath(ch.font, i));
                    ctx.restore();
                }
                x += advance(c);
            }
        } else {
            ctx.fillText(line, x, y);
        }
        y += lineHeight;
    }
}
