---
name: physics
description: Twistball's coordinates, ball movement, spin, wall bounces, paddle hits and paddle input. Read before touching moveBall(), launch() or moveHuman().
---

## When to use this

- Editing `moveBall()`, `launch()`, `hits()`, `moveHuman()`, `update()` in `twistball/src/game/game.js`.
- Editing `twistball/src/config/tunnel.js` or the spin values in `rules.js`.
- A fast ball passes through a paddle, or curves feel wrong.

## Coordinates (`tunnel.js`)

- Game units: x to the right, y down, z into the tunnel. The tunnel is `2 × halfWidth` (2.8) by `2 × halfHeight` (2) and `depth` (10) deep.
- The near paddle is at z = 0, the far paddle at z = `depth`. Paddles are `2 × paddleHalfWidth` by `2 × paddleHalfHeight`; they can move until they touch a wall (`limitX`, `limitY`).
- The renderer converts to its own axes; see [rendering.md](rendering.md).

## The ball (`moveBall()`)

- State: position `x, y, z`, velocity `vx, vy, vz`, spin `sx, sy`.
- Every step: velocity += spin × dt (this is the curve), spin decays to `spinDecayPerSecond` (0.55) of itself per second, position += velocity × dt.
- `update()` runs the ball in sub-steps of 1/240 s, so a fast ball can't skip a paddle or a wall.
- **Walls:** past `halfWidth − ballRadius` (or the height equivalent) the ball is put back on the wall, that velocity component flips **and so does that spin component**, so the curve turns around with the bounce.
- **Paddle planes:** when the ball reaches z = 0 moving towards you (or z = `depth` moving away), `hits()` checks the paddle rectangle grown by the ball radius. A hit calls `launch()`; a miss calls `missed()`.

## Hitting and serving (`launch(side, isReturn)`)

- `vz` = level `ballSpeed` × `state.rallySpeed`, towards the other end; `rallySpeed` grows by `rallySpeedUp` on every return.
- **Human paddles:** sideways speed = offset from the paddle centre × `angleFromOffset` (1.6) + paddle speed × 0.15; spin = paddle speed × `spinFromPaddle` (0.55) × level `curve`. Moving fast while hitting means a big curve.
- **CPU paddles:** sideways speed from the offset × 0.8 plus a little randomness; spin in a random direction with strength `opponentSpin` × (1 to 2.5).

## Paddle input (`moveHuman()`)

- A human paddle follows a target: the pointer (`pointerToTarget()` via `renderer.toTunnel()`), or WASD / arrow keys at 2.6 units per second. Online, the far paddle's target comes from the guest's `input` messages.
- The paddle eases towards the target (fast follow), and its velocity is smoothed; that smoothed velocity is what turns into spin.

## Gotchas

- Spin direction follows the paddle's movement, and flips on wall bounces: a wall hit does not cancel a curve, it mirrors it.
- Changing `tunnel.js` sizes changes the CPU difficulty and the accuracy zone too, since both are relative to the paddle.

## See also

- [rules.md](rules.md) — what a hit or a miss means for lives and points.
- [computer-players.md](computer-players.md) — how the CPU moves its paddle.
