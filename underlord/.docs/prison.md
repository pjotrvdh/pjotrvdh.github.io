---
name: prison
description: The Prison, prisoners and Skeletons: capture(), haulJob(), grab(), jail(), prisonerTick(), side 3. Read before touching kills of heroes, imp hauling or the Skeleton.
---

## When to use this

- You touch `underlord/src/game/prison.js`, `kill()` for heroes, the imps' prisoner job, or the Skeleton
- You add a state or side that prisoners must ignore (targeting, win check, counts)
- Keywords: prison, prisoner, captive, knocked out, jailed, skeleton, side 3

## Capture

- `kill(t)` for a hero pays the bounty first, then calls `capture(t)`: with fewer prisoners than Prison tiles (`prisonRoom()`: one per tile), the hero is knocked out instead of slain: `side = 3`, `state = 'out'`, `hp = 1`, `timer = rooms/prison.js` `outTime` (45 s), `guard = false`. Chronicle "A <hero> is knocked out ...".
- Side 3 (prisoner): `nearestEnemy()` and `fight()` skip sides >= 2, the Heart zap and the win check only look at side 1, so prisoners are never fought and do not stop a win.
- A knocked-out hero that no imp fetches (`by` = 0) dies when `timer` runs out (death effect, no Skeleton).

## Hauling (imps)

- `impThink()` first `drop()`s whatever it carried, then (after hauling gold) `haulJob()`: if a Prison tile is free and reachable, the nearest `out` prisoner without `by` within 40 steps; sets `o.by = imp.id`, `imp.haul = o.id`, walks there -> `grab`.
- `grab(e)`: path to a free Prison tile (not the `cell` of another prisoner); `o.state = 'hauled'`, `o.cell` = that tile -> `jail`.
- `prisonerTick()` keeps a `hauled` prisoner on its imp; if the imp died, is held or stopped hauling, it falls back to `out` (and can be fetched again).
- `jail(e)`: on its cell, the prisoner becomes `jailed`, centred on the tile, `hp = maxhp`.

## Jailed

- Loses `starve` (2%) of `maxhp` per second: about 50 s to die.
- At 0 it dies and rises as a Skeleton (`spawn('skeleton')`, stunned 1.2 s) on its cell, unless your creatures already reach `portal.js` `creatureLimit`.
- Its cell sold (no longer `PRISON`): it escapes as a hero again (`side = 1`, `march`, at least 30% health). "A prisoner escapes!"

## The Skeleton

- `creatures/skeleton.js`: `portal: false` (never in `ATTRACT`, no pool, not in the Portal list), `eats: false` (no hunger, never leaves starving). Otherwise a normal creature: wage, beds, training.
- Drawn with KayKit Skeletons `Skeleton_Warrior` (cloak hidden) and `Skeleton_Blade`.

## Saving

- `cell` is in `SAVE_KEYS`. On load a side-3 unit is `jailed` if its `cell` is a Prison tile, else `out` with 30 s left; `by` and imps' `haul` are not saved.

## Drawing

- Prison: iron bars (Kenney Graveyard Kit `iron-fence`, 0.7 high) along the room outline (`rooms.js`).
- `out` and `hauled` prisoners lie (`sleep` clip); `hauled` ones float 0.45 up over their imp; `jailed` ones sit (`sit` = `Sit_Floor_Idle`). They hold no weapon in either pose.

## See also

- [combat](combat.md) — `kill()`
- [imps](imps.md) — job order
- [creatures](creatures.md) — creature needs
