# Learn to Fly

*Learn to Fly*: a penguin who wants to fly slides down a ramp into the sky, earns cash for distance, altitude and air time, and buys bigger ramps, better gliders and rockets until he crashes through the iceberg at 6000 ft. Play it at [pjotrvdh.github.io/learn-to-fly](https://pjotrvdh.github.io/learn-to-fly/). It is one of the games in the [Arcade](../README.md).

The graphics, animations, fonts and sounds come from the game's SWF, exported by [`tools/import-swf.mjs`](tools/import-swf.mjs), and are drawn by a small timeline player on a full-window canvas ([`src/render`](src/render)). The game logic is in [`src/game`](src/game), all numbers in [`src/config`](src/config).

## How to play

- **Start** in the main menu with PLAY, Space or Enter. In the ramp menu ← → pick a ramp, Space goes to Fly! and Space again takes off; it shows your glider and rocket, on the penguin and in the panel.
- **Slide** down the ramp and wait until you reach the jump.
- **Fly:** the left and right arrow keys tilt the penguin. Diving gains speed, pulling up gains height. With a glider, keep under its red "critical velocity" or the air brakes you hard.
- **Rocket:** hold Space to burn fuel.
- **Bounce:** hit the water flat and fast enough and you skip back up.
- **Cash:** (distance + altitude) × flight time / 10, after every flight. Each of the five ramps has four achievements (distance, altitude, speed, glide time) with a cash reward; achievements open the bigger ramps.
- **Shop:** Ramp Height, Acceleration, Air Resistance, three gliders, three rockets and rocket fuel.
- **Win:** fly 6000 ft. The end screen counts your days.
- **Touch:** tap to click; in flight, hold the left or right third of the screen to tilt and the middle to fire the rocket.
- **Controls** (top right): settings (day intro, control reminders), sound (a volume slider each for music and sound effects; music starts off; M mutes and unmutes), pause (P or Esc) and full screen (F). The game and the settings are saved in your browser's localStorage, one key per value (`learn-to-fly.cash`, `learn-to-fly.level.gliders`, `learn-to-fly.option.music`, …), so you can change them by hand in the dev tools; the game shows a change at once.
- **Cheats:** type `iliketocheat` during the game to show the Cheats panel (cash, all upgrades, all ramps, endless fuel, win); type it again to hide it. A reload hides it too. Using a cheat is remembered in the saved game, and the penguin wears a pirate hat from then on.
- The game fills the whole window: every scene goes edge to edge, in flight you see more of the sky and sea, and the motion follows your screen's refresh rate.

## Development

From the repository root: `npm run dev -w learn-to-fly` for this game alone, `npm run build -w learn-to-fly` to build `learn-to-fly/dist/index.html`. See the [root README](../README.md) for the rest.

To export the assets again, put the SWF at `downloads/learn-to-fly.swf` (ignored by git) and run `node learn-to-fly/tools/import-swf.mjs`.

## Project layout

```
index.html              the page: one canvas
cover.svg               the game's tile on the Arcade index (16:9)
tools/import-swf.mjs    exports the SWF's assets into src/assets
src/
  assets/               library.json (shapes, fonts, texts, buttons, timelines; all vector), sounds/,
                        fonts/ (Patrick Hand, SIL OFL: the chalk handwriting)
  config/               the game's numbers: upgrades.js, physics.js, ramps.js, game.js
  render/               the player: display list and timelines, drawing, text, the frame loop
  game/                 the game, one file per scene, and audio, input, saving; the HTML screens
                        (ui.js; shop, ramp menu, boards, achievements, end), control bar, HUD
  styles/               the page, the control bar and HUD (learn-to-fly.css), the chalk screens (screens.css)
```

Learn to Fly, its graphics and sounds are © Light Bringer Games. Patrick Hand is © Patrick Wagesreiter, SIL Open Font License (`src/assets/fonts/OFL.txt`).
