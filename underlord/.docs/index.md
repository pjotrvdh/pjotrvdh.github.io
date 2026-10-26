---
name: index
description: Hub for the Underlord docs: what the game is, the loop, the source map and every doc. Read first before changing anything in underlord/.
---

## When to use this

- Any task in `underlord/` (game logic, config, assets, UI, saves)
- You need to find which doc covers a function, a config file or a mechanic
- You need the source layout of the game

## What Underlord is

- A Dungeon Keeper (1997)-style real-time game, drawn in 3D with three.js (Kenney and KayKit models). The player is a keeper: imps dig and claim, rooms attract and serve creatures, six hero waves march from a Hero Gate to the Dungeon Heart.
- Win: every wave in `underlord/src/config/waves.js` has spawned and no non-guard hero is alive. Lose: the Heart's health reaches 0.
- One map per game: 40 x 26 tiles (`W`, `H` in `underlord/src/game/constants.js`).
- Only creatures and heroes from the original Dungeon Keeper belong in the game (see `AGENTS.md`).

## Game loop at a glance

`frame()` in `underlord/src/game/index.js` (requestAnimationFrame) -> `update(dt)` x speed (1-3) -> `view.render()`; `ui()` + `drawMini()` every 0.2 s.

`update(dt)` order, every step (`dt` capped at 0.05 s):

1. `G.time += dt`; wave timer -> `launchWave()`; spawn queue -> `spawn()` heroes at the gate
2. Portal timer -> `tryAttract()` (only once a portal is claimed)
3. Payday timer -> `payday()`
4. Heart zap at the nearest hero in range
5. `tick(e, dt)` for every live, not-held entity (the state machine)
6. Remove dead entities; `vision()` every 0.25 s; `cpuTick(dt)`; age effects
7. Lose / win check -> `end(win)`

## Where things live

| Path | What |
|---|---|
| `underlord/index.html` | Page: header HUD, stage canvas and label layer, overlay card, control panel (`aside`) |
| `underlord/src/main.js` | Imports styles + `game/index.js`; fills the version label |
| `underlord/src/game/index.js` | Boot: config, UI, input, model loading, `newGame()`, the frame loop; `?characters` opens the viewer |
| `underlord/src/game/constants.js` | Map size, tile and room codes, labels, tile-index helpers |
| `underlord/src/game/state.js` | `G` (the game, replaced by `newGame()`) and `app` (running, speed, tool, hover, drag, tab) |
| `underlord/src/game/config.js` | `applyConfig()`: `KINDS`, `ROOMS`, `SPELLS`, `ATTRACT`, ... from `src/config` |
| `underlord/src/game/tiles.js`, `path.js` | Tile questions (`walk`, `diggable`, `solid`, `cap`, ...); `bfs()`, `dijkstra()` |
| `underlord/src/game/map.js` | `genMap()`, `newGame()`, `vision()` |
| `underlord/src/game/entities.js` | `spawn()`, movement, reservations, beds, XP, research, gold, leaving |
| `underlord/src/game/prison.js` | Prison: knocking heroes out, hauling, jailed prisoners rising as Skeletons |
| `underlord/src/game/imps.js`, `creatures.js`, `combat.js` | Imp work; creature AI, portal, payday; targeting, fights, kills, hero marching |
| `underlord/src/game/world.js` | `update()`, `tick()` (the unit state machine), waves, win/loss, `fx()` |
| `underlord/src/game/actions.js` | Build, sell, mark, cast, pick up, drop, dismiss, slap |
| `underlord/src/game/cpu.js`, `save.js` | Computer Assistant; save and load |
| `underlord/src/game/ui.js`, `input.js` | HUD, panel, Chronicle, minimap, cheats; mouse, touch and keys |
| `underlord/src/render/` | The 3D view (three.js), see [rendering-and-ui](rendering-and-ui.md) |
| `underlord/src/styles/underlord.css` | Layout, colours, system font stacks, labels over the map |
| `underlord/src/config/index.js` | Combines all config into the object `applyConfig()` reads |
| `underlord/src/config/settings/*.js` | Tunables: `economy`, `imp`, `heart`, `portal`, `waves`, `hand`, `assistant`, `walls` |
| `underlord/src/config/creatures/*.js` | imp, orc, warlock, troll, mistress, skeleton (order in `index.js`) |
| `underlord/src/config/heroes/*.js` | tunneller, thief, archer, wizard, barbarian, knight, lord |
| `underlord/src/config/rooms/*.js` | treasury, lair, hatchery, training, library, prison |
| `underlord/src/config/spells/*.js` | imp (Create Imp), rally (Call to Arms), heal, bolt (Lightning) |
| `underlord/src/config/waves.js` | Hero waves, in order |
| `underlord/src/config/assets.js` | Which model (and portrait) is drawn for what |
| `underlord/models/` | The 3D models (.glb); `underlord/tools/import-models.mjs` copies them from the packs |
| `underlord/src/assets/` | Portrait SVGs, logo, favicon; conventions in `underlord/src/assets/README.md` |
| `tools/vite.js` | `singleFilePage({ copy: ['models'] })`: one HTML file plus the models folder, `__BUILD_VERSION__` |

## Docs in this folder

| Doc | Read when |
|---|---|
| [rules](rules.md) | You need the rules as the player sees them: goal, economy, rooms, portal, research, waves |
| [map](map.md) | You touch `genMap()`, tile types, caverns, the portal, the gate, fog or vision |
| [imps](imps.md) | You touch `impThink()`, digging, claiming, reinforcing, gold hauling, imp fleeing or imps defending the Heart |
| [creatures](creatures.md) | You touch `creatureThink()`, hunger, beds, training, research, wages, leaving, neutrals |
| [prison](prison.md) | You touch the Prison, prisoners (side 3), imps hauling them, or the Skeleton |
| [hand](hand.md) | You touch pick up / drop / dismiss (`pickUp()`, `dropHeld()`, `dismissHeld()`) or slapping (`slap()`) |
| [combat](combat.md) | You touch targeting, `fight()`, `attack()`, `kill()`, XP, bounties or line of sight |
| [heroes](heroes.md) | You touch waves, hero spawning, `march()`, tunnelling, the Heart zap, the hero camp, white dots |
| [spells](spells.md) | You touch `cast()`, `spellCost()`, research thresholds or a spell's effect |
| [computer-assistant](computer-assistant.md) | You touch `cpuTick()` / `cpuBuild()` / `cpuMove()` / `cpuSpells()` or the C button |
| [saving](saving.md) | You touch `serialize()` / `deserialize()`, localStorage, autosave or add entity/state fields |
| [dungeon-keeper](dungeon-keeper.md) | You balance a creature, hero, room or spell and need the original Dungeon Keeper values or Underlord's deviations |
| [rendering-and-ui](rendering-and-ui.md) | You touch the 3D view (`src/render/`), models, the character viewer, the minimap, panel tabs, HUD, input, cheats |

## Conventions for changes

- Tunable numbers belong in `underlord/src/config/`, documented in their file. Config keys are fixed: logic, waves and assets refer to them.
- Room codes are positional: `ROOM_IDS=['treasury','lair','hatchery','training','library','prison']` maps to codes 1..6 (`TREAS`..`PRISON`); saves store the codes, so add new rooms only at the end. `ROOMS` and the Rooms tab follow this hard-coded order; the order of `rooms/index.js` is not used.
- The global game state is the object `G`, created in `newGame()`.
- `npm run build` must succeed; check changes in the browser (`npm run dev`, `/underlord/`).

## Gotchas

- `G.held` entities stay in `G.ents` too: never add `G.held` to a count of `G.ents` or `creatures()` (see [hand](hand.md)).
- UI text that mentions a tunable reads it from config (Call to Arms duration, slap time, number of waves, the Lord's name). Keep it that way; `README.md` still says "six" waves in prose.
- No fonts are embedded: the page uses system font stacks only (see [rendering-and-ui](rendering-and-ui.md)). Do not add font files.
- The renderer only reads `G`; game rules never depend on what is drawn. Render-only unit fields (`hitT`, `hurtT`, `digging`, `aim`) are not saved.

## See also

- [rules](rules.md) — the player-facing rules, the best second read
- `underlord/README.md` — player instructions and controls table
- `underlord/src/assets/README.md` — the model packs, the import script and the SVGs
