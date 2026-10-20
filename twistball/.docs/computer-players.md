---
name: computer-players
description: How Twistball's computer players track the ball, move and serve. Read before changing CPU difficulty, moveCpu() or levels.js.
---

## When to use this

- Editing `moveCpu()` or `movePaddles()` in `twistball/src/game/game.js`.
- Tuning `opponentSpeed`, `opponentAim` or `opponentSpin` in `twistball/src/config/levels.js`, or a kind of computer in `twistball/src/config/cpus.js`.
- CPU vs CPU matches last forever or end too fast.

## Kinds of computer (`cpus.js`)

- Every CPU paddle has a kind (`side.cpu`): **Calm** (slow, straight, little spin), **Aggressive** (fast, sharp angles, harder returns, follows the ball), **Trickster** (lots of spin and now and then a doubled "wild" curve) and **Wall** (reads the ball early, plain returns). Each kind changes the level's values rather than replacing them, so levels still get harder whichever kind plays.
- Solo: picked on the title screen ("1 player: computer", remembered as `twistball-cpu`), or **Auto** for a random kind every level (`pickSoloCpu()` in `startLevel()`). The far paddle's name is the kind's name, and the level call says it ("Level 3 · Trickster").
- CPU vs CPU: always two different kinds, picked at random for every match (`startGame('demo')`); the title-screen choice does not apply.

## How a CPU paddle moves (`moveCpu(side, dt)`)

- While the ball comes towards it: it predicts where the ball will arrive in a straight line (ignoring spin and walls, clamped to the tunnel) and aims at a mix of the ball's current position and that prediction, set by the level's `opponentAim` plus the kind's `aim` (0 = only where the ball is now, 1 = the prediction).
- While the ball goes away: it drifts towards the kind's `follow` share of the ball's position (0 = back to the centre).
- It moves at most `opponentSpeed × speed` units per second per axis; its velocity is recorded but does not decide its spin.

## How a CPU returns (`launch()`)

- Angle: from where the ball hit the paddle plus a little randomness, times the kind's `angle`. Ball speed times the kind's `smash`.
- Spin in a random direction: `(opponentSpin × spin + minSpin) × (1 … 2.5)`, doubled with chance `wild`.

## Who is a CPU

- Solo: the far paddle. Demo: both. Online: neither (`movePaddles()` uses `moveHuman()` for both; the far target comes from the network).

## Serving

- CPUs serve like everyone: automatically at the end of the 3-2-1 serve countdown (`toServe()`), see [rules.md](rules.md).

## Gotchas

- Because the prediction ignores spin, curved balls are what beats the CPU. Higher levels raise `opponentAim` and speed, so they need bigger curves.
- In demo both CPUs use the same level (the speed), so rallies can be long at high speeds, especially Wall against Calm.

## See also

- [physics.md](physics.md) — ball movement and how CPU returns get their spin.
