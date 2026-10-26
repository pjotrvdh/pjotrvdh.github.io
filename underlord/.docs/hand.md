---
name: hand
description: Underlord's Hand: pick up, drop (stun, room bonus, bed move), dismiss via portal, slapping. Read before changing hand or slap rules.
---

## When to use this

- You touch `pickUp()`, `dropHeld()`, `dismissHeld()`, `slap()` (`underlord/src/game/actions.js`), the Hand branch of `onDown()` in `underlord/src/game/input.js`, the `#held` list or `crPick()`
- Keywords: hand, held, capacity, drop, stun, dazed, workBoost, dismiss, portal, slap, slapTime, likesSlaps, joy

## Settings

`underlord/src/config/settings/hand.js`: `capacity` (8), `dropStun` (1.0 s), `workBoost` (1.1), `slapTime` (10 s), `slapDamage` (4), `slapBoost` (1.25).

## Picking up

- Hand tool, left-click on an own, living, not-held unit (`view.pickUnit()`; imps and creatures, any state, also fighting or leaving).
- `pickUp(e)`: refused with "Your hand is full" at `capacity`. Otherwise `release(e)`, `held=true`, path/target cleared, `boost=1`, pushed onto `G.held` (a stack).
- Held units stay in `G.ents` (so `creatures()`, the HUD, wages, the portal's creature count, the assistant and saves count them once) but do not `tick()`, are not drawn on the map, are not targeted, do not reveal fog and do not get hungry. They keep their bed.
- Also from the Creatures tab: number buttons pick up the next unit with that activity (cycling via `G.crCycle`), the portrait picks up the highest level; right-click centres the view instead ([rendering-and-ui](rendering-and-ui.md)).
- The `#held` list shows the stack top first; clicking an entry moves it to the top ("next drop").
- Up to 4 held units are drawn next to the cursor.

## Dropping

As in Dungeon Keeper, **right-click** with something in hand drops the unit picked up last (`drop()` in `underlord/src/game/input.js`, any tool):

1. Own portal and the top unit is not an imp: dismiss (see below).
2. `canDrop(i, unit)` (`actions.js`): a `CLAIM` tile or own portal, or, for an imp, any discovered walkable tile (unclaimed ground too, as in Dungeon Keeper): `dropHeld(i)` for the top unit.
3. Anything else: "You can only drop creatures on your own territory." (for an imp: "Imps can only be dropped on open ground you have discovered.")

A left-click with something in hand still picks up another unit or marks blocks. On a touch screen (`pointerType` not `mouse`, no right button) a tap on a seen tile with the Hand drops instead.

`dropHeld(i)`:

- Unit placed at the tile centre, `scan = 0`, state `stun` for `dropStun`; white ring + dust.
- A dazed unit does not scan for enemies (imps do not flee); with `scan = 0` it scans on the first tick after the daze, so an enemy nearby is attacked (or fled from) right after it.
- For creatures (not imps, not leaving), `e.after` is the job to start right after the stun:

| Dropped on | Job | Condition |
|---|---|---|
| Training Room | `train` 8 s | gold > 0 |
| Library | `study` 8 s | kind has `study` > 0 (not Orc or Troll) |
| Lair tile not owned by another unit | bed moves there, `sleep` | |
| Hatchery | `eat` 2.5 s | |

- With a job, `e.boost = workBoost`: training XP and research are x1.1 for that session. `think` resets it to 1.
- Another unit's bed stays locked; dropping on it gives no job.

## Dismissing

- Clicking an own portal with a non-imp creature on top of the stack: it is removed (`dead=true`), returned to the pool if it came through a portal (`toPool()`, see [creatures](creatures.md)), its bed frees, "You dismissed your ...".
- An imp on top is dropped on the portal tile instead.

## Slapping

- Right-click on an own unit with an empty hand and the Hand tool (or the Slap tool, left-click): `slap(e)`. With a room, Sell or a spell selected, right-click puts it away instead.
- Effect: `e.slap = slapTime`, `hp -= slapDamage` (can kill; counts as "slain"), "Slap!" text.
- While `slap > 0`: `slapBoost` on imp work timers and on walking speed for any unit; the figure flickers.
- A slapped creature (not imp) that is not fighting is interrupted: reservation released, back to `think` (wakes sleepers, ends training).
- A kind with `likesSlaps` (`creatures/*.js`; only the Dark Mistress, as in Dungeon Keeper) takes no damage and is not interrupted ("Yes, master!"). While `slap > 0`, `joy(e)` = `slapBoost` multiplies her training XP, research and attack speed (`cd = rate / joy`).

## Gotchas

- Held units are in both `G.ents` and `G.held`: count `G.ents`/`creatures()` only, never add `G.held` on top.
- A leaving creature stays leaving (`e.leaving`): after a drop it walks to the portal again. A creature that decides to leave while in the hand heads out once dropped.
- Dismiss checks only the top of the stack.
- `toolValid()` for the Hand with units in hand uses the same `canDrop()` as a drop, so the outline always matches what a right-click does.

## See also

- [creatures](creatures.md) — what the dropped jobs do
- [imps](imps.md) — slap boost on imp work
- [computer-assistant](computer-assistant.md) — Move modes use `pickUp()` + `dropHeld()`
