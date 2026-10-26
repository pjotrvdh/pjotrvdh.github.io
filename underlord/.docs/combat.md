---
name: combat
description: Underlord combat: enemy scanning, line of sight (clearShot), fight/chase, damage, XP, kills, bounties. Read before changing how units fight.
---

## When to use this

- You touch `nearestEnemy()`, `clearShot()`, `fight()`, `attack()`, `kill()`, `gainXP()` or the scan block in `tick()`
- Units do not engage, chase forever, shoot through walls, or bounties look wrong
- Keywords: target, range, rate, cooldown, melee, ranged, projectile, XP, bounty, slain

## Who fights whom

- Sides: 0 own, 1 heroes, 2 neutral. `nearestEnemy(e, R)` skips dead, held, same-side and side-2 units, and needs `clearShot()`.
- Own creatures attack heroes (guards included). Heroes attack own creatures and imps. Neutrals are never targeted and never attack.
- Imps flee from heroes, except while the Heart is under attack: then nearby imps `fight` the heroes at the Heart ([imps](imps.md)).

## Scanning (`tick()`)

- Non-imp units not in `fight` or `stun` and not leaving (`e.leaving`): every 0.5 s (`e.scan`), if `G.time >= e.ignoreT`, look for the nearest enemy within 8 tiles (own creatures) or 5 (heroes). Found: `release(e)`, state `fight`, `target` set.
- The scan runs in every other state, so it interrupts sleeping, eating, training, studying, Call to Arms and hero `march` / `guard`. A dazed unit scans right after the daze ([hand](hand.md)).

## fight(e, dt)

- Target invalid (dead, held, switched side): back to `think`.
- Distance > 13: give up, `think`.
- In range (`dist <= range + 0.35`) with a clear shot: stand still, face the target, attack when `e.cd <= 0`, then `cd = rate / joy(e)` (faster for a slapped Dark Mistress, see [hand](hand.md)).
- Otherwise chase: every 0.6 s BFS over walkable tiles to the target's tile, max 22 steps. No path: `think` and `ignoreT = G.time + 3` (no new fights for 3 s).
- Heroes return to `march` (or `guard`) through `think` after a fight; guards do not walk back to their post.

## attack(e, t)

- Damage `e.atk * (0.85..1.15)`. Only `foes()` (constants.js) fight: neutrals and prisoners are never targets. Ranged (`range > 1.5`: Warlock, Archer, Wizard) shows a projectile; damage is instant.
- Own attackers (imps included) gain `damage * 0.4` XP ([creatures](creatures.md)).
- Hitting an own sleeping creature wakes it (`think`).
- `t.hp <= 0` -> `kill(t)`.

## kill(t)

- Heroes: `addGold(round(bounty * economy.bountyMul))` (only what fits under capacity), "+N" text; the Lord posts "The Lord of the Land has fallen!".
- Own units: "has been slain". Slain creatures do not go back to the portal pool ([rules](rules.md)).
- Also used by Lightning, the Heart zap, slaps and the "Defeat heroes" cheat.

## clearShot(a, b)

- Samples the segment 5x per tile; every tile crossed must be `transp` (floor, claimed, portal, gate, Heart, lava). A diagonal step between two solid corner tiles blocks it.
- Used for targeting, attacking and the assistant's drop spot. Different from `los()` used for fog ([map](map.md)).

## Stats

- `attack`, `hp`, `speed`, `range` (tiles, 1 = melee), `rate` (seconds between attacks) per kind in `underlord/src/config/creatures/*.js` and `underlord/src/config/heroes/*.js`.
- Levels multiply `maxhp` x1.12 and `atk` x1.1 per level; hero waves multiply `hp`/`atk` at spawn ([heroes](heroes.md)).

## Gotchas

- Bounties are lost when the treasury is full.
- `attack()` damage to the Heart is separate: heroes hit the Heart from `march()` (heroes.js), not `fight()`, with flat `e.atk` ([heroes](heroes.md)).
- The chase BFS only uses walkable tiles; heroes only tunnel while marching.
- Imps' `attack` / `range` / `rate` in `creatures/imp.js` are only used when they defend the Heart.

## See also

- [heroes](heroes.md) — marching, tunnelling and the Heart
- [creatures](creatures.md) — XP and levels
- [spells](spells.md) — Lightning and Heal
