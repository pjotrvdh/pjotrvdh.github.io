# Arcade

Browser games by pjotrvdh, at [pjotrvdh.github.io](https://pjotrvdh.github.io/). Every game is a single, self-contained HTML file: open it and play, also offline.

| Game | Play | Source |
|---|---|---|
| Phony Bonk's Pro Skater: arcade skateboarding in a low-poly park; push, ollie and fly out of quarter pipes | [pjotrvdh.github.io/pro-skater](https://pjotrvdh.github.io/pro-skater/) | [`pro-skater/`](pro-skater) |
| Twistball: pong, but with a twist; curve the ball down a neon tunnel past the computer or a friend online | [pjotrvdh.github.io/twistball](https://pjotrvdh.github.io/twistball/) | [`twistball/`](twistball) |
| Underlord: dig a dungeon, attract creatures and defend your Dungeon Heart, in the spirit of Dungeon Keeper | [pjotrvdh.github.io/underlord](https://pjotrvdh.github.io/underlord/) | [`underlord/`](underlord) |

## Getting started

**With [DDEV](https://ddev.com/):** `ddev start` installs the packages and runs the Vite dev server on https://arcade.ddev.site, with hot reloading. The index is at `/`, each game at `/<game>/`. Run other commands inside DDEV too, for example `ddev npm run build`.

```bash
ddev start
```

**Without DDEV:** you need [Node.js](https://nodejs.org/) 24 or newer.

```bash
npm ci
npm run dev
```

`node_modules` is shared between your computer and DDEV, and Vite's bundler is different per platform. Stick to one of the two, or run `npm ci` again after switching (DDEV does that by itself on start).

| Command | What it does |
|---|---|
| `npm run dev` | dev server for the index and every game, with hot reloading |
| `npm run build` | build every game and the index into `dist/` |
| `npm run preview` | serve `dist/` |

The `github pages` workflow builds and publishes `dist/` on every push to `main`.

## Project layout

```
index.html              the Arcade index
src/
  games.js              the games on the index: title, description, genres, date added
  main.js               renders the index: search, genre filter, game tiles
  styles/arcade.css     the cyberpunk look
  logo.svg              the graffiti ARCADE logo (letters as paths, no font needed)
  favicon.svg
public/404.html         GitHub Pages' "not found" page; also sends old /Underlord/ links to /underlord/
tools/vite.js           shared Vite setup: every page builds to one self-contained HTML file
vite.config.js          builds the index and copies every game's build into dist/<game>
.ddev/                  DDEV: config.yaml and start-vite.sh, which runs the Vite dev server
pro-skater/             a game: its own npm workspace, see pro-skater/README.md
twistball/              a game: its own npm workspace, see twistball/README.md
underlord/              a game: its own npm workspace, see underlord/README.md
```

## Adding a game

1. Put it in its own folder, for example `my-game/`, with a `package.json` whose `build` script writes one self-contained `my-game/dist/index.html`. Using `singleFilePage()` from `tools/vite.js` in its `vite.config.js` does that.
2. Add the folder to `workspaces` in the root `package.json`.
3. Add a 16:9 `my-game/cover.svg` and an entry in `src/games.js`; the slug is the folder name.

## Development

- **Checks:** GitHub Actions builds every pull request and runs `npm audit`.
- **AI agents:** the project rules for coding agents are in [`AGENTS.md`](AGENTS.md).
