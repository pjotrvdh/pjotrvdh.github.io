/**
 * Draws the game in 3D with three.js (WebGL). Game coordinates: x to the right, y down, z into the
 * tunnel (0 = your paddle, `depth` = the far paddle). In three.js y points up and the camera looks
 * down -z, so a game point (x, y, z) is drawn at (x, -y, -z).
 *
 * The camera sits behind your paddle at the distance where the near end of the tunnel fills the view
 * and the far end looks 1 / (1 + perspective) as big. The ball carries a light, so it lights up the
 * walls as it flies. No shadow maps or post-processing: it stays smooth on slow devices.
 */
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

/** "rgba(r, g, b, a)", "#rrggbb" or "r, g, b" → a colour and an opacity. */
function parseColor(text) {
    const value = String(text).trim();
    const numbers = value.match(/[\d.]+/g)?.map(Number) ?? [];
    if (value.startsWith('#')) {
        return { color: new THREE.Color(value), opacity: 1 };
    }

    return { color: new THREE.Color(numbers[0] / 255, numbers[1] / 255, numbers[2] / 255), opacity: numbers[3] ?? 1 };
}

/** A soft round glow, drawn once on a small canvas and used as a sprite texture. */
function glowTexture() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.25, 'rgba(255, 255, 255, .55)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    return new THREE.CanvasTexture(canvas);
}

function roundedRect(halfWidth, halfHeight, radius) {
    const shape = new THREE.Shape();
    const w = halfWidth;
    const h = halfHeight;
    shape.moveTo(-w + radius, -h);
    shape.lineTo(w - radius, -h);
    shape.quadraticCurveTo(w, -h, w, -h + radius);
    shape.lineTo(w, h - radius);
    shape.quadraticCurveTo(w, h, w - radius, h);
    shape.lineTo(-w + radius, h);
    shape.quadraticCurveTo(-w, h, -w, h - radius);
    shape.lineTo(-w, -h + radius);
    shape.quadraticCurveTo(-w, -h, -w + radius, -h);

    return shape;
}

export function createRenderer(canvas, tunnel) {
    const { halfWidth: W, halfHeight: H, depth: D } = tunnel;
    /** The colours in use; see src/config/palettes.js. */
    let colors = null;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();

    // The near end of the tunnel fills the view (with a small margin), the far end is 1 / (1 + p) as big.
    const distance = D / tunnel.perspective;
    const margin = 0.96;
    const camera = new THREE.PerspectiveCamera(1, 1, 0.05, distance + D + 5);
    camera.position.set(0, 0, distance);
    camera.lookAt(0, 0, 0);

    const lineMaterials = [];
    function line(points, width, opacity = 1, additive = false) {
        const geometry = new LineGeometry();
        geometry.setPositions(points.flat());
        const material = new LineMaterial({ linewidth: width, transparent: true, opacity, depthWrite: !additive });
        if (additive) {
            material.blending = THREE.AdditiveBlending;
        }
        lineMaterials.push(material);

        return new Line2(geometry, material);
    }
    /** A rectangle outline at depth z (game units), as points for a Line2. */
    const rectPoints = (halfW, halfH, z) => [[-halfW, -halfH, -z], [halfW, -halfH, -z], [halfW, halfH, -z], [-halfW, halfH, -z], [-halfW, -halfH, -z]];

    /* ---------- the tunnel ---------- */

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const frontLight = new THREE.PointLight(0xffffff, 6, D * 1.2, 1.2);
    frontLight.position.set(0, 0, 1.5);
    scene.add(frontLight);

    const wallGeometry = (width, height) => new THREE.PlaneGeometry(width, height);
    const walls = [
        // ceiling, right, floor, left: each a plane facing into the tunnel
        { mesh: new THREE.Mesh(wallGeometry(2 * W, D)), place: (m) => { m.rotation.x = Math.PI / 2; m.position.set(0, H, -D / 2); } },
        { mesh: new THREE.Mesh(wallGeometry(D, 2 * H)), place: (m) => { m.rotation.y = -Math.PI / 2; m.position.set(W, 0, -D / 2); } },
        { mesh: new THREE.Mesh(wallGeometry(2 * W, D)), place: (m) => { m.rotation.x = -Math.PI / 2; m.position.set(0, -H, -D / 2); } },
        { mesh: new THREE.Mesh(wallGeometry(D, 2 * H)), place: (m) => { m.rotation.y = Math.PI / 2; m.position.set(-W, 0, -D / 2); } },
    ];
    for (const wall of walls) {
        wall.mesh.material = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.1 });
        wall.place(wall.mesh);
        scene.add(wall.mesh);
    }
    const back = new THREE.Mesh(new THREE.PlaneGeometry(2 * W, 2 * H), new THREE.MeshBasicMaterial());
    back.position.z = -D;
    scene.add(back);

    // Rails along the walls and the corners.
    const railPoints = [];
    for (const t of [-0.5, 0, 0.5]) {
        railPoints.push([[t * W, -H, 0], [t * W, -H, -D]], [[t * W, H, 0], [t * W, H, -D]], [[-W, t * H, 0], [-W, t * H, -D]], [[W, t * H, 0], [W, t * H, -D]]);
    }
    for (const [x, y] of [[-W, -H], [W, -H], [W, H], [-W, H]]) {
        railPoints.push([[x, y, 0], [x, y, -D]]);
    }
    const rails = new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(railPoints.flat().map(([x, y, z]) => new THREE.Vector3(x, y, z))),
        new THREE.LineBasicMaterial({ transparent: true }),
    );
    scene.add(rails);

    // Rings, fading into the distance.
    const rings = [];
    for (let ring = 1; ring <= tunnel.rings; ring++) {
        const ringLine = line(rectPoints(W, H, (D * ring) / tunnel.rings), 1.2, 0.45 - (ring / tunnel.rings) * 0.3);
        rings.push(ringLine);
        scene.add(ringLine);
    }

    // The depth marker: a bright frame that travels with the ball, with a soft glow around it.
    const marker = new THREE.Group();
    const markerLine = line(rectPoints(W - 0.005, H - 0.005, 0), 2.5);
    const markerGlow = line(rectPoints(W - 0.005, H - 0.005, 0), 9, 0.25, true);
    marker.add(markerGlow, markerLine);
    scene.add(marker);

    /* ---------- paddles ---------- */

    function makePaddle() {
        const group = new THREE.Group();
        const pw = tunnel.paddleHalfWidth;
        const ph = tunnel.paddleHalfHeight;
        const radius = Math.min(pw, ph) * 0.35;
        const shape = roundedRect(pw, ph, radius);
        const fill = new THREE.Mesh(new THREE.ShapeGeometry(shape, 8), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }));
        const outline = shape.getPoints(8).map((point) => [point.x, point.y, 0]);
        outline.push(outline[0]);
        const edge = line(outline, 3);
        const glow = line(outline, 10, 0.3, true);
        const arm = Math.min(pw, ph) * 0.3;
        const cross = new THREE.LineSegments(
            new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-arm, 0, 0), new THREE.Vector3(arm, 0, 0), new THREE.Vector3(0, -arm, 0), new THREE.Vector3(0, arm, 0)]),
            new THREE.LineBasicMaterial({ transparent: true }),
        );
        group.add(fill, glow, edge, cross);

        return { group, fill, edge, glow, cross, outline };
    }
    const nearPaddle = makePaddle();
    const farPaddle = makePaddle();
    farPaddle.group.position.z = -D;
    scene.add(nearPaddle.group, farPaddle.group);

    /* ---------- ball ---------- */

    const ballMaterial = new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0 });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(tunnel.ballRadius, 32, 16), ballMaterial);
    const ballGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    ballGlow.scale.setScalar(tunnel.ballRadius * 7);
    const ballLight = new THREE.PointLight(0xffffff, 9, 4.5, 1.6);
    ball.add(ballGlow, ballLight);
    scene.add(ball);

    /* ---------- sparks and explosions ---------- */

    const sparkGeometry = new THREE.RingGeometry(0.92, 1, 40);
    const sparkPool = [];
    function sparkMesh(index) {
        if (!sparkPool[index]) {
            const mesh = new THREE.Mesh(sparkGeometry, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
            scene.add(mesh);
            sparkPool[index] = mesh;
        }

        return sparkPool[index];
    }

    /** Shards of an exploding paddle: they fly apart, spin, fall and fade. */
    const shards = [];
    const shardGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1, -0.6, 0), new THREE.Vector3(1, -0.4, 0), new THREE.Vector3(0.1, 0.9, 0)]);
    const flashGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: ballGlow.material.map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    scene.add(flashGlow);
    let flashAge = 1;
    const hidden = { near: false, far: false };

    /**
     * Blows up a paddle: it vanishes into shards in its own colour, with a flash.
     *
     * @param {'near'|'far'} side
     * @param {{x: number, y: number}} paddle where the paddle was
     */
    function explode(side, paddle) {
        const z = side === 'near' ? 0 : D;
        const color = parseColor(colors[side].edge).color;
        hidden[side] = true;
        const pw = tunnel.paddleHalfWidth;
        const ph = tunnel.paddleHalfHeight;
        for (let index = 0; index < 70; index++) {
            const material = new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: index % 3 ? THREE.NormalBlending : THREE.AdditiveBlending });
            const mesh = new THREE.Mesh(shardGeometry, material);
            const size = 0.025 + Math.random() * 0.06;
            mesh.scale.setScalar(size);
            const startX = paddle.x + (Math.random() * 2 - 1) * pw;
            const startY = paddle.y + (Math.random() * 2 - 1) * ph;
            mesh.position.set(startX, -startY, -z);
            mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
            const away = side === 'near' ? 1 : -1;
            shards.push({
                mesh,
                velocity: new THREE.Vector3((startX - paddle.x) * 4 + (Math.random() - 0.5) * 2.5, -(startY - paddle.y) * 4 + Math.random() * 2, -away * (0.5 + Math.random() * 3)),
                spin: new THREE.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12),
                age: 0,
                life: 1.1 + Math.random() * 0.9,
            });
            scene.add(mesh);
        }
        flashGlow.material.color.copy(color);
        flashGlow.position.set(paddle.x, -paddle.y, -z);
        flashAge = 0;
    }

    /** Brings exploded paddles back, for a new level or match. */
    function restore() {
        hidden.near = false;
        hidden.far = false;
        for (const shard of shards) {
            scene.remove(shard.mesh);
            shard.mesh.material.dispose();
        }
        shards.length = 0;
    }

    function updateShards(dt) {
        for (let index = shards.length - 1; index >= 0; index--) {
            const shard = shards[index];
            shard.age += dt;
            shard.velocity.y -= 4 * dt;
            shard.velocity.multiplyScalar(Math.pow(0.4, dt));
            shard.mesh.position.addScaledVector(shard.velocity, dt);
            shard.mesh.rotation.x += shard.spin.x * dt;
            shard.mesh.rotation.y += shard.spin.y * dt;
            shard.mesh.rotation.z += shard.spin.z * dt;
            shard.mesh.material.opacity = Math.max(0, 1 - shard.age / shard.life);
            if (shard.age >= shard.life) {
                scene.remove(shard.mesh);
                shard.mesh.material.dispose();
                shards.splice(index, 1);
            }
        }
        flashAge += dt;
        const flash = Math.max(0, 1 - flashAge / 0.5);
        flashGlow.material.opacity = flash;
        flashGlow.scale.setScalar(0.5 + (1 - flash) * 3.5);
    }

    /* ---------- palette ---------- */

    function setPalette(palette) {
        colors = palette;
        scene.background = new THREE.Color(palette.background);
        walls.forEach((wall, index) => wall.mesh.material.color.set(palette.walls[index]));
        back.material.color.set(palette.back);
        const rail = parseColor(palette.rails);
        rails.material.color.copy(rail.color);
        rails.material.opacity = rail.opacity;
        const ring = parseColor(palette.rings);
        for (const ringLine of rings) {
            ringLine.material.color.copy(ring.color);
        }
        markerLine.material.color.set(palette.marker);
        markerGlow.material.color.set(palette.marker);
        for (const [paddle, side] of [[nearPaddle, palette.near], [farPaddle, palette.far]]) {
            const fill = parseColor(side.fill);
            paddle.fill.material.color.copy(fill.color);
            paddle.fill.material.opacity = fill.opacity;
            paddle.edge.material.color.set(side.edge);
            paddle.glow.material.color.set(side.edge);
            paddle.cross.material.color.set(side.edge);
        }
        ballMaterial.color.set(palette.ball[1]);
        ballMaterial.emissive.set(palette.ball[2]);
        ballMaterial.emissiveIntensity = 0.9;
        ballGlow.material.color.set(palette.ballGlow);
        ballLight.color.set(palette.ballGlow);
    }

    /* ---------- size and input ---------- */

    let width = 1;
    let height = 1;
    function resize() {
        width = canvas.clientWidth || 1;
        height = canvas.clientHeight || 1;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        // Fit the near end of the tunnel: by height, or by width on a narrow screen.
        const fitHeight = Math.max(H, W / camera.aspect) / margin;
        camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(fitHeight / distance));
        camera.updateProjectionMatrix();
        for (const material of lineMaterials) {
            material.resolution.set(width, height);
        }
    }

    /** The screen position of a point on the near plane (z = 0) back in tunnel units. */
    function toTunnel(screenX, screenY) {
        const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance;
        const halfWidth = halfHeight * camera.aspect;

        return { x: ((screenX / width) * 2 - 1) * halfWidth, y: ((screenY / height) * 2 - 1) * halfHeight };
    }

    /* ---------- one frame ---------- */

    const clock = new THREE.Clock();
    function draw(state) {
        const dt = Math.min(0.05, clock.getDelta());

        nearPaddle.group.position.set(state.player.x, -state.player.y, 0);
        farPaddle.group.position.set(state.opponent.x, -state.opponent.y, -D);
        nearPaddle.group.visible = !hidden.near;
        farPaddle.group.visible = !hidden.far;

        // The ball is hidden while the game is paused, including the countdown after a pause.
        const visible = state.ballVisible && !state.paused;
        ball.visible = visible;
        marker.visible = visible;
        if (visible) {
            ball.position.set(state.ball.x, -state.ball.y, -state.ball.z);
            marker.position.z = -state.ball.z;
        }

        const flash = state.backFlash;
        back.material.color.set(colors.back);
        if (flash > 0) {
            back.material.color.lerp(parseColor(colors.farRgb).color, 0.15 + flash * 0.5);
        }

        state.sparks.forEach((spark, index) => {
            const mesh = sparkMesh(index);
            mesh.visible = true;
            mesh.position.set(spark.x, -spark.y, -spark.z);
            mesh.scale.setScalar(0.15 + spark.age * 1.4);
            mesh.material.color.copy(parseColor(spark.color).color);
            mesh.material.opacity = 1 - spark.age / spark.life;
        });
        for (let index = state.sparks.length; index < sparkPool.length; index++) {
            sparkPool[index].visible = false;
        }

        updateShards(dt);
        renderer.render(scene, camera);
    }

    resize();

    return {
        draw,
        resize,
        toTunnel,
        explode,
        restore,
        setPalette: (palette) => setPalette(palette),
        palette: () => colors,
    };
}
