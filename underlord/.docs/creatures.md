---
name: creatures
description: Underlord creature AI (creatureThink): hunger, Lair beds, training, research, wages, leaving. Read before changing creature behaviour.
---

## When to use this

- You touch `creatureThink()`, `tick()`, `toBed()`, `bedOwner()`, `hasBed()`, `gainXP()`, `research()`, `payday()`, `leave()`, `toPool()`, `tryAttract()`
- You add a creature (`underlord/src/config/creatures/`) or change its needs
- Keywords: hunger, Hatchery, sleep, bed, Lair, train, level, study, wage, unpaid, starving, leave, pool

## Entities

- `spawn(kind, x, y, mult=1)` creates every unit: `id`, `kind`, `side` (0 own, 1 hero, 2 neutral), `x/y` (tile centre +0.5), `hp/maxhp/atk` (x `mult`), `lvl` 1, `xp`, `state`, `path`, `hunger` (random 0-40), `slap`, `bed` -1, `guard`, ...
- `KINDS[k]` is built in `applyConfig()` from `creatures/*.js` and `heroes/*.js`: `n` name, `hp`, `atk`, `spd`, `range`, `rate`, `wage`, `col`, `vision` (default 5), `pool`, `attract`, plus hero `bounty`, `dig`, `big`.
- `creatures()` = own, living, non-imp entities (held ones included).
- States and their labels: `STATE_EN` at the top of `underlord/src/game/underlord.js`.

## creatureThink(e) priority

Runs from state `think`, after `release(e)`. Random rolls happen every think.

1. Call to Arms active (`G.time < G.rally.until`): walk to the rally tile, idle 1 s, repeat.
2. Health < 50%: `toBed()` -> `sleep`.
3. `hunger >= 100` and a Hatchery exists: one of the 6 nearest Hatchery tiles -> `eat` (2.5 s).
4. Warlock, Library exists, 80%: Library -> `study` (8 s).
5. Training Room exists, gold > 20, level < 10, 60%: -> `train` (8 s).
6. 35%: explore: walk (<= 40 steps) towards a tile next to unseen ground or a chest, idle 1.5 s.
7. Library exists, 50%: -> `study` (8 s) (any kind).
8. `toBed()`: walk to its bed and idle 2-5 s (this is where most creatures first claim a bed).
9. Else wander to a claimed tile within 5 steps, idle 2-5 s; or idle 2 s.

Enemy scanning in `tick()` interrupts all of this: see [combat](combat.md).

## Hunger and the Hatchery

- `tick()`: own non-imp creatures gain 1.5 hunger per second (not while held; neutrals are frozen).
- `eat` (must stand on a Hatchery tile): after 2.5 s `hunger = 0`, `hp += 15% maxhp`.
- `hunger >= 200` (about 133 s without food): `hunger = 0`, `leave(e, 'starving')`.
- Hover info shows hunger capped at 100%.

## Beds (Lair)

- A bed is one Lair tile, stored as `e.bed`. `hasBed(e)`: `e.bed >= 0` and that tile is still a Lair.
- `toBed(e)`: if the bed is gone, `e.bed = -1`. With a bed: path to it. Without: BFS to the nearest Lair tile no other living own unit has as `bed` (`bedOwner(i, e)`); the bed is claimed as soon as the path is found, before arriving.
- Nobody else sleeps on a claimed bed. It frees when the owner dies, leaves or is dismissed (`bedOwner()` skips dead units), or when the tile is no longer a Lair (sold).
- `sleep`: only on its own bed tile; heals 6% of `maxhp` per second; ends at full health. Being hit wakes a sleeper (`attack()`).
- Lair tiles with an owner show a nest and a dot in the owner's `color` ([rendering-and-ui](rendering-and-ui.md)).
- Dropping a creature on a free Lair tile moves its bed there ([hand](hand.md)).

## Training

- `train` (must stand on a Training tile, gold > 0): `G.money -= trainCost * dt` (`settings/economy.js` `trainCost` 1.5/s), XP `+9/s` (Troll `+11/s`) x `e.boost`, for 8 s.
- `gainXP(e, n)`: level up while `xp >= need(e) = 80 * lvl`, max level 10. Per level: `maxhp *= 1.12`, full heal, `atk *= 1.1`, "Level N" text.
- Combat also gives XP ([combat](combat.md)).

## Research

- `study` (must stand on a Library tile): `research(dt * rate * boost)`, rate 4 for the Warlock, 1.2 for others, for 8 s.
- `research(n)` adds to `G.research` and posts "Research complete" for every spell threshold crossed ([spells](spells.md)).

## Wages and leaving

- `payday()` ([rules](rules.md)): pays `wage(k) = round(wage * economy.wageMul)` per creature in `G.ents` order while gold lasts; the others `leave(e, 'unpaid')`. Leaving creatures are skipped.
- `leave(e, why)`: message, BFS to an own portal; state `leave` walks there and then the creature is removed with `toPool()`. With no reachable own portal it vanishes immediately.
- While leaving it does not scan for enemies, and the starving check is skipped (hunger still rises).

## Pool and arrivals

- `G.pool[k]` starts at `pool` from `creatures/*.js` (Orc 8, Warlock 5, Troll 5, Mistress 3). `tryAttract()` takes one; `toPool()` gives one back on death, leaving or dismissal ([rules](rules.md)).
- `ATTRACT[k]` (built in `applyConfig()` for every own non-imp kind) holds the human-readable need text and `ok()`, which checks `G.rc` against `attract`.
- Arrivals spawn at a random owned portal at level 1.

## Adding a creature

1. Add `underlord/src/config/creatures/<key>.js` with every field documented (copy `orc.js`), list it in `creatures/index.js`.
2. Add `units.<key>` in `underlord/src/config/assets.js` and the SVG under `underlord/src/assets/units/`.
3. It is attractable automatically. Per-kind logic is hard-coded by key: Warlock study rate and Library preference, Troll training rate, the cheat list (`orc`, `warlock`, `troll`, `mistress`), the neutrals in `genMap()` (`orc`, `troll`).
4. Only Dungeon Keeper (1997) creatures.

## Gotchas

- Picking up a leaving creature and dropping it cancels the leave (the drop puts it in `stun` -> `think`). Loading a save does the same (state is not saved).
- Starving resets `hunger` to 0 before leaving, so a rescued creature starts fresh.
- Lair beds are claimed at think time (step 8) even for healthy creatures, so beds fill up fast; `tryAttract()` only compares Lair tile count with creature count, not with unclaimed beds.
- `e.boost` resets to 1 in `think`; only the job a drop starts directly gets `hand.workBoost`.
- Training requires gold > 20 to start but continues while gold > 0.
- `creatures()` includes held creatures; payday pays them; they do not get hungry while held.

## See also

- [hand](hand.md) — drop-into-room bonuses and bed moves
- [combat](combat.md) — how creatures pick fights
- [rules](rules.md) — attraction requirements and paydays from the player's side
