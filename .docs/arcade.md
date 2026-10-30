---
name: arcade
description: How the Arcade repository is laid out and how a game is added to the index. Read before adding a game or editing src/games.js or the index page.
---

## When to use this

- Adding a new game, or renaming or removing one.
- Editing the index page: `index.html`, `src/main.js`, `src/games.js`, `src/styles/arcade.css`, `src/logo.svg`.
- Touching `public/404.html` or old URLs.

## Layout

- The repository is `pjotrvdh/pjotrvdh.github.io`; GitHub Pages serves it at the root, `https://pjotrvdh.github.io/`.
- The root is the Arcade index. Every game is a folder named after its slug (`underlord/`, `twistball/`, `learn-to-fly/`), served at `/<slug>/`.
- Every game folder is an npm workspace listed in the root `package.json` (`workspaces`), with its own `package.json`, `vite.config.js`, `index.html`, `cover.svg`, `README.md` and `.docs/`.
- `shared/` holds code the games share at run time: `shared/storage.js` and `shared/one-tab.js` (see Saving below).

## Saving

- Every game saves through `storage(prefix)` from `shared/storage.js`: one localStorage key per value under `<slug>.` (`learn-to-fly.cash`, `twistball.option.palette`, `underlord.game.money`), numbers and true/false as plain text, lists and records as JSON. So a player can read and change each value by hand in the dev tools.
- `read`, `write` (null removes; returns whether it was kept), `readNumber` (rounded) / `readFloat`, `readBool`, `readJson` and `keys(start)` all swallow storage errors (private mode, full storage) and fall back to the default.
- localStorage is the truth: every game keeps what it would save there as it is now, not only at save points. Twistball writes each value the moment it changes; Learn to Fly and Underlord write what changed twice a second (`write()` skips a value that is already stored). A reload goes on with what is there.
- `watch(onChange)` reports the keys changed outside the game (checked twice a second, and on other tabs' `storage` events); the game's own writes are not reported. Every game shows such a change at once. It returns its check: a game that writes on a timer calls it first, so an edit by hand is taken in rather than written over.
- One tab at a time: `oneTab(lock, { game, accent, ink, onOwner, onLost })` from `shared/one-tab.js` holds a Web Lock while the tab is open. Another tab gets a modal over the whole page ("<game> is open in another tab", keys and clicks blocked) and writes nothing; it takes over when the first tab closes, or at once with Play here (the first tab then shows the modal and its `onLost()` pauses it). `onOwner(again)` with `again` reads localStorage back. Learn to Fly and Underlord use it; Twistball doesn't, so two tabs can still play each other online.
- `dropOldKey(key, convert)` converts and removes a key of an earlier format: old saves keep working, so keep a conversion when the format changes again.

## The index page

- `src/games.js` lists the games, newest first: `slug`, `title`, `description`, `tags` (genres, used for the filter) and `added` (ISO date). It is plain data: `vite.config.js` imports it too.
- `src/main.js` renders the list without `innerHTML` (game data is never parsed as HTML), with a search box and a genre filter; covers come from `<slug>/cover.svg` through `import.meta.glob`.
- Every game link opens in a new tab (`target="_blank" rel="noopener"`), with "(opens in a new tab)" in its accessible name.
- Look: cyberpunk (`src/styles/arcade.css`), the graffiti logo `src/logo.svg` (letters as paths, from Sedgwick Ave Display, SIL OFL), system fonts only (DIN-like HUD stack).
- Icons are [Lucide](https://lucide.dev) (`lucide` package, ISC), imported one by one in `src/main.js` and made with `createElement()`; they are decorative (`aria-hidden`), the text next to them carries the meaning. Genre icons come from `GENRE_ICONS`: give a new genre an icon there (unknown genres get a tag).

## Adding a game

1. Create `<slug>/` with a `package.json` whose `build` script writes one self-contained `<slug>/dist/index.html`: use `singleFilePage()` from `tools/vite.js` in its `vite.config.js` (see [build.md](build.md)).
2. Add `<slug>` to `workspaces` in the root `package.json`, then run `npm install` (or `ddev npm install`) to update the lockfile.
3. Add a 16:9 `<slug>/cover.svg` (480 × 270 viewBox, no external references) and an entry at the top of `src/games.js`.
4. Give the game a `README.md` and a `.docs/` wiki with an `index.md` hub; link the wiki from `AGENTS.md`.

## Gotchas

- `public/404.html` is GitHub Pages' not-found page and also redirects the old `/Underlord/` URL (the game's first home) to `/underlord/`. A real `Underlord/` folder can't exist next to `underlord/`: macOS file systems are case-insensitive.
- `localStorage` is per origin, so every game shares `pjotrvdh.github.io`: prefix every key with the game slug (`storage('<slug>.')`).

## See also

- [build.md](build.md) — the single-file build and the version label every page shows.
- [ddev.md](ddev.md) — running the dev server for the index and all games.
