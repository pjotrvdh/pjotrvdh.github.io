/*
 * 2D affine matrices as [a, b, c, d, tx, ty] (x' = a·x + c·y + tx, y' = b·x + d·y + ty), the layout of
 * Flash's MATRIX and of CanvasRenderingContext2D.transform(), and colour transforms as
 * [rMul, gMul, bMul, aMul, rAdd, gAdd, bAdd, aAdd] (Flash's CXFORMWITHALPHA, adds in 0..255).
 */

export const IDENTITY = Object.freeze([1, 0, 0, 1, 0, 0]);

/** p·q: q applied first, then p. */
export function multiply(p, q) {
    return [
        p[0] * q[0] + p[2] * q[1],
        p[1] * q[0] + p[3] * q[1],
        p[0] * q[2] + p[2] * q[3],
        p[1] * q[2] + p[3] * q[3],
        p[0] * q[4] + p[2] * q[5] + p[4],
        p[1] * q[4] + p[3] * q[5] + p[5],
    ];
}

export function invert(m) {
    const det = m[0] * m[3] - m[1] * m[2];
    if (!det) {
        return null;
    }
    return [
        m[3] / det,
        -m[1] / det,
        -m[2] / det,
        m[0] / det,
        (m[2] * m[5] - m[3] * m[4]) / det,
        (m[1] * m[4] - m[0] * m[5]) / det,
    ];
}

export function apply(m, x, y) {
    return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** The bounding box [xmin, ymin, xmax, ymax] of a box after transforming it. */
export function transformBounds(m, b) {
    const pts = [apply(m, b[0], b[1]), apply(m, b[2], b[1]), apply(m, b[0], b[3]), apply(m, b[2], b[3])];
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export function unionBounds(a, b) {
    if (!a) {
        return b;
    }
    if (!b) {
        return a;
    }
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}

/** Parent colour transform p applied after child transform q. */
export function multiplyColor(p, q) {
    if (!p) {
        return q;
    }
    if (!q) {
        return p;
    }
    return [
        p[0] * q[0], p[1] * q[1], p[2] * q[2], p[3] * q[3],
        p[0] * q[4] + p[4], p[1] * q[5] + p[5], p[2] * q[6] + p[6], p[3] * q[7] + p[7],
    ];
}

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** A CSS colour for an [r, g, b, a] colour (0..255) after colour transform cx. */
export function cssColor(c, cx) {
    let [r, g, b, a] = c;
    if (cx) {
        r = clamp(r * cx[0] + cx[4]);
        g = clamp(g * cx[1] + cx[5]);
        b = clamp(b * cx[2] + cx[6]);
        a = clamp(a * cx[3] + cx[7]);
    }
    return `rgba(${r | 0},${g | 0},${b | 0},${(a / 255).toFixed(3)})`;
}
