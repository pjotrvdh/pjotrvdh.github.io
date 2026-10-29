---
name: game
description: Learn to Fly's scenes, flight physics, money, shop, ramps and achievements. Read before changing src/game or src/config.
---

## When to use this

- Changing the rules, prices, physics, the shop, the ramp menu, achievements or the ending.
- Porting another piece of the original ActionScript.

## Scenes (root frames)

| Frame | Label | Script |
|---|---|---|
| 1-2 | debug, loader | `start.js`: straight on to `init` (the loader is not exported) |
| 3, 5 | sponsor, intro | not used: not exported, never visited |
| 4 | init | `start.js`: defaults (`freshState()`); the fades and the hidden options menu are placed here and stay; then `mainmenu` |
| 6 | mainmenu | `menu.js`: opens finished (`menu2`, see `enterRootFrame()` in `start.js`). Play loads the save (shop if the first board was seen, else a new game), Clear Saved Data |
| 8 | shop | `shop.js` (HTML); saves the game |
| 9 | stage | `ramp-menu.js` (an HTML column in the bottom left corner over the ramp's picture, whose ice runs on to the left edge): pick one of five ramps, Fly! |
| 10 | dayintro | `day.js`: day + 1, tutorial boards in HTML (once each: start, first glider, first rocket) |
| 11 | game | `flight.js` |
| 12 | achievements | `achievements.js` (HTML): one card per achievement won, click to collect |
| 13 | outro | `outro.js`: iceberg crash, clouds, landing, then the HTML end screen ("You cleared the game in n Days") |
| 15 | cleardata | `clearData()` in `menu.js` (HTML yes / no), opened by `enterRootFrame()` (the frame has no script) |

- Scene changes go through `fade()` in `context.js`: the snow sweeps in, the root jumps (to `achievements` first if any were won), the snow sweeps out.

## Flight (`flight.js`, `config/physics.js`)

- Ramp: the penguin moves `vmag` along its angle; `settle()` snaps it onto the ramp shape with `hitTest`, half a pixel at a time; the slope 40 px ahead sets the angle and the speed gain (`rampSlide`).
- Past the ramp's end it jumps: speed becomes `vx`/`vy`, the angle (degrees) gets the glider's `sink`.
- Air: arrows turn (more when slow), Space burns fuel. The glide ratio follows `(vmag − fallSpeed) / (glideSpeed − fallSpeed)` by at most 0.05 a frame; movement mixes gliding along the angle with free fall. Above `criticalSpeed` the drag grows fast.
- Sea: flat (rotation 75-105°) and at least 20 px/frame bounces; else the penguin dives, floats up and the flight ends when it is slower than 0.7.
- The camera moves the world (`movecam()`), not the penguin; clouds are recycled ahead of the penguin (`getCloud()`).

## Money and achievements

- Cash after a flight: `round((round(distance) + round(maxaltitude)) × round(duration) / 10)`; the board shows the duration as ×0.1 per unit, at most ×3, but the payout uses it uncapped (original).
- Quirks kept from the original: the final distance is × 0.4; on diving in, `maxaltitude` is doubled to quadrupled (the altitude achievement uses half of it); duration starts at 9.5 and adds 0.02 a frame; glide-time achievements use `(duration − 9.5) / 0.6`.
- Achievements per ramp and their rewards: `config/ramps.js`. A ramp opens after `unlock` achievements over all ramps.
- Shop (`config/upgrades.js`): hovering a level shows that level's price; buying a level several steps up costs only that level's price (original). Fuel is for sale once you own a rocket.
- Flying past 6000 ft (`config/game.js`) pays 10000 and plays the outro; after the end screen `keepPlaying` lets you fly on.

## HTML parts

- Screens (`ui.js`: `h()`, `registerScreen()`, `showScreen()`, the chalk drawings in `DRAWINGS`; styles in `src/styles/screens.css`): shop, ramp menu, tutorial boards, achievements, end screen, clear data. Every root frame change hides them (`hideScreens()` in index.js); the frame's script shows its own and hides the canvas clips it replaces (`hideClips()`: hidden clips can't be clicked either).
- Touch (`input.js`): a tap is a click. A touch sets the body class `touch` (a mouse clears it; it starts on with a coarse pointer). In flight the touch pad (`#pad`, shown by `hud.js` with the HUD) holds the keys: ◀ ▶ in the bottom left corner, the rocket (only with a rocket; dimmed without fuel) in the bottom right. A finger can slide between buttons, several fingers work at once; hiding the pad or leaving the window lets go. The HUD fits between the buttons, or above them on a tall screen. With `touch`, the control reminders and tutorial boards name the buttons instead of the keys.
- The scene fades draw on their own canvas (`#fx`) above the screens.
- `controls.js`: the control bar (settings, sound, pause, full screen; M, P/Esc, F); the SWF's options menu is hidden (`options.js`). Settings: day intro (`skipCutscenes`: with it off and no board to show, the flight starts at once), control reminders, mute; kept in localStorage `learn-to-fly-options`.
- `hud.js` with the HTML in `index.html`: the control reminders after the jump, the flight HUD (speed with the glider's red zone, altitude, distance, resistance, fuel) and the score board, reading `f` and the root's `rdis`, `ralt`, `rdur`, `rtotal`. The HUD shows with every glider level.

## Cheats

- `cheats.js`: typing `iliketocheat` anywhere shows a Cheats button in the control bar, for the current page load only. It offers +$1,000, +$10,000, every upgrade at its top level, every ramp open (by marking all achievements done, without their rewards), endless fuel (`cheats.endlessFuel`, read in `getAir()`) and "Win the game" (in flight: sets the distance past the finish line, so the flight's own rules play the ending).
- Cheats save the game and call `stateChanged()` (`ui.js`), so an open shop or ramp menu redraws.

## Saving

- `state.js` keeps what the original's SharedObject kept, in localStorage `learn-to-fly-save`; the shop frame saves. The options are not saved (original).

## Gotchas

- A board, key or click lifts only after 0.4 s, so the click that opened the scene doesn't skip it.
- The loader, the intro cutscene, the sponsor (MaxGames: intro, logos, "Play more games" link, jingle), the version number and the menu's credit line are not exported (`LEFT_OUT` in `tools/import-swf.mjs`); characters nothing uses any more are dropped with them.
- In the original there is no HUD without a glider; the HTML HUD always shows.
- Scripts use the instance names of the original (`ramp1`…`ramp4`, `player`, `sea`, `hudc`, `fboard`, `sbtn<n>a`…); `clip.c(name)` returns a do-nothing stand-in when a child is missing, as AS2 did.

## See also

- [engine.md](engine.md) — the player the scripts run on.
