---
name: spells
description: Underlord spells (Create Imp, Call to Arms, Heal, Lightning): costs, effects, research. Read before changing cast() or spell files.
---

## When to use this

- You touch `cast()`, `spellCost()`, `impCost()`, `research()`, the Spells tab or `underlord/src/config/spells/*.js`
- Keywords: spell, research, Create Imp, Call to Arms, rally, Heal, Lightning, bolt, cost

## Research order and requirements

- Order of `underlord/src/config/spells/index.js` = Spells tab order = Dungeon Keeper research order.
- `SPELLS[k].req` = `research` from the spell file. A spell is usable when `G.research >= req`; there is no chain, only a running total.

| Key | Name | `research` | `cost` | Effect values |
|---|---|---|---|---|
| `imp` | Create Imp | 0 | formula | |
| `rally` | Call to Arms | 150 | 300, 0 on own territory | `duration` 20 s |
| `heal` | Heal | 400 | 300 | `radius` 2.5 |
| `bolt` | Lightning | 500 | 600 | `damage` 90, `radius` 1.6 |

- Research comes from creatures studying in the Library ([creatures](creatures.md)). Each threshold crossed posts "Research complete: <name>."
- The Info tab gauge shows progress to the next locked spell; locked spell buttons are disabled and show "research N".

## Casting

Select the spell tool, click the map: `cast(k, tile, fx, fy)`.

1. `G.research < req`: "has not been researched yet".
2. `spellCost(k, i)` > gold: "Not enough gold".
3. Effect (below). If the effect's own target check fails, nothing happens and no gold is spent.
4. `G.money -= cost`.

## Create Imp (`imp`)

- Cost `impCost() = settings/imp.js baseCost + perImp * imps` (100 + 25 per imp you have, held imps included). `spells/imp.js` `cost` is unused.
- Target: a `CLAIM` tile. Spawns a level-1 imp there.

## Call to Arms (`rally`)

- Target: a seen, walkable tile. Free if the tile is `CLAIM` (`spellCost()`), otherwise `cost`.
- `G.rally = { i, until: G.time + duration }`; every creature not fighting or leaving drops its job (`think`).
- While active, `creatureThink()` sends creatures to the tile first ([creatures](creatures.md)); enemy scans still start fights on the way. Imps ignore it.
- A flag is drawn on the tile while active. Casting again replaces the rally.

## Heal (`heal`)

- Target tile must be seen. Every own unit (imps too) within `radius` of the click is set to full health. Green ring effect.

## Lightning (`bolt`)

- Target tile must be seen. Every hero (guards included) within `radius` of the click point takes flat `damage`, can be killed (bounty applies). Bolt effect drawn from the top of the map.
- Does not hurt own units or neutrals.

## Gotchas

- Own portal tiles are not `CLAIM`, so Call to Arms costs gold there.

## See also

- [computer-assistant](computer-assistant.md) — when the assistant casts spells
- [combat](combat.md) — `kill()` and bounties
- [rules](rules.md) — research from the player's side
