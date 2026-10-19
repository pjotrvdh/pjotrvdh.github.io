---
name: rendering
description: Twistball's three.js renderer: camera, lights, neon bands, palettes, sparks and exploding paddles. Read before touching render.js or palettes.js.
---

## When to use this

- Editing `twistball/src/game/render.js` or `twistball/src/config/palettes.js`.
- Changing how the tunnel, paddles, ball, sparks or explosions look.
- Adding a palette or changing palette colours.

## Interface

- `createRenderer(canvas, tunnel)` returns `draw(state)`, `resize()`, `toTunnel(screenX, screenY)` (pointer → near-plane coordinates), `explode(side, paddle)`, `restore()`, `setPalette(palette)` and `palette()`. `game.js` uses nothing else, so the renderer can be swapped without touching the game.
- `draw()` reads `state.player`, `state.opponent`, `state.ball`, `state.ballVisible`, `state.paused`, `state.sparks` and `state.backFlash`.

## Scene

- Axes: a game point (x, y, z) is drawn at (x, −y, −z): three.js has y up and looks down −z.
- Camera at `depth / perspective` in front of the near paddle; its field of view fits the near end of the tunnel (by height, or by width on narrow screens, with a 4 % margin).
- Light: ambient light, a point light in front of the near end, and a point light carried by the ball, so the ball lights the walls as it flies. No shadow maps, no post-processing.
- Walls are `MeshStandardMaterial` planes; the back wall flashes in the opponent's colour when you score (`state.backFlash`).
- Neon edges (paddles, depth marker, rings) are **flat bands**: one `ShapeGeometry` with a hole (`band()`), plus a wider additive band as glow.
- Paddle corners are drawn thicker and brighter on purpose: `corners()` adds a ribbon per corner that follows the rounded corner exactly and then runs straight along both edges (so the edges stay straight), plus a wider glow ribbon. They share the edge and glow materials, so palettes colour them too.
- The depth marker is a frame at the ball's depth; the ball is a sphere with a glow sprite.
- The ball (and the depth marker) is hidden while `state.paused` is true, including the resume countdown.

## Explosions

- `explode(side, paddle)` hides that paddle and spawns 70 shards in its edge colour that fly apart, spin, fall and fade, plus a flash. It runs on every miss.
- `restore()` only shows the paddles again (shards still in the air fly on and fade). `toServe()` calls it at every serve; the guest calls it when the host's state says `serve`.

## Palettes (`palettes.js`)

- Each palette has `name`, `background`, `walls` (ceiling, right, floor, left), `back`, `rails`, `rings` ("r, g, b"), `marker`, `near`/`far` (`edge`, `fill`), `nearRgb`/`farRgb` (spark colours), `ball` (three gradient stops), `ballGlow`, and `ui` (CSS variables `--bg`, `--panel`, `--line`, `--near`, `--far`, `--accent`).
- The title screen shows every palette as a radio button with four swatches (you, opponent, ball, tunnel); the choice is stored as `twistball-palette`.
- Every palette must keep the `ui` text colours at WCAG AA contrast on `panel`.

## Gotchas

- Don't use three.js `Line2` or line segments for see-through neon edges: their segments overlap at every vertex, which shows as bright dots. Use `band()`.
- three.js is ~80 % of the page size. Import only what the renderer uses and avoid post-processing passes.

## See also

- [rules.md](rules.md) — when paddles explode and when the game is paused.
