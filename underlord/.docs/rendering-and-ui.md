---
name: rendering-and-ui
description: Underlord drawing (caches, fog, minimap, sprites) and UI (tabs, HUD, input, fonts, ARIA, cheats). Read before visual or UI changes.
---

## When to use this

- You touch `draw()`, `drawTile()`, `drawRoom()`, `drawSpecials()`, `drawEnt()`, `drawFog()`, `makeCloud()`, `drawMini()`, `sprite()`/`spr()`, `ui()`, `buildTools()`, `showTab()`, input handlers, cheats
- You change `underlord/index.html`, `underlord/src/styles/underlord.css`, `underlord/src/config/assets.js` or an SVG
- Keywords: canvas, cache, fog, clouds, minimap, sprite, HUD, tab, Chronicle, tooltip, zoom, pan, font, contrast, ARIA, cheat

## Canvas and camera

- `#cv` fills `#stage`; `resize()` (ResizeObserver) sets `SW`/`SH`, `DPR`, `BASE = min(SW/W, SH/H)` (whole map fits at zoom 1) and rebuilds the cloud texture.
- `TS = BASE * Z` px per tile; `Z` 1..4, starts at 1.7. `cam` is the screen offset of the map; `clampCam()` centres the map when it is smaller than the view.
- `setWorld()` sets the world transform. Drawing helpers (`rr`, `circ`, `spr`) draw on the global `ctx`, which is pointed at an offscreen canvas while caches render.

## draw() order

1. Background; terrain cache (below); lava (animated) and Hatchery chickens every frame on seen tiles.
2. `drawSpecials()`: Heart (sprite + pulsing glow, white flash when hit), portals (glow + rotating sprite: owned 1.4 rad/s, unclaimed 0.4), Hero Gate (only when seen).
3. Entities sorted by `y`: own always; heroes and neutrals only on seen tiles. Held units are skipped.
4. Effects `G.fx` (`proj`, `dust`, `ring`, `text`, `bolt`, `heal`), aged in `update()`.
5. `drawFog()`; then white dots for `unknownHeroes()` ([heroes](heroes.md)); the Call to Arms flag.
6. Drag rectangle with per-tile highlight (`affects()`), or the hover outline (`toolValid()`: light = valid, red = invalid); held units at the cursor.

## Terrain cache

- `terr` holds the static tiles of the visible area. `terrKey` = hash `sig` of type, room, mark, seen, chest flag and damaged-wall flag for the visible tiles (+1 margin), plus camera, `TS`, canvas width, treasury fill (tenths), loaded image count and the bed map. Any change redraws the cache with `now = 0`.
- `drawTile()`: sprite from `TILE_SPR` (`GATE`/`PORTAL` use floor, `HEART` uses claimed; lava always procedural); earth, rock, floor, gold, gem mirrored by `hash(x,y,77)`. Procedural fallback per type when the sprite is missing. Then wall/floor edge shadows, chest, dig mark, room overlay.
- `drawRoom()`: tint + prop per room: Treasury pile scaled by fill; Lair nest only on owned beds plus a dot in the owner's colour (`beds` map, rebuilt each frame); Hatchery straw (chickens drawn live); Training dummy on a checkerboard; Library shelf on every tile; coloured border on every side where the neighbour is not the same room (another room or plain ground).

## Fog of war

- `rebuildFog()` -> `fogC` (W x H alpha mask, unseen = opaque) when `G.fogDirty`.
- `drawFog()` into `layer`: mask scaled up with smoothing (soft edges), `source-in` with the tiled `cloud` texture drifting sideways, then `drawShroudTile()` for unseen tiles in view (gold and gem glints at 70% alpha, dig marks). Redrawn when its key changes or every 0.1 s.
- `makeCloud()` paints random radial blobs once per resize.

## Sprites (`underlord/src/config/assets.js`)

- Groups `units`, `tiles`, `props` -> `ASSETS['group.key']` (e.g. `units.orc`, `props.lair-nest`). `loadAssets()` loads each as an `Image`; `IMG` fills as they load.
- `sprite(k, w, h)` rasterises an SVG once per pixel size into the `SPR` cache (cleared above 800 entries or when an image loads). `spr()` returns `false` when the image is missing, and every caller then draws its procedural fallback.
- Units: drawn at `r * 2.9` (`r` = 0.24 tile for imps, 0.44 for `big`, else 0.32), mirrored when `face < 0`, ground ring coloured by side, neutrals at 65% alpha with "?", slap flicker, health bar when hurt, level number above 1, "z" when sleeping or guarding.
- SVG rules (viewBox, facing, style): `underlord/src/assets/README.md`. Plain SVG only; browsers block external content when drawing SVGs to canvas.

## Minimap (`drawMini()`, every 0.2 s)

- One cell per tile: unseen = cloud colour, or dark gold for unseen gold/gem; rooms in their room colour; otherwise per tile type.
- Portals always drawn (pink owned, violet unclaimed); white dots for unseen invading heroes; units (own always, others only on seen tiles); the view rectangle.
- Click or drag on `#mini` centres the view there. The C button sits on top ([computer-assistant](computer-assistant.md)).

## Panel and HUD (`underlord/index.html`, `ui()` every 0.2 s)

- Header stats: Gold `money / cap`, Imps, Creatures `count / Lair tiles`, Research, Payday `m:ss · due g` (red when due > gold), Heroes `wave N in m:ss` / `final wave`, Heart bar.
- Header buttons: Save, Load, Cheats (hidden), Pause/Resume, speed `1× 2× 3×`.
- Tools (`buildTools()`): Hand / Slap / Look; Rooms tab: each room (`cost gold per tile`, colour swatch) + Sell; Spells tab: every spell (cost or "research N", disabled while locked). `setTool()` highlights with `.on`.
- Tabs (`showTab()`, remembered in `localStorage['underlord-tab']`): Info (payday and research gauges, portal pool list), Rooms, Spells, Creatures (grid of idle/working/fighting per kind via `activity()`, list of creatures by kind and level).
- `#info`: hover details for the tile or unit (`TILE_EN`, `STATE_EN`), or help for the current tool.
- Chronicle `#log`: `msg(text, key, cls)` prepends, keeps 7, `good`/`bad` classes; the same `key` is muted for 20 s of game time.
- Banner for waves; overlay card for intro and end. Drag tooltip `#tip` ("Dig N blocks", "Room × N · cost").
- Version label `#version` below the Chronicle: `underlord/src/main.js` fills `hash · time` from `__BUILD_VERSION__` (`buildVersion()` in `tools/vite.js`, commit time in Europe/Amsterdam); hidden when it is `null` (no git).

## Input

- Canvas pointer: left = current tool (Hand: pick up / drop / mark-drag; room or Sell: drag; spell: cast); right-drag or middle-drag pans, right-click without moving slaps; Look tool left-drag pans; two pointers pinch-zoom and pan. Wheel zooms at the cursor (x1.15).
- Keys: `Space`/`P` pause (Space and Enter are left to a focused button), `1`-`3` speed, `+`/`-` zoom, arrows/WASD pan (700 px/s), `Esc` hand tool + cancel drag + close cheats, `` ` `` or Ctrl+C (with no text selected) toggles the Cheats panel once it is unlocked. Other keys with Ctrl, Cmd or Alt are left to the browser (copy, print, ...).
- Zoom buttons +, −, Fit (zoom 1).
- Speed runs `update()` 1-3 times per frame; pause stops `update()` but drawing continues.

## Fonts and accessibility

- System fonts only, nothing embedded: CSS `--f-display` (Palatino stack, headings) and `--f-body` (Gill Sans / Segoe UI / Trebuchet MS / system-ui); canvas text uses the Gill Sans stack. The logo is `underlord/src/assets/brand/logo.svg`.
- Keep text at WCAG AA: `--muted` `#9a8672` on `--panel` `#16100e` is about 5.4:1; check new colours against the dark panels.
- ARIA: canvas and minimap `aria-label`; tabs use `role=tablist/tab/tabpanel` + `aria-selected`; C and mode buttons `aria-pressed`; Cheats `aria-expanded`/`aria-controls`; speed button `aria-label`; Chronicle `role=log aria-live=polite`; banner `aria-hidden`; zoom and creature-count buttons labelled. Focus ring: gold outline on `:focus-visible`.
- `prefers-reduced-motion` removes CSS transitions; under 820 px the panel moves below the map.

## Cheats

- Typing `iliketocheat` (any single-character keys, case-insensitive, rolling buffer) sets `cheatsOn`, shows `#bCheat` and opens `#cheats`. Not stored: a reload locks it again.
- `CHEATS`: +500 / +5000 gold, Reveal map, Finish research, Restore Heart, Free imp, + Orc / Warlock / Troll / Dark Mistress (at an owned portal, or next to the Heart without one; ignoring pool and limit), Level up all, Next wave now, Defeat heroes. Buttons work only while running and not over.

## Gotchas

- The terrain cache draws with `now = 0`: fallback gold sparkle and gem pulse do not animate.
- The damaged-wall crack is only in the procedural wall fallback; with `tiles/wall.svg` damaged walls look intact.
- The drag tip counts unseen non-diggable tiles (floor, lava) as "blocks"; only diggable ones get marked.
- `affects()` has a duplicate, unreachable `unmark` branch.

## See also

- [map](map.md) — what `G.seen` means and what shows through the clouds
- [heroes](heroes.md) — white dots
- [saving](saving.md) — Save / Load buttons
- `underlord/src/assets/README.md` — SVG conventions
