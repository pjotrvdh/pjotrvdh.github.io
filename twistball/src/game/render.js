/**
 * Draws the tunnel, the paddles and the ball on a 2D canvas with a simple perspective: a point at
 * depth z is drawn at scale 1 / (1 + z / depth * perspective) around the centre of the screen.
 */
export function createRenderer(canvas, tunnel) {
    const context = canvas.getContext('2d');
    /** The colours in use; see src/config/palettes.js. */
    let colors = null;
    const { halfWidth: W, halfHeight: H, depth: D } = tunnel;
    let width = 0;
    let height = 0;
    let unit = 1;
    let ratio = 1;

    function resize() {
        ratio = window.devicePixelRatio || 1;
        width = canvas.clientWidth;
        height = canvas.clientHeight;
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        // The near end of the tunnel fills the canvas, with a small margin.
        unit = Math.min(width / (2 * W), height / (2 * H)) * 0.96;
    }

    const scaleAt = (z) => 1 / (1 + (z / D) * tunnel.perspective);

    function project(x, y, z) {
        const scale = scaleAt(z);

        return { x: width / 2 + x * scale * unit, y: height / 2 + y * scale * unit, scale };
    }

    /** The screen position of a point on the near plane (z = 0) back in tunnel units. */
    function toTunnel(screenX, screenY) {
        return { x: (screenX - width / 2) / unit, y: (screenY - height / 2) / unit };
    }

    function rectAt(z, halfW = W, halfH = H, x = 0, y = 0) {
        const a = project(x - halfW, y - halfH, z);
        const b = project(x + halfW, y + halfH, z);

        return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
    }

    function strokeRect(rect, color, lineWidth) {
        context.strokeStyle = color;
        context.lineWidth = lineWidth;
        context.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }

    function wall(points, fill) {
        context.fillStyle = fill;
        context.beginPath();
        points.forEach((point, index) => (index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)));
        context.closePath();
        context.fill();
    }

    function drawTunnel(ballZ, flash) {
        const near = [project(-W, -H, 0), project(W, -H, 0), project(W, H, 0), project(-W, H, 0)];
        const far = [project(-W, -H, D), project(W, -H, D), project(W, H, D), project(-W, H, D)];

        context.fillStyle = colors.background;
        context.fillRect(0, 0, width, height);

        // Walls: ceiling, right, floor, left, each a little different so the room reads as 3D.
        wall([near[0], near[1], far[1], far[0]], colors.walls[0]);
        wall([near[1], near[2], far[2], far[1]], colors.walls[1]);
        wall([near[2], near[3], far[3], far[2]], colors.walls[2]);
        wall([near[3], near[0], far[0], far[3]], colors.walls[3]);

        const back = rectAt(D);
        context.fillStyle = flash > 0 ? `rgba(${colors.farRgb}, ${0.15 + flash * 0.35})` : colors.back;
        context.fillRect(back.x, back.y, back.w, back.h);

        // Rails along the walls.
        context.strokeStyle = colors.rails;
        context.lineWidth = 1;
        context.beginPath();
        for (const t of [-0.5, 0, 0.5]) {
            for (const [x1, y1, x2, y2] of [[t * W, -H, t * W, -H], [t * W, H, t * W, H], [-W, t * H, -W, t * H], [W, t * H, W, t * H]]) {
                const a = project(x1, y1, 0);
                const b = project(x2, y2, D);
                context.moveTo(a.x, a.y);
                context.lineTo(b.x, b.y);
            }
        }
        for (let corner = 0; corner < 4; corner++) {
            context.moveTo(near[corner].x, near[corner].y);
            context.lineTo(far[corner].x, far[corner].y);
        }
        context.stroke();

        // Rings, fading into the distance.
        for (let ring = 1; ring <= tunnel.rings; ring++) {
            const z = (D * ring) / tunnel.rings;
            strokeRect(rectAt(z), `rgba(${colors.rings}, ${0.45 - (ring / tunnel.rings) * 0.3})`, 1);
        }

        // The depth marker: a bright frame that travels with the ball, so you can judge its depth.
        if (ballZ !== null) {
            context.shadowColor = colors.marker;
            context.shadowBlur = 12;
            strokeRect(rectAt(ballZ), colors.marker, 2);
            context.shadowBlur = 0;
        }
    }

    function drawPaddle(paddle, z, colors) {
        const rect = rectAt(z, tunnel.paddleHalfWidth, tunnel.paddleHalfHeight, paddle.x, paddle.y);
        const radius = Math.min(rect.w, rect.h) * 0.18;
        context.fillStyle = colors.fill;
        context.strokeStyle = colors.edge;
        context.lineWidth = z === 0 ? 3 : 2;
        context.shadowColor = colors.edge;
        context.shadowBlur = z === 0 ? 16 : 10;
        context.beginPath();
        context.roundRect(rect.x, rect.y, rect.w, rect.h, radius);
        context.fill();
        context.stroke();
        context.shadowBlur = 0;

        // A cross in the middle shows the centre: hit the ball there for the accuracy bonus.
        const centre = project(paddle.x, paddle.y, z);
        const arm = Math.min(rect.w, rect.h) * 0.16;
        context.strokeStyle = colors.edge;
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(centre.x - arm, centre.y);
        context.lineTo(centre.x + arm, centre.y);
        context.moveTo(centre.x, centre.y - arm);
        context.lineTo(centre.x, centre.y + arm);
        context.stroke();
    }

    function drawBall(ball, radius) {
        const centre = project(ball.x, ball.y, ball.z);
        const r = radius * centre.scale * unit;
        const glow = context.createRadialGradient(centre.x - r * 0.35, centre.y - r * 0.35, r * 0.1, centre.x, centre.y, r);
        glow.addColorStop(0, colors.ball[0]);
        glow.addColorStop(0.45, colors.ball[1]);
        glow.addColorStop(1, colors.ball[2]);
        context.shadowColor = colors.ballGlow;
        context.shadowBlur = 18 * centre.scale;
        context.fillStyle = glow;
        context.beginPath();
        context.arc(centre.x, centre.y, r, 0, Math.PI * 2);
        context.fill();
        context.shadowBlur = 0;
    }

    function drawSparks(sparks) {
        for (const spark of sparks) {
            const point = project(spark.x, spark.y, spark.z);
            const r = (0.15 + spark.age * 1.4) * point.scale * unit;
            context.strokeStyle = `rgba(${spark.color}, ${1 - spark.age / spark.life})`;
            context.lineWidth = 2;
            context.beginPath();
            context.arc(point.x, point.y, r, 0, Math.PI * 2);
            context.stroke();
        }
    }

    /** Draws one frame. */
    function draw(state) {
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        const ball = state.ballVisible ? state.ball : null;
        drawTunnel(ball ? ball.z : null, state.backFlash);
        drawPaddle(state.opponent, D, colors.far);
        if (ball) {
            drawBall(ball, tunnel.ballRadius);
        }
        drawSparks(state.sparks);
        // Your paddle is see-through, so the ball stays visible behind it.
        drawPaddle(state.player, 0, colors.near);
    }

    resize();

    return {
        draw,
        resize,
        toTunnel,
        setPalette: (palette) => { colors = palette; },
        palette: () => colors,
    };
}
