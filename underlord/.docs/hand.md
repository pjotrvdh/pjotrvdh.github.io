---
name: hand
description: Underlord's Hand: pick up, drop (stun, room bonus, bed move), dismiss via portal, slapping. Read before changing hand or slap rules.
---

## When to use this

- You touch `pickUp()`, `dropHeld()`, `slapAt()`, `entAt()`, the Hand branch of the canvas `pointerdown` handler, the `#held` list or `crPick()`
- Keywords: hand, held, capacity, drop, stun, dazed, workBoost, dismiss, portal, slap

## Settings

`underlord/src/config/settings/hand.js`: `capacity` (8), `dropStun` (1.0 s), `workBoost` (1.1).

## Picking up

- Hand tool, left-click within 0.42 tiles of an own, living, not-held unit (`entAt()`; imps and creatures, any state, also fighting or leaving).
- `pickUp(e)`: refused with "Your hand is full" at `capacity`. Otherwise `release(e)`, `held=true`, path/target cleared, `boost=1`, pushed onto `G.held` (a stack).
- Held units stay in `G.ents` but do not `tick()`, are not drawn on the map, are not targeted, do not reveal fog and do not get hungry. They keep their bed.
- Also from the Creatures tab: number buttons pick up the next unit with that activity (cycling via `G.crCycle`), the portrait picks up the highest level; right-click centres the view instead ([rendering-and-ui](rendering-and-ui.md)).
- The `#held` list shows the stack top first; clicking an entry moves it to the top ("next drop").
- Up to 4 held units are drawn next to the cursor.

## Dropping

Left-click with something in hand (checked in this order in `pointerdown`):

1. An own unit under the cursor: picks it up instead.
2. Own portal and the top unit is not an imp: dismiss (see below).
3. `CLAIM` tile or own portal: `dropHeld(i)` for the top unit.
4. Any other seen tile: "You can only drop creatures on your own territory."
5. Unseen tile: starts a dig-mark drag as usual.

`dropHeld(i)`:

- Unit placed at the tile centre, `scan = 0`, state `stun` for `dropStun`; white ring + dust.
- For creatures (not imps), `e.after` is the job to start right after the stun:

| Dropped on | Job | Condition |
|---|---|---|
| Training Room | `train` 8 s | gold > 0 |
| Library | `study` 8 s | |
| Lair tile not owned by another unit | bed moves there, `sleep` | |
| Hatchery | `eat` 2.5 s | |

- With a job, `e.boost = workBoost`: training XP and research are x1.1 for that session. `think` resets it to 1.
- Another unit's bed stays locked; dropping on it gives no job.

## Dismissing

- Clicking an own portal with a non-imp creature on top of the stack: it is removed (`dead=true`), returned to the pool (`toPool()`), its bed frees, "You dismissed your ...".
- An imp on top is dropped on the portal tile instead.

## Slapping

- Right-click without dragging (or the Slap tool, left-click) on an own unit: `slapAt()`.
- Effect: `e.slap = 10` s, `hp -= 4` (can kill; counts as "slain"), "Slap!" text.
- While `slap > 0`: `SLAP_BOOST` 1.25 on imp work timers and on walking speed for any unit; the sprite flickers.
- A slapped creature (not imp) that is not fighting is interrupted: reservation released, back to `think` (wakes sleepers, ends training).

## Gotchas

- Held units are in both `G.ents` and `G.held`. `creatures()`/`G.ents` counts already include them, but `tryAttract()`, the HUD Imps/Creatures stats, the wage total, the assistant's creature/imp counts and `serialize()` add `G.held` again, so held units count twice (and are saved twice, see [saving](saving.md)).
- `scan = 0` on drop means an enemy within 8 tiles switches the creature straight from `stun` to `fight`; the daze only happens when no enemy is near. Imps likewise start fleeing.
- Picking up and dropping a leaving creature cancels its leave.
- Dismiss checks only the top of the stack.
- `toolValid()` for the Hand with units in hand marks only `CLAIM` and own portals as valid; it does not mirror the unseen-tile drag case.

## See also

- [creatures](creatures.md) — what the dropped jobs do
- [imps](imps.md) — slap boost on imp work
- [computer-assistant](computer-assistant.md) — Move modes use `pickUp()` + `dropHeld()`
