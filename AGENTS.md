# Arcade

Arcade is the owner's collection of browser games, published at https://pjotrvdh.github.io/ (this repository is `pjotrvdh/pjotrvdh.github.io`). The owner talks to you in **Dutch**, so reply in Dutch; code, UI text and docs are in English.

## Docs first

- Before changing anything, read the wiki for that area: [.docs/index.md](.docs/index.md) for the Arcade (layout, build, DDEV, adding a game), and `<game>/.docs/index.md` for a game's rules and mechanics: [underlord/.docs/index.md](underlord/.docs/index.md), [twistball/.docs/index.md](twistball/.docs/index.md), [pro-skater/.docs/index.md](pro-skater/.docs/index.md).
- Update the matching doc in the same change as the code; a doc that disagrees with the code is a bug. Read [.docs/writing-docs.md](.docs/writing-docs.md) before adding or editing a doc.

## Structure

- The root is the Arcade index: `index.html`, `src/` (`games.js` lists the games, `main.js` renders the index) and `vite.config.js`.
- Every game lives in its own folder (for example `underlord/`), as an npm workspace listed in the root `package.json`, with a 16:9 `cover.svg` and an entry in `src/games.js`. The slug is the folder name and the URL: `/underlord/`.
- Every page builds to one self-contained HTML file (JS, CSS, SVGs and favicon embedded) with `singleFilePage()` from `tools/vite.js`. Do not add files a build would have to ship separately; the one exception is 3D models (`underlord/models`, `pro-skater/models`, copied next to the page with `singleFilePage({ copy: ['models'] })`).
- `npm run build` builds every workspace, then the index, and copies each game's `dist/` to `dist/<slug>`. The `github pages` workflow publishes `dist/` on every push to `main`.
- `public/404.html` is GitHub Pages' not-found page and also redirects the old `/Underlord/` URL to `/underlord/`.
- `npm run dev` serves the index and every game (`/<slug>/`). DDEV (default `ddev.site` TLD, no PHP or database): `ddev start` runs it through `.ddev/start-vite.sh` on https://arcade.ddev.site. Run npm commands as `ddev npm …` when DDEV is used.
- The index has a cyberpunk look (`src/styles/arcade.css`) and a graffiti logo, `src/logo.svg`, whose letters are paths (from Sedgwick Ave Display, SIL OFL), so no font is needed.
- Text uses system fonts only, so no font files are shipped (never Comic Sans). The Arcade index and Twistball use a DIN-like HUD stack (`Bahnschrift, "DIN Alternate", …`; Twistball's HUD numbers are monospaced); Underlord uses Palatino-style serifs for headings and a humanist sans (`"Gill Sans", "Segoe UI", "Trebuchet MS", …`) for the rest; Pro Skater a rounded heavy stack (`"Arial Rounded MT Bold", "Arial Black", …`) for headings and `system-ui` for the rest. Keep text contrast at WCAG AA or better.

## Twistball (`twistball/`)

3D pong down a tunnel: move the paddle while hitting to curve the ball. `twistball/src/game/game.js` holds the rules and the frame loop, `context.js` the shared state, `physics.js` the paddles and ball, `online.js` online play, `screens.js` the HUD and screens; `render.js` draws it with three.js, `net.js` does online play over PeerJS, `audio.js` makes the laser sounds with the Web Audio API (no sound files).

- Modes: 1 player (ten levels, pick a start level, local high scores), Play online (host-authoritative: the host simulates, the guest sends its paddle and draws the host's state mirrored) and CPU vs CPU. There is no local two-player mode.
- All tuning lives in `twistball/src/config`: `tunnel.js`, `rules.js`, `scoring.js`, `levels.js`, `cpus.js` (the kinds of computer) and `palettes.js`. Every palette must keep text at WCAG AA contrast.
- Online rooms use a 5-character code (`?room=CODE` joins directly); both sides send a heartbeat every second and a few seconds of silence ends the match.

## Phony Bonk's Pro Skater (`pro-skater/`)

Arcade skateboarding in 3D (three.js) in the spirit of Tony Hawk's Pro Skater 1+2, with Kenney Mini Skate models (CC0). Set up like Underlord: `src/config` (all data, documented values), `src/game` (rules, no three.js), `src/render` (three.js, only reads game state).

- `src/game/skater.js` is the movement (fixed-rate arcade physics), `src/game/park.js` the park map and the collision grid sampled from the models' triangles, `src/game/index.js` the frame loop.
- Feel first: the local skater never waits on anything. All tuning is in `src/config/physics.js` and `camera.js`; `?tune` shows live sliders.
- Runs on its own: its own dependencies (`three`) and code, nothing imported from the other games. Planned online play: rooms over MQTT through public brokers, each client owning its own skater.
- Models are copied from `./downloads` by `pro-skater/tools/import-models.mjs` into `pro-skater/models`. Only Kenney Mini Skate style; no assets from the original games.
- `npm test -w pro-skater` runs the physics tests (`node:test`) on the real park.

## Underlord (`underlord/`)

A Dungeon Keeper-style game in 3D (three.js). `underlord/index.html` is the page; `underlord/src/main.js` loads the styles and `underlord/src/game/index.js`, which boots the game. Game logic is in `underlord/src/game/` (one module per part, see the wiki's source map), the 3D view in `underlord/src/render/`; the renderer only reads the game state.

- All game data lives in `underlord/src/config`: one file per settings group, creature, hero, room and spell, plus `waves.js` and `assets.js`. Document every value in its file.
- The `index.js` in each config folder lists its files; for creatures, heroes and spells it also sets the order the game uses (rooms follow `ROOM_IDS` in the game). `underlord/src/config/index.js` combines everything into the object `applyConfig()` in the game reads.
- Keys are fixed: the game logic, the waves and the assets refer to them.
- **Only creatures and heroes from the original Dungeon Keeper (1997)** are in the game; don't introduce others.
- 3D models are CC0 KayKit Block Bits (the dungeon blocks), Kenney (props, portal, Heart columns, Hero Gate) and KayKit Adventurers (every unit) `.glb` files in `underlord/models`, copied from `./downloads` (git-ignored) by `underlord/tools/import-models.mjs`; `underlord/src/config/assets.js` maps them. Keep new units in the KayKit style (borrow parts, tint, built-in pieces) and check them in the character viewer (`/underlord/?characters`). Panel portraits are SVGs in `underlord/src/assets/units` (Plants vs. Zombies style). See `underlord/src/assets/README.md`. The logo is an SVG (`underlord/src/assets/brand/logo.svg`), not a font.
- Typing `iliketocheat` unlocks the Cheats panel for the current page load only.
- Games are saved in localStorage under `underlord-save`.

## Checks

- `npm run build` must succeed; CI builds every pull request and runs `npm audit`.
- After a change, check it in the browser (`npm run dev` or `npm run preview`).

## Git

- Commit messages are a single short subject line, with no body and no co-author or attribution trailer.
- Pull requests are always created as **drafts**.
