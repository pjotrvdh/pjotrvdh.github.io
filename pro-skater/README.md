# Phony Bonk's Pro Skater

Arcade skateboarding in a low-poly park, in the spirit of the classic skate games: push, carve, ollie over rails and down stairs, launch off kickers and fly out of quarter pipes. Play it at [pjotrvdh.github.io/pro-skater](https://pjotrvdh.github.io/pro-skater/). It is one of the games in the [Arcade](../README.md).

This is the first playable version: Free Skate on your own in one test park. Tricks, combos, scoring and online multiplayer come next.

## How to play

- **Push** with ↑ or W, **brake** with ↓ or S, **steer** with ← → or A D. On a gamepad: the left stick or the d-pad (up pushes, down brakes).
- **Ollie:** hold Space (A / ✕) to crouch, let go to pop. Hold longer for a higher ollie.
- **In the air** steer to spin. Land lined up with where you're going, forwards or fakie (backwards), or you bail.
- **Quarter pipes and the halfpipe:** ride up fast and you fly straight up out of them and drop back in.
- Esc or P (Start) pauses, R (Back / Select) puts you back at the start.

## Development

From the repository root: `npm run dev` and open `/pro-skater/`, `npm run build -w pro-skater` to build `pro-skater/dist/` (the page plus `models/`), `npm test -w pro-skater` for the physics tests. Add `?tune` to the URL for live tuning sliders, `?debug` to reach the game state from the console as `proSkater`.

The 3D models are [Kenney Mini Skate](https://kenney.nl/assets/mini-skate) (CC0). `node pro-skater/tools/import-models.mjs` copies them from `downloads/Kenney/kenney_mini-skate` (not in git) into `models/`.

## Project layout

```
index.html              the page: canvas, title, pause and HUD
cover.svg               the game's tile on the Arcade index (16:9)
vite.config.js          one self-contained HTML file plus models/ (see ../tools/vite.js)
models/                 Kenney Mini Skate .glb files and their shared texture
tools/import-models.mjs copies the models from ./downloads
src/
  main.js               entry point: styles, game and the version label
  config/               all game data: physics, camera, controls, pieces, parks, assets
  game/                 rules without three.js: park (collision grid), skater (physics), input, ui, tuning panel, the frame loop (index.js)
  render/               three.js: view, park, skater, follow camera, model loading
test/                   node:test physics tests on the real park
```

See the [wiki](.docs/index.md) for how each part works.
