---
name: computer-assistant
description: The Underlord Computer Assistant: its four modes and what cpuBuild, cpuMove, cpuSpells do. Read before changing assistant behaviour.
---

## When to use this

- You touch `cpuTick()`, `cpuBuild()`, `cpuMark()`, `cpuMove()`, `cpuSpells()`, `syncCpu()`, `CPU_DOES` or `settings/assistant.js`
- Keywords: Computer Assistant, CPU, Aggressive, Defensive, Construction only, Move only, auto-play

## State and UI

- `G.cpu = { on, mode, t }`; default off, mode `defensive`. Kept across New game (copied in `newGame()`) and saved ([saving](saving.md)).
- `#bCpu` ("C" on the minimap) toggles `on` (`aria-pressed`), resets `t` to 0 and logs it. `#cpuModes` (shown only when on) has one button per mode (`data-mode`, `aria-pressed`).
- `cpuTick(dt)` runs at the end of each `update()`: every `settings/assistant.js` `interval` (1.5 s) it runs the parts its mode enables.

## Modes (`CPU_DOES`)

| Mode | `cpuBuild()` | `cpuMove()` | `cpuSpells()` |
|---|---|---|---|
| `aggressive` | yes | yes | aggressive (Lightning, Call to Arms) |
| `defensive` | yes | yes | defensive (Lightning near the Heart, Heal) |
| `construction` | yes | no | no |
| `move` | no | yes | no |

## cpuBuild()

`settings/assistant.js`: `maxMarks` (24), `reserveGold` (300), `maxImps` (12), `impsPerClaimed` (35). `cpuMark(list)` marks diggable, unmarked, non-wall tiles until `maxMarks` marks exist in total.

1. No owned portal: for portals nearest the Heart first, BFS from the portal to any `CLAIM` tile through walkable or diggable non-gem tiles; mark that path.
2. Gold < 90% of `cap()` and marks < `maxMarks/2`: BFS from the tile right of the Heart (`hx+2, hy`) through walkable or diggable non-wall tiles to the nearest unmarked gold (or gem while gold < 50% of cap); mark the path.
3. Rooms, in this wish list order (`cre` = creatures incl. held):
   - Lair `max(4, cre+2)`, Hatchery 4, Treasury (`rc+4` if gold > 75% of cap, else at least 2), Training 9 and Library 9 once `cre >= 3`, Hatchery 9 once `cre >= 5`, Lair `max(9, cre+2)` once `cre >= 5`.
   - For each unmet entry, in order: as many missing tiles as gold minus `reserveGold` affords (0 -> stop the whole list). Free tiles are found by flood fill over `CLAIM` from that room's existing tiles (or from `hx+2, hy`): claimed, room-free, not next to the Heart. `build()` each; Chronicle "Assistant: built ...".
   - Fewer free tiles than needed -> `short`, stop.
4. `short` and marks < `maxMarks/2`: pick one of the 4 nearest claimed tiles that border earth or wall, take that neighbouring earth/wall tile, and mark it plus the 3 x 3 block centred one tile further out (walls marked directly, the rest via `cpuMark`).
5. Imps < `min(maxImps, imp.startCount + floor(claimed / impsPerClaimed))` and gold > `impCost() + reserveGold`: cast Create Imp on a random claimed tile next to the Heart.

## cpuMove()

- Visible heroes (not guards, on seen tiles): target = the one nearest the Heart. Drop tile = nearest `CLAIM` tile in the 9 x 9 box around it, 1.5 to 9 tiles away, with a clear shot. Up to 3 creatures (not fighting, health > 60%, > 8 tiles from the target, highest level first) are picked up and dropped there. Then return.
- No visible heroes: with a Training Room and gold > `reserveGold`, one idle creature (level < 10, hunger < 80) is dropped on a random Training tile.

## cpuSpells(aggressive)

- Candidates: visible heroes; aggressive = non-guards anywhere, defensive = any within 8 tiles of the Heart.
- Lightning (both): if researched and gold > cost + `reserveGold`, cast on the hero with the most heroes within the bolt radius.
- Call to Arms (aggressive): if researched, gold > cost + reserve, no rally active.
- Heal (defensive): if researched and gold > cost + reserve, on the first fighting creature below 40% health.

## Gotchas

- Call to Arms is never cast: `bfs(ti(h), walk, 1, walk, 6)` matches the hero's own walkable tile and returns `[]`, and the code requires `p.length`.
- `cpuMark()` skips walls, but step 1's path may run through a reinforced wall around your territory; that wall never gets marked, so the tunnel to the portal can stay blocked.
- Step 2 cannot path through walls at all; once the territory is fully walled in, it finds no gold.
- Step 4 marks walls directly, outside the `maxMarks` limit.
- Creature and imp counts include `G.held` twice ([hand](hand.md)).
- Defensive mode's Lightning can target guards that come within 8 tiles of the Heart.

## See also

- [imps](imps.md) — who digs what the assistant marks
- [hand](hand.md) — the pick-up / drop the Move part uses
- [spells](spells.md) — spell costs and effects
