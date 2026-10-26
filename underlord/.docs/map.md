---
name: map
description: Underlord map generation (genMap), tile types, caverns, portal, gate, fog and vision. Read before changing the map or visibility.
---

## When to use this

- You touch `genMap()`, `newGame()`, `vision()`, `los()` in `underlord/src/game/map.js`, or the tile helpers in `tiles.js` / `path.js`
- You add a tile type, change gold/lava/gem placement, caverns, loot, neutrals or the hero camp
- Keywords: tunnel size, Heart, portal, Hero Gate, seen, fog, clouds, shroud

## Grid and tile types

- `W=40`, `H=26`, `N=W*H`; index `ix(x,y)=y*W+x`. Per-tile typed arrays on `G`: `t` (type), `room`, `mark`, `hp`, `gold`, `seen`, `loot`, `pown`.

| Const | Code | Walk (`walk`) | See-through (`transp`) | Diggable | Notes |
|---|---|---|---|---|---|
| `ROCK` | 0 | no | no | no | Map border only |
| `EARTH` | 1 | no | no | yes | 3 hits |
| `GOLD` | 2 | no | no | yes | `seamGold` gold; imps drain 20 per hit; heroes need 5 hits |
| `GEM` | 3 | no | no | yes | Imps get 20 gold per hit forever; heroes' pathing treats it as impassable |
| `FLOOR` | 4 | yes | yes | no | Dug or cavern ground, unclaimed |
| `CLAIM` | 5 | yes | yes | no | Your territory; rooms go here |
| `HEART` | 6 | no | yes | no | 3 x 3 Dungeon Heart |
| `PORTAL` | 7 | yes | yes | no | Owned when `G.pown[i]` is 1 |
| `GATE` | 8 | yes | yes | no | Hero Gate, spawn point of waves |
| `LAVA` | 9 | no | yes | no | Obstacle for everyone; drawn animated |
| `WALL` | 10 | no | no | yes | Reinforced earth, `settings/walls.js` `hp` hits |

- `G.hp[i]` after generation: 5 for gold, 3 for everything else; `doReinforce()` sets `WALL_HP` on walls. `openTile(j)` turns a tile into `FLOOR` and clears its mark.

## genMap()

Every game is a new level, made up from the ranges in `LEVEL` (`map.js`) and given a made-up name (`levelName()`, `G.level`, saved; "Welcome to <name>" in the Chronicle).

Steps per attempt, in order (later steps overwrite earlier ones):

1. Fill with earth; border ring of rock.
2. Pick a side at random: the Heart lies near it, the Hero Gate near the opposite side. `f` points from the Heart into the map, `s` across it. Heart 5-9 tiles from its edge (anywhere along it, at least 9-10 from the corners); gate 3 tiles from the opposite edge.
3. `LEVEL.rocks` (4-14) outcrops of impenetrable `ROCK`, random walks of `rockSteps` (8-30), never within 9 tiles of the Heart or 5 of the gate.
4. Gold: `economy.js` `goldVeins` (48) times 0.75-1.25 random walks of 7 steps. No lava for now: `LAVA` still exists (older saves have it, and it is drawn and blocks everyone), but `genMap()` places none.
5. `LEVEL.gems` (4-8) single gem tiles, more than 11 tiles from the Heart.
6. `LEVEL.caves` (10-18) hidden caverns, more than 11 tiles from the Heart and 9 from each other (30 tries each, else skipped); each a random walk of `caveSteps` (12-24, the same for the whole level) stamping 2 x 2 `FLOOR` squares.
7. Heart area: a 9 x 9 earth square, then a 7 x 7 `CLAIM` square with the 3 x 3 `HEART` in the middle (40 claimed tiles).
8. Starter gold seam: 4 tiles across `s`, 5 tiles from the Heart along `f` (one earth tile past the territory).
9. The single portal: 7-9 tiles along `f` and 4-6 to either side, a 3 x 3 `FLOOR` patch with `PORTAL` in the centre. `G.portals = [i]`, `G.portal = i`.
10. Hero Gate: a 5 x 5 `FLOOR` patch with `GATE` in the centre.

Up to 40 attempts; an attempt is kept as soon as a hero path exists (`dijkstra(G.gate, adjHeart)`; rock blocks it), after 40 failures the last one is kept anyway.

After the loop: `G.hp` and `G.gold` per tile, then the caverns are populated.

## Cavern contents

- Caverns sorted by centre distance from the Heart, farthest first. Usable cells: still `FLOOR` and > 4 tiles from the gate. A cavern with < 3 usable cells gets nothing.

| Rank | Contents |
|---|---|
| 0 (farthest) | Hero camp: Knight + Archer with `guard=true`, state `guard`; chest of 600 |
| 1 | Neutral Orc (`side=2`, state `neutral`); chest of 200 |
| 2 | Neutral Troll; chest of 200 |
| 3 and further | Chests of 250 and 150 |

- Chests are `G.loot[i]` gold amounts. Any own unit standing on the tile takes what fits under capacity (`tick()`), so the chest can empty in parts.
- Neutrals: frozen (`tick()` returns early for side 2), ignored by all targeting, drawn faded with a "?". In `vision()`, a neutral on a seen tile with an own, not-held unit within 3 tiles joins: `side=0`, state `think`. Joining does not touch `G.pool`, and a joined neutral never goes back to it.
- Guards: see [heroes](heroes.md).

## Start of a game (`newGame()`)

- Fresh `G` (keeps `G.cpu.on`/`mode` from the previous game), `genMap()`, `settings/imp.js` `startCount` (4) imps on random claimed tiles.
- Seen at start (`reveal()`, so with their ring): tiles within 4.3 of the Heart centre and the 3 x 3 around each portal. Then `vision()`.
- Three Chronicle tips: claim the portal, mark earth, build a Treasury.

## Vision and fog

- `G.seen[i]` is permanent: once discovered, a tile stays visible; there is no live line of sight on seen ground. Heroes on seen tiles are always visible.
- `vision()` (every 0.25 s from `update()`): every own unit that is not held reveals all tiles within its radius (`offsets(R)`, a disc) that pass `los()`. `los()` steps through the line and fails on any non-transparent intermediate tile; the end tile itself is revealed even if solid, so walls show.
- `reveal(i)`: a tile a unit looks at gets `G.seen` bit 2 (looked at) and, with the 8 tiles around it, bit 1 (shown, out of the shroud). So there is always one tile of clear ground around everything you have discovered; `vision()` skips only looked-at tiles, so a ring tile still spreads its own ring once a unit sees it. Any non-zero `G.seen` counts as seen.
- Radius: imps `settings/imp.js` `vision` (4), creatures `vision` in their `creatures/*.js` (5). Heroes and neutrals reveal nothing.
- New seen tiles set `G.fogDirty`; the cloud layer (`underlord/src/render/fog.js`) then rewrites its W x H mask and clears the flag.
- Through the clouds the player sees (drawn by `render/fog.js`, `render/terrain.js` and `drawMini()`): gold and gem tiles (glints), dig marks, the portal(s) (always drawn, minimap too) and invading heroes as white dots ([heroes](heroes.md)). Chests, caverns, the gate, lava and neutrals do not show.
- The Hero Gate (model and light) is drawn only once the gate tile is seen.

## Pathfinding

- `bfs(start, goal, k, pass=walk, maxLen)`: 4-neighbour BFS; collects up to `k` goal tiles and returns the path to a random one of them (`[]` if the chosen goal is the start, `null` if none). Used by imps, creatures, heroes chasing in `fight()` and the assistant.
- Walking (`step()` in `underlord/src/game/entities.js`): units follow these tile paths but are not bound to the grid. Each unit aims for its own spot in a tile (`spot()`: the centre plus a fixed offset of up to 0.22 tiles from its `id`), and skips to the next path point whenever a straight line there stays on walkable tiles with room for its body (`lineWalk()`, 0.18 tiles on every side). So units cut corners, walk diagonally and do not stack on tile centres. Rules still go by the tile a unit stands on (`ti()`).
- `dijkstra(start, goal)`: hero tunnelling cost `hcost()`: walkable 1, earth 4, gold 6, wall 12; rock, gem, lava, Heart impassable.

## Gotchas

- Steps overwrite each other: caverns can erase gems and gold veins; the Heart square erases anything within 4 tiles of the Heart; the portal and gate patches cut into caverns.
- If cavern 0 has < 3 usable cells, there is no hero camp on that map (the next caverns keep their own roles).
- Cavern ranking uses the walk's start centre, not where its cells ended up.
- `bfs()` with a goal that matches the start returns `[]` (length 0); callers that test `p.length` treat that as "no path".
- The 40-attempt fallback can leave a map without a hero path. Heroes then stay at the gate, rerunning `dijkstra()` every tick (`march()` gets `null` -> `[]`), and the win check cannot pass until they are killed.

## See also

- [imps](imps.md) — digging, claiming the portal, reinforcing
- [heroes](heroes.md) — the gate, tunnelling and the hero camp
- [rendering-and-ui](rendering-and-ui.md) — how fog, clouds and the minimap are drawn
