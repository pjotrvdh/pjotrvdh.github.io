---
name: skating
description: How the Pro Skater skater moves (riding, walls, ollies, transitions, landing, bails) and the follow camera. Read before touching skater.js or camera.js.
---

## When to use this

- Editing `pro-skater/src/game/skater.js`, `pro-skater/src/render/camera.js`, `config/physics.js` or `config/camera.js`.
- The skater sticks, hops, goes through something, or lands or bails when it shouldn't.
- Tuning the feel (use `?tune`, then paste the copied values into the config).

## Units and state

- Metres, seconds, radians. x east, z south, y up. `heading` 0 faces +z; steering right lowers it.
- `stepSkater()` runs at `world.tickRate` (120 Hz) whatever the frame rate; `game/index.js` interpolates position and heading between the last two steps for drawing.
- A skater is plain data (`createSkater()`); `events` collects what happened in a step (`ollie`, `air`, `land`, `bail`, `wall`) for the HUD, and later sound and the network.

## On the ground (`ride()`, `roll()`)

- The board rolls where it points, at a signed `speed` (negative is fakie). No sideways sliding.
- Slope along the board (`park.slope()`) pulls with `gravity × slopeGravity`; pushing adds `pushAccel` up to `pushSpeed`; `coastDrag` and `brakeDecel` slow it; `maxSpeed` caps it. Turning gets wider with speed (`turnRate` → `turnRateFast`).
- **Walls:** `blocked()` checks the board's centre against where it is now and a point `probe` ahead (the nose) against the ground one sample before it. Anything rising more than `stepUp` is a wall, except a transition approached from its front. At an angle the board slides along the wall and turns parallel to it; head-on it bounces (`wallBounce`), or bails above `wallBailSpeed`.
- **Leaving the ground:** off an edge (ground drops more than `dropSnap` below the board's path; `vertStick` on transitions, which are sampled in straight bits) or over a crest, where the ground bends away faster than `crest` × gravity (kicker lips, the top of the funbox).

## Ollies

- Holding jump crouches and charges (`ollieChargeTime`); letting go pops with `ollieSpeed` to `ollieChargedSpeed` on top of the board's own motion. A late ollie still works for `coyoteTime` after rolling off an edge.

## Transitions and vert air

- On a `vert` piece (quarter pipe, bowl, mini ramp; see [parks.md](parks.md)) riding up its front, the board flies straight up when the slope passes `vertLaunchSlope` or the deck is just ahead: upward speed is `|speed| × vertBoost`, the part of the motion across the ramp's face is dropped and the part along it kept. `vert` remembers which way the ramp faces.
- Out of a transition you come down in the same transition and land lined up straight down it (or fakie, straight up it), if within `vertLandAngle`; otherwise you bail.

## In the air (`fly()`) and landing (`land()`)

- Gravity `gravity`; steering spins the body at `spinRate` (`spin` sums it), the velocity doesn't change.
- Running into something taller than the board: a ledge top within `stepUp` (twice that when falling) is landed on, a transition from its front is dropped into, anything else stops the horizontal motion (`wall`). Rising ground just after take-off (`liftTime`) lifts the board instead of landing it.
- Landing: below `landAnySpeed` anything goes; otherwise the board must be within `landAngle` of the direction of travel, forwards or fakie, and snaps to it. Speed after landing is the velocity along the ground, times `landKeep`.

## Bails

- `bail()`: the skater slides on for `bailTime`, slowing at `bailDecel`, then rides on from where it stopped. The HUD shows "Bail!"; scoring will drop the combo here.

## Camera (`render/camera.js`)

- Behind the direction of travel (the heading, turned round when fakie; the flight direction in the air; unchanged out of a quarter pipe so it keeps looking at the ramp), easing round at `yawFollow` and following height at `heightFollow`.
- Further back (`distanceFast`) and wider (`fovFast`) with speed. A ray from the skater to the camera through the collision grid pulls the camera in front of walls (`wallMargin`); it never goes below the ground.
- Only the local skater moves the camera.

## Gotchas

- The physics test (`pro-skater/test/skater.test.js`) runs the real park; when tuning, run `npm test -w pro-skater` and update the tests whose numbers you changed on purpose.
- `slope()` ignores edges (more than `world.cliff` between samples) except on transitions, so a deck edge doesn't count as a steep slope.

## See also

- [parks.md](parks.md) — the collision grid the skater rides on.
- [index.md](index.md) — the wiki hub.
