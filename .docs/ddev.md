---
name: ddev
description: DDEV for the Arcade: the Vite dev server in the web container and the shared node_modules. Read when running npm or the dev server via DDEV.
---

## When to use this

- Running `ddev start`, `ddev npm …` or the dev server.
- Editing `.ddev/config.yaml` or `.ddev/start-vite.sh`.
- A build or dev server fails with a missing native binding (rolldown).

## Setup

- Project `arcade`, type `generic`, `webserver_type: generic`, no database, default `ddev.site` TLD.
- `ddev start` runs `.ddev/start-vite.sh` as a `web_extra_daemons` entry: it runs `npm ci` first when `node_modules` is missing or built for another platform, then `npm run dev`.
- The router exposes Vite (port 5173) on `https://arcade.ddev.site`: the index at `/`, each game at `/<slug>/`, with hot reloading over wss (see `singleFilePage()` in `tools/vite.js`).
- Run npm commands in the container: `ddev npm run build`, `ddev npm install`, `ddev npm run build -w twistball`.

## Gotchas

- `node_modules` is shared between the host and the container, and Vite's bundler (rolldown) ships per-platform binaries. After DDEV installs packages, `npm` on macOS fails until you run `npm ci` on the host again (and the other way round). Stick to `ddev npm` when DDEV is in use.
- The container can't write outside the project mount: point temporary build output inside the repository and delete it afterwards.
- `.ddev/traefik/` holds generated certificates and keys; it is git-ignored and must stay that way.

## See also

- [build.md](build.md) — what `npm run build` does.
