---
name: pro-skater
description: Hub of the Phony Bonk's Pro Skater wiki (3D arcade skateboarding). Read first when working on anything in pro-skater/.
---

## When to use this

- Any change under `pro-skater/`.
- You need to know which Pro Skater doc covers a topic.

## What Pro Skater is

- Arcade skateboarding in the spirit of Tony Hawk's Pro Skater 1+2, with Kenney Mini Skate models; its own names, park and look.
- Now: Free Skate, one player, one test park (`config/parks/warehouse.js`). Planned: tricks, combos and scoring, then online multiplayer (rooms over MQTT, each client owns its own skater), Career Session.
- Feel comes first: the local skater never waits for anything, physics runs at a fixed rate and is arcade, not realistic.

## Where things live

| File | What it owns |
|---|---|
| `pro-skater/index.html` | the page: canvas, loading, title, pause, HUD |
| `pro-skater/src/game/index.js` | boot (models, park, view) and the frame loop: fixed-rate steps, interpolated drawing, title/play/pause |
| `pro-skater/src/game/park.js` | parsing a park map, the collision grid sampled from the models, ground and wall queries, spawns |
| `pro-skater/src/game/skater.js` | the skater's movement: riding, ollies, transitions, flying, landing, walls, bails |
| `pro-skater/src/game/input.js` | keyboard and gamepad, polled once per frame |
| `pro-skater/src/game/ui.js`, `tune.js` | screens and HUD messages; the `?tune` sliders |
| `pro-skater/src/render/*.js` | three.js: `view.js` (renderer, lights, shadows), `park.js` (instanced pieces), `skater.js` (board, character, clips), `camera.js` (follow camera), `models.js` (loading, triangles) |
| `pro-skater/src/config/*.js` | all data: `physics.js`, `camera.js`, `controls.js`, `pieces.js`, `parks/`, `assets.js`, `world.js` |
| `pro-skater/test/*.test.js` | `node:test` physics tests on the real park (`npm test -w pro-skater`) |

## Docs in this wiki

- [skating.md](skating.md) — how the skater moves: riding, walls, ollies, transitions and vert air, landing, bails, the camera. Read before touching `skater.js`, `camera.js` or `config/physics.js`.
- [parks.md](parks.md) — park maps, pieces and the collision grid. Read before editing a park, adding a piece or touching `park.js`.

## Gotchas

- `src/game/` never imports three.js: the physics runs in Node for the tests (and later on other clients). Rendering reads the state, never changes it.
- Every model shares one texture; `render/models.js` draws everything with one Lambert material and `THREE.Cache` so the texture loads once.
- The 3D models are the one kind of file shipped next to the page (`singleFilePage({ copy: ['models'] })`); keep `tools/import-models.mjs` in step with `config/pieces.js` and `config/assets.js`.
- The Browser pane in the desktop app pauses `requestAnimationFrame` when hidden; check physics with the tests or `?debug` rather than by watching.

## See also

- [../README.md](../README.md) — the player-facing description.
- [../../.docs/index.md](../../.docs/index.md) — the Arcade wiki (build, DDEV, adding a game).
