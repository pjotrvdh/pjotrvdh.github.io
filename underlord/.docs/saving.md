---
name: saving
description: Underlord save games: localStorage, SAVE_V format, autosave, saved fields, compatibility. Read before adding any state field.
---

## When to use this

- You touch `serialize()`, `deserialize()`, `saveGame()`, `loadGame()`, `readSave()`/`writeSave()`, `applySaveChanges()`, `refreshContinue()`, `SAVE_V` or `SAVE_KEYS` (all in `underlord/src/game/save.js`)
- You add a field to `G` or to entities and it must survive a reload
- Keywords: save, load, continue, autosave, localStorage, version, compatibility

## Storage

- One slot, one localStorage key per value under `underlord.save.` (`src/game/storage.js`, see [../../.docs/arcade.md](../../.docs/arcade.md)), so it can be edited by hand in the dev tools:
  - `save.version` (`SAVE_V`; a save exists once it is there), `save.savedAt`
  - `save.<money|heartHP|heartMax|time|nextWave|wave|research|payT|portalT|idc|hx|hy>` numbers, `save.level` text
  - `save.<spawnQ|cpu|pool|portals|portal|gate|rally>` JSON (`null` for no rally)
  - `save.map.<t|room|mark|hp|gold|seen|loot|pile|pown>` the per-tile arrays as JSON lists (`MAPS`)
  - `save.unit.<id>` one JSON record per unit (`SAVE_KEYS` and `held`); `writeSave()` removes the keys of units that are gone.
- `readSave()` puts them back together as `serialize()` made them; a missing or broken value is left out and keeps its `newGame()` value. `writeSave()` returns false when a key could not be written (private mode, quota).
- A save value changed by hand (or in another tab) also changes the running game at once (`store.watch()` in `index.js` -> `applySaveChanges()`): fields of `G` and tile arrays are put in, a changed unit gets the new fields, a new unit key adds the unit and a removed one takes it away. On the intro card it only updates Continue.
- Settings: `underlord.option.sound` (true/false) and `underlord.option.tab` (the last panel tab), also shown at once when changed.
- The old format (JSON under `underlord-save`, and `underlord-sound` / `underlord-tab`) is converted once at start, of any version, and removed; `loadGame()` still refuses an old version.
- `SAVE_V = 3` (3: the map grew to 80 x 52; older saves cannot load). `loadGame()` refuses any other `v` ("from an older version ... cannot be loaded").

## When it saves

- Save button (`#bSave`, only while `running`): `saveGame(false)`, Chronicle "Game saved.", label "Saved hh:mm".
- Autosave: `frame()` counts `autoT` down from 120 s with the frame's `dt` while running and not paused; then `saveGame(true)`, label "Autosaved hh:mm". The countdown does not speed up at 2x/3x.
- `saveGame()` does nothing when the game is over (`G.over`) or a save is in progress. Failure: label "Saving failed".
- `refreshContinue()` after every save and at start: shows "Continue saved game" on the intro card and enables Load when a save exists.

## Format (`serialize()`)

```text
v, savedAt
t, room, mark, hp, gold, seen, loot, pown   per-tile arrays (as plain arrays)
money, heartHP, heartMax, time, nextWave, wave, spawnQ, research
cpu {on, mode, t}, payT, pool, portals, portalT, idc, hx, hy, portal, gate
rally {i, until} | null           (until is game time, G.time)
ents: [{ SAVE_KEYS..., held }]
```

- `SAVE_KEYS = ['id','kind','side','x','y','hp','maxhp','atk','lvl','xp','carry','hunger','guard','bed','leaving','fromPool','payDue','cell','party']`.
- `ents` is `G.ents` (held units included once, with `held: true`).
- Not saved (reset on load): `state`, `path`, `next`, `timer`, `cd`, `slap`, `scan`, `ignoreT`, `target`, `resv`, `task`, `work`, `boost`, `after`, `face`, and the render hints `hitT`, `hurtT`, `digging`, `aim`; and on `G`: `res`, `fx`, `msgCd`, `crCycle`, `heartFlash`, `heartAlarm`, `zapT`, `visT`, `rc` (recounted), `over`, the Chronicle. The camera is not saved.

## Load (`deserialize()`)

1. `newGame()` first (a throwaway map and imps; resets `G` but keeps `G.cpu`), then overwrite `G` from the save.
2. Every saved entity is created with `spawn()` defaults, then `Object.assign`-ed with the saved fields. State (`startState()`) becomes `neutral` (`NEUTRAL`), `jailed` or `out` (`PRISONER`, via `restorePrisoner()`; see [prison](prison.md)), `guard` (guards), `march` (heroes) or `think` (own units); path empty.
3. `held` entities go back into both `G.ents` and `G.held`. Older saves listed held units twice; only the first entity per `id` is loaded.
4. `pool` is merged over the `newGame()` pool, so a creature kind added later gets its config value.
5. `recount()`, fog rebuilt, Chronicle cleared with "Saved game loaded.", `syncCpu()`. `loadGame()` then hides the overlay and sets `running` and unpaused.

## Compatibility rules

- Fallbacks for fields an older v2 save may lack: `spawnQ || []`, `cpu || G.cpu`, missing `pool` kinds; any missing entity field keeps its `spawn()` default (`bed` -1, `guard` false, `carry` 0, `leaving` '', `fromPool` false, ...).
- New per-entity field: add it to `SAVE_KEYS` and make its `spawn()` default safe for old saves.
- New `G` field: add it to both `serialize()` and `deserialize()` with a fallback (`s.x ?? default`), or it resets to the `newGame()` value.
- Changing tile codes, room codes (`ROOM_IDS`), map size or entity `kind` keys breaks old saves: bump `SAVE_V`.

## Gotchas

- Load cancels transient behaviour: sleepers wake, rallied creatures rethink (the rally itself is restored), imps drop their tasks. Leaving creatures keep `leaving` and head for the portal again.
- `newGame()` inside `deserialize()` re-centres the camera on the Heart.
- Config is not saved: changing a config value changes loaded games too (except stats already baked into entities: `hp`, `maxhp`, `atk`).

## See also

- [hand](hand.md) — why held units are in two lists
- [rendering-and-ui](rendering-and-ui.md) — Save / Load buttons and the saved label
- [creatures](creatures.md) — entity fields and states
