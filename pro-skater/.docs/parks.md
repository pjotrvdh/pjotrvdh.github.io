---
name: parks
description: Pro Skater park maps, the Kenney pieces and the collision grid sampled from them. Read before editing a park, adding a piece or touching park.js.
---

## When to use this

- Editing or adding a park in `pro-skater/src/config/parks/`.
- Adding a Kenney piece (`config/pieces.js`, `tools/import-models.mjs`).
- Touching `pro-skater/src/game/park.js` or `pro-skater/src/render/park.js`.

## Maps

- A park is `{ name, map, spawns }`. `map` is rows of two-character tokens, one per 2.25 m tile; row 0 is north (−z), column 0 west (−x). Every row has the same length; `parseMap()` throws on a bad token or row.
- First character: the piece (`PIECE_CODES` in `config/parks/index.js`). Second: the direction its low side faces (`N E S W`), the axis a long piece runs along (`|` north–south, `-` east–west), a quarter-turn count (`0`–`3`, bowl corners) or `.`/`#` for none.
- `spawns` are tiles plus a facing; `park.spawn(i)` gives world coordinates and a heading. Keep 8 or more for multiplayer, on open floor.
- Register a new park in `config/parks/index.js`.

## Pieces (`config/pieces.js`)

- Kenney Mini Skate models on a 1 × 1 grid, scaled by `world.scale` (2.25: the skater is 1.75 m, a quarter pipe 1.8 m). Unrotated, every low side faces +z.
- `kind`: `ride` (roll on it; tall edges are walls), `vert` (a transition: ridden up from its `facing`, launches you out at the top), `solid` (rails, benches, fences: only jumped over, never landed on).
- `runs`: the axis a long piece runs along unrotated, for `|`/`-` tokens.

## The collision grid (`buildPark()`)

- `world.samples` (16) samples per tile side, 14 cm apart. Each sample's height comes from the model's own triangles (`heightAt()`), turned with the piece, so collision matches what is drawn.
- `ground`: highest non-solid surface; `top`: highest of everything; `vert` and `facingX/Z`: where a transition slopes and which way it faces (a transition's flat deck and floor count as plain ground).
- Queries: `groundAt()` interpolates smoothly but keeps edges (more than `world.cliff`) sharp, except on transitions; `groundNear()`/`topNear()` give the sample under a point (Infinity outside the park, so the edge is a wall); `slope()`, `normal()`, `vertAt()`.

## Drawing (`render/park.js`)

- One `InstancedMesh` per model and mesh part, with the shared material; a floor tile under every tile and a large plain ground round the park. Pieces cast shadows, the floor only receives them.

## Gotchas

- Steps are 22.5 cm and ledges 70 cm: both higher than `stepUp`, so walls you ollie onto or off. Kenney's ramp is half slope, half flat top (0.68 m); put two back to back for a funbox, or a ramp before steps for a stair set.
- A tall quarter pipe's deck behind it is part of the piece; put `##` decks behind a line of quarters so its back is not open.
- Changing `world.samples` or `world.cliff` changes how every piece rides: run the tests.

## See also

- [skating.md](skating.md) — how the skater uses the grid.
- [index.md](index.md) — the wiki hub.
