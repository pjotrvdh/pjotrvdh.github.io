---
name: imps
description: Imp AI in Underlord (impThink): digging, gold hauling, claiming, reinforcing walls, fleeing, defending the Heart. Read before changing imp work.
---

## When to use this

- You touch `impThink()`, `doDig()`, `doClaim()`, `doReinforce()`, `digTarget()`, `reinforceTarget()`, `depositGoal`, `arrive()`, `reserve()` / `release()`
- Imps dig the wrong blocks, ignore gold, stop claiming, or crowd one tile
- Keywords: imp, dig, mark, carry, deposit, claim, reinforce, wall, flee, defend, Heart alarm, slap boost

## Stats and sources

- `underlord/src/config/creatures/imp.js`: `hp` 40, `speed` 3.0, `wage` 0. `attack` (3), `range`, `rate` are only used when defending the Heart.
- `underlord/src/config/settings/imp.js`: `startCount` (4), `vision` (4, overrides the creature default), `baseCost`/`perImp` for Create Imp ([spells](spells.md)), `defendTime` (5 s) and `defendRange` (10 tiles) for defending the Heart.
- Imps never eat, sleep, train, study, get paid or leave; they are not in `creatures()`.

## impThink(e) priority

Runs from state `think`. First `release(e)` drops any reservation. `full = G.money >= cap()`.

1. Carrying >= 100 and not full: walk to the nearest `depositGoal` tile (Treasury tile or walkable tile next to the Heart) -> `deposit`.
2. Claim nearby: a `FLOOR` tile or unowned `PORTAL`, not reserved, next to a `CLAIM` tile, path length <= 2 -> reserve it, `claim` with 1.2 s.
3. Dig: nearest walkable tile next to a marked diggable block (`digTarget()`), -> reserve the block, `dig` with 0.15 s first hit.
   - `allowGold = !(full && carry >= 100)`: when full and loaded, only marked `EARTH` counts (no gold, gem or wall).
   - A block takes at most 2 imps (`G.res` count < 2); the least reserved neighbour wins.
4. Carrying anything and not full: deposit.
5. Claim at any distance (same test as 2).
6. A chest within 30 steps: walk onto it (`idle` 0.5 s); `tick()` takes the gold.
7. Reinforce: a `CLAIM` tile within 40 steps next to unmarked, unreserved `EARTH` -> reserve the earth, `reinforce`.
8. Else: 50% walk to one of 6 nearby room-free claimed tiles (<= 4 steps) and idle 1-2.5 s; otherwise idle 0.8-1.8 s.

## Work states

- `doDig()` — hit every 0.38 s (timer runs 1.25x faster while slapped). Aborts to `think` if the block is unmarked, no longer diggable or not adjacent.
  - `EARTH` / `WALL`: `G.hp[j]--`; at 0 `openTile(j)`.
  - `GOLD`: takes `min(20, G.gold[j])` into `carry`; opens when the seam is empty (300 -> 15 hits).
  - `GEM`: `carry += 20`, never opens.
  - Stops to `think` at `carry >= 100` unless full and digging earth (then it keeps digging earth).
- `doClaim()` — after 1.2 s on the tile, if a neighbour is `CLAIM`: `PORTAL` -> `G.pown[i]=1` and the "portal is yours" message; `FLOOR` -> `CLAIM`.
- `doReinforce()` — must stand on `CLAIM` next to the earth; a step every 0.5 s; after 5 steps the earth becomes `WALL` with `G.hp = WALL_HP`. Aborts if the tile gets marked or changes.
- `arrive()` with `deposit`: `addGold(carry)`; leftover stays in `carry` with "Your treasuries are full. Build more."

## Fleeing and defending the Heart

- In `tick()`, every 0.5 s (not while dazed or fighting), the imp first checks the Heart alarm, then fleeing.
- Heart alarm: every hero hit on the Heart (`march()`) sets `G.heartAlarm = defendTime`; `update()` counts it down. Not saved.
- Defend: while `G.heartAlarm > 0`, an imp within `defendRange` tiles of the Heart centre picks the nearest hero within `settings/heart.js` `zapRange` of the Heart (`heartFoe()`), releases its reservation and enters `fight` ([combat](combat.md)). This also interrupts fleeing. It fights until the target dies or is out of reach, then goes back to `think`; fighting gives XP like any own unit.
- Flee (not already fleeing, no Heart to defend): an enemy within 3.2 tiles with a clear shot (`nearestEnemy(e, 3.2)`) makes the imp walk to a tile next to the Heart that is > 3 tiles from the enemy, state `flee`, then idle 3 s.
- Heroes target imps like any own unit ([combat](combat.md)).

## Reservations

- `G.res: Map<tile, count>`; `reserve(e,i)` stores `e.resv`. Claim and reinforce targets must be unreserved; dig targets allow 2.
- Released on every think, on pick-up, when a fight starts, on leave and on death. Not saved; rebuilt from scratch on load.

## Slap boost

- `settings/hand.js` `slapBoost` (1.25) while `e.slap > 0` (`slapTime`, 10 s, after a slap): applies to the dig, claim and reinforce timers and to walking speed in `step()`. See [hand](hand.md).

## Gotchas

- `step()` applies `slapBoost` to every unit, so slapped creatures also walk 25% faster.
- `digTarget()` with `allowGold=false` also skips marked walls and gems, not only gold.
- Claiming needs an orthogonal `CLAIM` neighbour at the moment the timer ends; if none, the imp just rethinks.
- The portal tile stays `PORTAL` after claiming; tiles next to only the portal are not claimable through it.
- Carry can exceed 100 (gold comes in steps of 20 and earth digging continues when full).
- An imp killed while carrying loses the gold.
- A hero that turns on the defending imps stops hitting the Heart, so the alarm runs out; imps already in `fight` keep fighting, but no new imps join until the Heart is hit again.

## See also

- [map](map.md) — tile types, hit points and `bfs()`
- [hand](hand.md) — picking up imps and slapping
- [computer-assistant](computer-assistant.md) — automatic marking and Create Imp
