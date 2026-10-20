---
name: rules
description: Underlord's rules as the player experiences them (goal, gold, rooms, portal, research, waves). Read before changing any gameplay rule.
---

## When to use this

- You change a rule, a balance value or a player-facing text
- Keywords: win, lose, gold, capacity, Treasury, payday, wage, dig, claim, wall, room, portal, pool, creature limit, Lair, research, wave
- You need to know which doc holds the mechanics behind a rule

## Goal

- Survive every wave in `underlord/src/config/waves.js` (six; the last has the Lord of the Land).
- Win (`update()` -> `end(true)`): `G.wave >= WAVES.length`, spawn queue empty, and no living hero with `guard` false. Killing the Lord is not required by the check; killing the whole last wave is.
- Lose (`end(false)`): `G.heartHP <= 0`. Heart health: `settings/heart.js` `hp` (2500). Nothing heals the Heart except the cheat.
- The end card offers "New dungeon" / "Try again" and, on a loss, "Load last save".

## Gold

- Start gold: `settings/economy.js` `startGold` (1500).
- Capacity `cap() = heartCap + treasCap * Treasury tiles` (`economy.js`: 1500 + 500 per tile).
- All income except room refunds goes through `addGold(n)`, which only adds what fits under `cap()`; the rest is lost or stays where it was:
  - imps keep carried gold they could not deposit ("Your treasuries are full")
  - chests keep the gold that did not fit (`G.loot[i]` is reduced by what was taken)
  - hero bounties above the cap are lost
- Sources: digging gold seams (`economy.js` `seamGold` 300 per tile), gem tiles (20 per hit, never run out), chests in caverns, hero bounties (`heroes/*.js` `bounty` x `economy.js` `bountyMul`), selling rooms (half the tile cost, added directly; the end of the drag cuts off what is above `cap()`).
- Gold is deposited on a Treasury tile or any walkable tile next to the Heart (`depositGoal`).
- Spending: rooms (per tile), spells, Training (per second), wages.
- Treasuries only raise capacity; the pile drawn on them shows `(money - heartCap) / (treasCap * tiles)`.

## Paydays and wages

- Every `economy.js` `payInterval` (180 s, first one 180 s in) `payday()` runs.
- Each creature (imps excluded, creatures already leaving skipped) is paid `round(wage * wageMul)` (`creatures/*.js` `wage`, `economy.js` `wageMul`) in entity order. A creature that cannot be paid leaves ("unpaid"). Details: [creatures](creatures.md).
- The HUD Payday stat shows the countdown and the total due; it turns red when due > gold.

## Digging, claiming, walls

- Mark blocks with the Hand tool: click, or hold the button and sweep over blocks (Dungeon Keeper style; `paintTile()` per tile, tiles in between filled in a straight line). Seen tiles: only diggable ones (earth, gold, gem, reinforced wall). Unseen tiles: anything but rock.
- Click a marked block (or start a sweep on one) to unmark.
- Imps dig marked blocks, haul gold, then claim dug floor next to your territory (red `CLAIM` tiles). Claiming only spreads from tiles adjacent to existing territory.
- Idle imps reinforce unmarked earth next to your territory into walls (`WALL`): `settings/walls.js` `hp` (8) hits to dig, vs 3 for earth (heroes also need 5 for gold; imps empty a seam 20 gold per hit). Heroes path around walls when cheaper. Details: [imps](imps.md).
- Rock (map border) cannot be dug or crossed. New maps have no lava (older saves may: it cannot be dug or crossed either).

## Rooms

- Built only on your own claimed tiles without a room (`build()`), cost per tile in `rooms/*.js` `cost`. Click, or hold and sweep, with a room tool; a sweep stops at the first tile you cannot afford.
- Sell tool: any room tile, refunds `floor(cost / 2)`; gold above capacity after the sweep is cut off (`endPaint()`) ("Not all the gold fit").
- Room tile counts per type live in `G.rc[code]`, recomputed by `recount()`.

| Room | Code | Effect |
|---|---|---|
| Treasury | `TREAS` 1 | +`treasCap` gold capacity per tile; imps deposit there |
| Lair | `LAIR` 2 | One bed per tile; each creature locks one tile as its bed; portal needs Lair tiles > creatures |
| Hatchery | `HATCH` 3 | Hungry creatures eat here (hunger reset, +15% health) |
| Training Room | `TRAIN` 4 | Creatures gain XP; costs `economy.js` `trainCost` gold per second per trainee |
| Library | `LIB` 5 | Warlocks and Mistresses study; research unlocks spells |

Mechanics of eating, sleeping, training, studying: [creatures](creatures.md).

## Portal and attracting creatures

- One portal per map, near the Heart ([map](map.md)). Imps claim it like floor (it needs claimed ground next to it); then `G.pown[i] = 1`.
- After the first claim, an attempt every `settings/portal.js` `interval` (20 s); the first after `firstArrival` (6 s). `tryAttract()` per attempt:
  1. creatures (held ones included) >= `portal.js` `creatureLimit` (15) -> nothing ("creature limit")
  2. Lair tiles <= creature count -> nothing ("need a bigger Lair")
  3. candidates: kinds with `G.pool[k] > 0` whose `attract` rooms are met; random pick; random owned portal
- `attract` in `creatures/*.js` is a minimum total tile count per room type (not one connected room): Orc none; Troll Lair 9 + Hatchery 9; Warlock Library 9; Dark Mistress Training 9.
- `pool` in `creatures/*.js` is how many of that kind the portals hold on one map. It goes down per arrival and back up when a creature that came through a portal leaves or is dismissed (`toPool()`). Slain creatures are gone for good, and creatures that did not come through a portal (joined neutrals, cheats) never add to it, so the pool never exceeds its starting value.
- The Info tab lists every kind, its pool, whether its needs are met, creatures / limit, free beds and the next arrival.

## Research and spells

- Creatures in the Library add research points (Warlock fastest; Orc and Troll never study) (`G.research`, a running total). A spell unlocks when the total reaches its `research` value in `spells/*.js`: Create Imp 0, Call to Arms 150, Heal 400, Lightning 500.
- Call to Arms is free when cast on a claimed tile. Details: [spells](spells.md).

## Hero waves

- First wave after `settings/waves.js` `first` (300 s), then every `interval` (165 s). Heroes get +`heroScalePerWave` (12%) health and attack per wave after the first.
- Heroes walk and tunnel from the Hero Gate to the Heart, fight what they meet and hit the Heart when next to it. The Heart shoots nearby heroes. Details: [heroes](heroes.md).
- A camp of sleeping heroes (Knight + Archer) guards the farthest cavern; they are not part of any wave and do not block the win.

## Gotchas

- Capacity is enforced at income time and at the end of every paint stroke (`endPaint()`), not continuously: the gold cheats can push `G.money` above `cap()` until the next stroke on the map clamps it.
- Selling Treasury tiles lowers `cap()`; the clamp after the drag destroys the excess gold.

## See also

- [map](map.md) — where gold, the portal, caverns and the gate are placed
- [creatures](creatures.md) — how creatures use rooms, get paid and leave
- [heroes](heroes.md) — waves, tunnelling and the Heart
- [spells](spells.md) — spell costs and effects
- [dungeon-keeper](dungeon-keeper.md) — original Dungeon Keeper values and where these rules deviate
