---
name: index
description: Hub for the Underlord docs: what the game is, the loop, the source map and every doc. Read first before changing anything in underlord/.
---

## When to use this

- Any task in `underlord/` (game logic, config, assets, UI, saves)
- You need to find which doc covers a function, a config file or a mechanic
- You need the source layout of the game

## What Underlord is

- A Dungeon Keeper (1997)-style real-time game in one canvas page. The player is a keeper: imps dig and claim, rooms attract and serve creatures, six hero waves march from a Hero Gate to the Dungeon Heart.
- Win: every wave in `underlord/src/config/waves.js` has spawned and no non-guard hero is alive. Lose: the Heart's health reaches 0.
- One map per game: 40 x 26 tiles (`W`, `H` in `underlord/src/game/underlord.js`).
- Only creatures and heroes from the original Dungeon Keeper belong in the game (see `AGENTS.md`).

## Game loop at a glance

`frame()` (requestAnimationFrame) -> `update(dt)` x speed (1-3) -> `draw()`; `ui()` + `drawMini()` every 0.2 s.

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
| `underlord/index.html` | Page: header HUD, stage canvas, overlay card, control panel (`aside`) |
| `underlord/src/main.js` | Imports styles + game; fills the version label |
| `underlord/src/game/underlord.js` | All game logic, drawing, input and UI (one file, dense code) |
| `underlord/src/styles/underlord.css` | Layout, colours, system font stacks |
| `underlord/src/config/index.js` | Combines all config into the object `applyConfig()` reads |
| `underlord/src/config/settings/*.js` | Tunables: `economy`, `imp`, `heart`, `portal`, `waves`, `hand`, `assistant`, `walls` |
| `underlord/src/config/creatures/*.js` | imp, orc, warlock, troll, mistress (order in `index.js`) |
| `underlord/src/config/heroes/*.js` | tunneller, archer, wizard, knight, lord |
| `underlord/src/config/rooms/*.js` | treasury, lair, hatchery, training, library |
| `underlord/src/config/spells/*.js` | imp (Create Imp), rally (Call to Arms), heal, bolt (Lightning) |
| `underlord/src/config/waves.js` | Hero waves, in order |
| `underlord/src/config/assets.js` | Which SVG is drawn for what |
| `underlord/src/assets/` | SVGs; conventions in `underlord/src/assets/README.md` |
| `tools/vite.js` | `singleFilePage()`: one self-contained HTML, `__BUILD_VERSION__` |

Section markers inside `underlord.js` (search for `/* ---------- name ---------- */`): config, assets, pathfinding, map, vision, entities, update, save / load, drawing, input, computer assistant, interface.

## Docs in this folder

| Doc | Read when |
|---|---|
| [rules](rules.md) | You need the rules as the player sees them: goal, economy, rooms, portal, research, waves |
| [map](map.md) | You touch `genMap()`, tile types, caverns, the portal, the gate, fog or vision |
| [imps](imps.md) | You touch `impThink()`, digging, claiming, reinforcing, gold hauling or imp fleeing |
| [creatures](creatures.md) | You touch `creatureThink()`, hunger, beds, training, research, wages, leaving, neutrals |
| [hand](hand.md) | You touch pick up / drop / dismiss (`pickUp()`, `dropHeld()`) or slapping (`slapAt()`) |
| [combat](combat.md) | You touch targeting, `fight()`, `attack()`, `kill()`, XP, bounties or line of sight |
| [heroes](heroes.md) | You touch waves, hero spawning, `march()`, tunnelling, the Heart zap, the hero camp, white dots |
| [spells](spells.md) | You touch `cast()`, `spellCost()`, research thresholds or a spell's effect |
| [computer-assistant](computer-assistant.md) | You touch `cpuTick()` / `cpuBuild()` / `cpuMove()` / `cpuSpells()` or the C button |
| [saving](saving.md) | You touch `serialize()` / `deserialize()`, localStorage, autosave or add entity/state fields |
| [rendering-and-ui](rendering-and-ui.md) | You touch `draw()`, caches, fog drawing, the minimap, sprites, panel tabs, HUD, input, cheats |

## Conventions for changes

- Tunable numbers belong in `underlord/src/config/`, documented in their file. Config keys are fixed: logic, waves and assets refer to them.
- Room codes are positional: `ROOM_IDS=['treasury','lair','hatchery','training','library']` maps to codes 1..5 (`TREAS`..`LIB`). Reordering `rooms/index.js` changes the Rooms tab order only; `ROOM_IDS` is hard-coded.
- The global game state is the object `G`, created in `newGame()`.
- `npm run build` must succeed; check changes in the browser (`npm run dev`, `/underlord/`).

## Gotchas

- `G.held` entities stay in `G.ents` too; code that adds `G.held` counts to `G.ents` counts double-counts them (see [hand](hand.md)).
- Several UI strings hard-code numbers that live in config: "20 seconds" (Call to Arms tip), "six invasions" (win card, intro), "10 seconds" (slap tip). Update them when changing the config.
- No fonts are embedded: the page uses system font stacks only (see [rendering-and-ui](rendering-and-ui.md)). Do not add font files.

## See also

- [rules](rules.md) — the player-facing rules, the best second read
- `underlord/README.md` — player instructions and controls table
- `underlord/src/assets/README.md` — SVG sizes, orientation and style
