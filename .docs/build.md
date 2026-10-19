---
name: build
description: The shared Vite setup that builds every page to one self-contained HTML file. Read before editing tools/vite.js, a vite.config.js or the Pages workflow.
---

## When to use this

- Editing `tools/vite.js`, the root `vite.config.js` or a game's `vite.config.js`.
- A build fails with "would be a separate file; it should be inlined".
- Adding an asset type (image, font, sound) to a page.
- Editing `.github/workflows/pages.yml` or `build.yml`.

## How a build works

- `npm run build` (root) runs `npm run build --workspaces` (every game builds `<slug>/dist/index.html`), then `vite build` for the index, whose `collectGames()` plugin copies each `<slug>/dist` to `dist/<slug>`.
- `singleFilePage()` in `tools/vite.js` is the shared config: `base: './'`, `assetsInlineLimit: () => true`, no CSS code splitting, no modulepreload polyfill, the `singleFile()` plugin, the DDEV dev server settings and `__BUILD_VERSION__`.
- `singleFile()` writes the bundled JS and CSS into the HTML and turns files the page links to (such as the favicon) into data URIs. Any other emitted file fails the build on purpose.
- `__BUILD_VERSION__` is `{ hash, time }` of the current commit (`git log -1`, time in Europe/Amsterdam), or `null` without git; pages show it as a small version label.
- The `github pages` workflow runs `npm ci && npm run build` on every push to `main` and publishes `dist/`. `build.yml` builds every pull request; `security.yml` runs `npm audit`.

## Size

- Pages are inlined, so every dependency and asset lands in the HTML. Prefer system fonts (no font files) and SVG, and check `dist/index.html` sizes in the build output after adding a dependency.

## Gotchas

- `fs.cpSync` fails on folders in the DDEV container's mounted file system; `collectGames()` copies file by file for that reason.
- A page's script and favicon paths must be relative (`./src/main.js`), or the dev server cannot serve the game under `/<slug>/`.

## See also

- [arcade.md](arcade.md) — repository layout and adding a game.
- [ddev.md](ddev.md) — where builds and the dev server run.
