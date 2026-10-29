---
name: learn-to-fly
description: Hub of the Learn to Fly wiki (HTML5 remake of the Flash game). Read first when working on anything in learn-to-fly/.
---

## When to use this

- Any change under `learn-to-fly/`.
- You need to know which Learn to Fly doc covers a topic.

## What Learn to Fly is

- A penguin slides off a ramp, glides, fires rockets and lands in the sea; each flight pays cash for upgrades; flying 6000 ft wins.
- The scenes' graphics and sounds come from the game's SWF and play on a small timeline player (full window); the menus and dialogs are HTML in chalk. The game logic follows the SWF's scripts, quirks included.

## Where things live

| File | What it owns |
|---|---|
| `learn-to-fly/tools/import-swf.mjs` | exports the SWF: shapes, morphs, fonts, texts, buttons, sprites, bitmaps, sounds |
| `learn-to-fly/src/assets/` | the export: `library.json`, `bitmaps/`, `sounds/` (generated, do not edit) |
| `learn-to-fly/src/render/library.js` | loads the export; bitmaps with alpha masks |
| `learn-to-fly/src/render/display.js` | display objects and timelines with the AS2 API (`x`, `gotoAndStop()`, `hitTest()`, …) |
| `learn-to-fly/src/render/draw.js`, `text.js`, `matrix.js` | canvas drawing: fills, gradients, morphs, masks, filters, blend modes, texts |
| `learn-to-fly/src/render/player.js` | the frame: timelines, events, buttons, frame scripts, variables, streams |
| `learn-to-fly/src/game/scripts.js` | the script table the player runs, combined from the files below |
| `learn-to-fly/src/game/start.js`, `fades.js`, `options.js`, `penguin.js`, `menu.js` | the start (straight to the main menu), scene fades, the hidden options menu, the penguin's parts, main menu, clear data |
| `learn-to-fly/src/game/ui.js`, `src/styles/screens.css`, `src/assets/fonts/` | the HTML chalk screens: helpers, drawings, styles, the Patrick Hand font |
| `learn-to-fly/src/game/shop.js`, `ramp-menu.js`, `day.js` | shop, ramp (stage) menu, day intro and tutorial boards |
| `learn-to-fly/src/game/flight.js` | the flight, the HUD meters and the score board |
| `learn-to-fly/src/game/achievements.js`, `outro.js` | achievement rewards, the ending |
| `learn-to-fly/src/game/state.js`, `context.js`, `audio.js`, `input.js`, `index.js`, `controls.js`, `hud.js` | save game and options, shared helpers (music, fades), Web Audio, input, boot, layout and frame loop, control bar, HUD and score board |
| `learn-to-fly/src/config/*.js` | the original numbers: `upgrades.js`, `physics.js`, `ramps.js`, `game.js` |

## Docs in this wiki

- [engine.md](engine.md) — the export and the player: timelines, depths, scripts, drawing. Read before touching `src/render` or `tools/import-swf.mjs`.
- [game.md](game.md) — the scenes, the flight physics, money and achievements. Read before changing `src/game` or `src/config`.

## See also

- [../../.docs/arcade.md](../../.docs/arcade.md) — how a game is wired into the Arcade.
