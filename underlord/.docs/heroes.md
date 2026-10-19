---
name: heroes
description: Underlord hero waves, marching/tunnelling, the Heart zap, the hero camp, white dots, the Lord. Read before changing invaders.
---

## When to use this

- You touch `launchWave()`, the spawn queue in `update()`, `march()`, `dijkstra()`/`hcost()`, the Heart zap, `unknownHeroes()`, guards
- You edit `underlord/src/config/waves.js`, `settings/waves.js`, `settings/heart.js` or `heroes/*.js`
- Keywords: wave, invasion, gate, tunnel, dig, Heart, zap, guard, camp, white dot, Lord of the Land, bounty

## Heroes

`underlord/src/config/heroes/` (order in `index.js`): Tunneller, Archer, Wizard, Knight, Lord of the Land. Per hero: `hp`, `attack`, `speed`, `range`, `rate`, `bounty`, `dig` (seconds per hit when tunnelling), `color`; the Lord has `big: true` (drawn larger). Only Dungeon Keeper (1997) heroes.

## Waves

- `waves.js`: an array of `{ heroKey: count }`. Its length is the number of waves and decides the win.
- `G.nextWave` starts at `settings/waves.js` `first` (300 s); each launch resets it to `interval` (165 s). No more launches after the last.
- `launchWave()`: `G.wave++`; queues the heroes in the object's key order, 1.2 s apart (`G.spawnQ`); Chronicle "Wave N"; banner "Heroes approach" or, for a wave that contains a `lord`, "The Lord of the Land approaches" (with the current `waves.js` only the last).
- `update()` spawns due entries at the gate with `mult = 1 + heroScalePerWave * (G.wave - 1)` (`settings/waves.js`, 0.12): wave 1 x1.00, wave 6 x1.60 on `hp`, `maxhp`, `atk`. Bounty, speed and dig time are not scaled.
- HUD "Heroes": `wave N in m:ss`, then `final wave`.

## Marching (`march()`)

- State after spawn and after every `think` (unless `guard`).
- Standing next to the Heart (`adjHeart`): every `rate` seconds `G.heartHP -= e.atk` (no random spread), Heart flash, Heart alarm that sends nearby imps to defend it ([imps](imps.md)), "Your Dungeon Heart is under attack!" (20 s message cooldown).
- Otherwise: path from `dijkstra(here, adjHeart)`, recomputed every 5 s or when empty. Costs `hcost()`: walkable 1, earth 4, gold 6, reinforced wall 12; rock, gem, lava and Heart impassable.
- Next step not walkable: if diggable, hit it every `dig` seconds (`G.hp--`, `openTile()` at 0, dust); if not diggable, drop the path and recompute.
- Tunnelling destroys gold: a gold tile opened by a hero becomes floor and its `G.gold` is lost. Dug tiles are unclaimed `FLOOR`; heroes never unclaim territory.
- Combat interrupts marching ([combat](combat.md)): heroes scan for own units within 5 tiles.

## The Dungeon Heart

- `settings/heart.js`: `hp` (2500), `zapDamage` (14), `zapInterval` (0.8 s), `zapRange` (2.9 tiles from the Heart centre).
- `update()`: when `G.zapT <= 0`, the nearest hero (side 1, guards included) within range takes `zapDamage` (can `kill()`), then `zapT = zapInterval`. Without a target the timer stays at or below 0, so the next hero in range is shot at once.
- No regeneration; only the "Restore Heart" cheat refills it. 0 -> loss.

## The hero camp (guards)

- Placed by `genMap()` in the cavern farthest from the Heart, only if it has at least 3 floor tiles more than 4 tiles from the gate (otherwise there is no camp; no other cavern is used): a Knight and an Archer at strength x1, `guard = true`, state `guard`, plus a 600 chest ([map](map.md)).
- `guard` does nothing; `think` sends guards back to `guard` instead of `march`. They still scan for enemies (5 tiles) and fight, then stay where the fight ended.
- Drawn with a pale "z" while guarding. Excluded from white dots, from the win check, from the assistant's Move targets and from its aggressive spell targets; the Heart, Lightning and own creatures do hit them.

## White dots for unseen heroes

- `unknownHeroes()`: living heroes, not guards, on a tile with `G.seen = 0`.
- `render/fog.js` draws them as pulsing white dots above the clouds; `drawMini()` draws white dots on the minimap.
- On a seen tile the hero is drawn with its sprite, and hover shows its name. `G.seen` is permanent, so this happens as soon as it enters discovered ground, not only within sight of your units.

## The Lord of the Land

- In the last wave of `waves.js` (`lord: 1`), 1000 hp, bounty 1000, `dig` 0.6. Drawn as the Knight in gold armour with a crown (`assets.js`); `big` only widens its ring.
- Killing it posts "The Lord of the Land has fallen!". Victory still needs every non-guard hero dead.

## Adding a hero

1. `underlord/src/config/heroes/<key>.js` (copy `knight.js`, document every field), list it in `heroes/index.js`.
2. `units.<key>` (its KayKit figure) and `icons` in `underlord/src/config/assets.js` + portrait SVG in `underlord/src/assets/units/` (facing right). Check it in the character viewer (`?characters`).
3. Use the key in `waves.js`.

## Gotchas

- Heroes are visible on any discovered tile even with no unit nearby; the fog never returns.
- Guards are invisible (no dot, no sprite) while their cavern is undiscovered.
- The "Next wave now" cheat can launch a wave while the previous queue is still spawning; the remaining heroes then use the new wave's scaling.
- `march()` relies on `dijkstra()` finding the Heart; see the [map](map.md) fallback gotcha.
- Hero XP and levels do not exist: `gainXP()` is only called for own attackers.

## See also

- [combat](combat.md) — how heroes pick and fight targets
- [map](map.md) — gate placement, caverns, fog
- [spells](spells.md) — Lightning against heroes
- [dungeon-keeper](dungeon-keeper.md) — original hero stats; the Lord of the Land is a Knight in DK
