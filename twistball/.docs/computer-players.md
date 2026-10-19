---
name: computer-players
description: How Twistball's computer players track the ball, move and serve. Read before changing CPU difficulty, moveCpu() or levels.js.
---

## When to use this

- Editing `moveCpu()` or `movePaddles()` in `twistball/src/game/game.js`.
- Tuning `opponentSpeed`, `opponentAim` or `opponentSpin` in `twistball/src/config/levels.js`.
- CPU vs CPU matches last forever or end too fast.

## How a CPU paddle moves (`moveCpu(side, dt)`)

- While the ball comes towards it: it predicts where the ball will arrive in a straight line (ignoring spin and walls, clamped to the tunnel) and aims at a mix of the ball's current position and that prediction, set by the level's `opponentAim` (0 = only where the ball is now, 1 = the prediction).
- While the ball goes away: it drifts towards 30 % of the ball's position, back near the centre.
- It moves at most `opponentSpeed` units per second per axis; its velocity is recorded but does not decide its spin (CPU spin is random, see [physics.md](physics.md)).

## Who is a CPU

- Solo: the far paddle. Demo: both. Online: neither (`movePaddles()` uses `moveHuman()` for both; the far target comes from the network).

## Serving

- CPUs serve like everyone: automatically at the end of the 3-2-1 serve countdown (`toServe()`), see [rules.md](rules.md).

## Gotchas

- Because the prediction ignores spin, curved balls are what beats the CPU. Higher levels raise `opponentAim` and speed, so they need bigger curves.
- In demo both CPUs use the same level, so rallies can be long at high speeds.

## See also

- [physics.md](physics.md) — ball movement and how CPU returns get their spin.
