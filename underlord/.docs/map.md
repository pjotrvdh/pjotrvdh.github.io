---
name: map
description: Underlord map generation (genMap), tile types, caverns, portal, gate, fog and vision. Read before changing the map or visibility.
---

## When to use this

- You touch `genMap()`, `newGame()`, `vision()`, `los()`, `rebuildFog()` in `underlord/src/game/underlord.js`
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

Up to 40 attempts; an attempt is kept as soon as a hero path exists (`dijkstra(G.gate, adjHeart)`); after 40 failures the last attempt is kept anyway. Steps per attempt, in order (later steps overwrite earlier ones):

1. Fill with earth; border ring of rock.
2. `blob(GOLD, economy.goldVeins, 7)`: 13 random walks of 7 steps (`economy.js` `goldVeins`). `blob(LAVA, 2, 5)`: 2 lava walks of 5.
3. 2 single gem tiles at x 16-33, y 3-22.
4. 5 hidden caverns: centre x 13-32, y 3-22, up to 30 tries to keep > 7 tiles from earlier centres; each a 14-step random walk stamping 2 x 2 `FLOOR` squares (kept inside x/y 2..W-3/H-3).
5. Heart area at `hx=5`, `hy=H>>1` (13): a 9 x 9 earth square (clears anything there), then a 7 x 7 `CLAIM` square with the 3 x 3 `HEART` in the middle. That is the starting territory (40 claimed tiles).
6. Starter gold seam: x = `hx+5` (10), y = `hy-2..hy+1` (4 tiles), one earth tile past the territory.
7. The single portal: x 12-14, y = `hy ± (4..6)` (above or below at random), a 3 x 3 `FLOOR` patch with `PORTAL` in the centre. `G.portals = [i]`, `G.portal = i`.
8. Hero Gate: x = `W-4` (36), y 4-21, a 5 x 5 `FLOOR` patch with `GATE` in the centre.

After the loop: `G.hp` and `G.gold` per tile, then the caverns are populated.

## Cavern contents

- Caverns sorted by centre distance from the Heart, farthest first. Usable cells: still `FLOOR` and > 4 tiles from the gate. A cavern with < 3 usable cells gets nothing.

| Rank | Contents |
|---|---|
| 0 (farthest) | Hero camp: Knight + Archer with `guard=true`, state `guard`; chest of 600 |
| 1 | Neutral Orc (`side=2`, state `neutral`); chest of 200 |
| 2 | Neutral Troll; chest of 200 |
| 3, 4 | Chests of 250 and 150 |

- Chests are `G.loot[i]` gold amounts. Any own unit standing on the tile takes what fits under capacity (`tick()`), so the chest can empty in parts.
- Neutrals: frozen (`tick()` returns early for side 2), ignored by all targeting, drawn faded with a "?". In `vision()`, a neutral on a seen tile with an own, not-held unit within 3 tiles joins: `side=0`, state `think`. Joining does not touch `G.pool`, and a joined neutral never goes back to it.
- Guards: see [heroes](heroes.md).

## Start of a game (`newGame()`)

- Fresh `G` (keeps `G.cpu.on`/`mode` from the previous game), `genMap()`, `settings/imp.js` `startCount` (4) imps on random claimed tiles.
- Seen at start: tiles within 4.3 of the Heart centre and the 3 x 3 around each portal. Then `vision()`.
- Three Chronicle tips: claim the portal, mark earth, build a Treasury.

## Vision and fog

- `G.seen[i]` is permanent: once discovered, a tile stays visible; there is no live line of sight on seen ground. Heroes on seen tiles are always visible.
- `vision()` (every 0.25 s from `update()`): every own unit that is not held reveals all tiles within its radius (`offsets(R)`, a disc) that pass `los()`. `los()` steps through the line and fails on any non-transparent intermediate tile; the end tile itself is revealed even if solid, so walls show.
- Radius: imps `settings/imp.js` `vision` (4), creatures `vision` in their `creatures/*.js` (5). Heroes and neutrals reveal nothing.
- New seen tiles set `G.fogDirty`; `rebuildFog()` writes the W x H alpha mask used by the fog drawing.
- Through the clouds the player sees (drawn by `drawShroudTile()` / `drawMini()`): gold and gem tiles (glints), dig marks, the portal(s) (always drawn, minimap too) and invading heroes as white dots ([heroes](heroes.md)). Chests, caverns, the gate, lava and neutrals do not show.
- The Hero Gate glow and sprite are drawn only once the gate tile is seen.

## Pathfinding

- `bfs(start, goal, k, pass=walk, maxLen)`: 4-neighbour BFS; collects up to `k` goal tiles and returns the path to a random one of them (`[]` if the start is a goal, `null` if none). Used by imps, creatures, the Hand checks and the assistant.
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
