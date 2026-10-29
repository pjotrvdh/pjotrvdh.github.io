---
name: twistball
description: Hub of the Twistball wiki (3D tunnel pong). Read first when working on anything in twistball/.
---

## When to use this

- Any change under `twistball/`.
- You need to know which Twistball doc covers a topic.

## What Twistball is

- Pong down a tunnel. The near paddle is see-through (yours, or CPU 1); the far paddle guards the other end.
- Moving a paddle while it hits the ball puts spin on it, so the ball curves down the tunnel.
- Three ways to play: **1 player** against the computer through ten levels, **Play online** against another person (PeerJS), and **CPU vs CPU** to watch.

## Where things live

| File | What it owns |
|---|---|
| `twistball/index.html` | the page: HUD, canvas, every screen (title, online, ready, resume, pause, level cleared, end) |
| `twistball/src/game/game.js` | the rules (starting, serving, hits, points, levels, the end of a game), pause and menu, the frame loop, wiring the buttons |
| `twistball/src/game/context.js` | what every part shares: config, renderer, the paddles `near` / `far`, `state`, `clock`, `sideKey()` |
| `twistball/src/game/physics.js` | paddles (human and computer), the ball, sparks |
| `twistball/src/game/online.js` | online play: rooms, ready check, host state, guest mirroring, pause, heartbeat |
| `twistball/src/game/screens.js` | HUD, calls, screens, high score lists, hint, the serve and resume countdowns, title screen settings |
| `twistball/src/game/input.js` | pointer, drag, keys, leaving the page |
| `twistball/src/game/share.js`, `palette-menu.js`, `wake.js` | sharing a room (links, QR); the palette choice; the screen wake lock |
| `twistball/src/game/render.js` | three.js renderer, explosions |
| `twistball/src/game/net.js` | PeerJS rooms: create, join, send |
| `twistball/src/game/audio.js` | laser sounds (Web Audio, no files) |
| `twistball/src/game/highscores.js` | local high score list |
| `twistball/src/config/*.js` | all tuning: `tunnel.js`, `rules.js`, `scoring.js`, `levels.js`, `cpus.js` (kinds of computer), `palettes.js` |
| `twistball/src/styles/game.css` | layout, HUD, screens, share options; colours come from the palette as CSS variables. Screens (`.overlay`) are a modal over the whole page, centred and scrolling when taller than the window; on a phone (≤ 640 px wide, or landscape under 500 px high) they fill the whole screen, and in portrait the canvas takes all the height left (the camera fits the tunnel's width) |

## Docs in this wiki

- [rules.md](rules.md) — modes, lives, levels, serving, scoring and the end of a game. Read before changing how a game is played or won.
- [physics.md](physics.md) — coordinates, ball movement, spin, walls, paddle hits and paddle input. Read before touching `moveBall()`, `launch()` or `moveHuman()`.
- [computer-players.md](computer-players.md) — how the CPU reads the ball and serves. Read before changing difficulty or `moveCpu()`.
- [online.md](online.md) — host/guest model, message protocol, ready check, pause and countdown, heartbeat. Read before touching `net.js` or `online.js`.
- [rendering.md](rendering.md) — the three.js scene, camera, palettes, sparks and exploding paddles. Read before touching `render.js` or `palettes.js`.
- [audio.md](audio.md) — the laser "pew" sounds and when each one plays. Read before touching `audio.js`.

## Gotchas

- Text uses system fonts only (DIN-like HUD stack, monospaced HUD numbers); never add a font file. See [../../.docs/build.md](../../.docs/build.md).
- `localStorage` keys are prefixed `twistball-`: `twistball-highscores`, `twistball-name`, `twistball-palette`, `twistball-start-level`, `twistball-cpu`.

## See also

- [../README.md](../README.md) — the player-facing description.
- [../../.docs/index.md](../../.docs/index.md) — the Arcade wiki (build, DDEV, adding a game).
