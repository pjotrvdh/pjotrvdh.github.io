---
name: rendering-and-ui
description: Underlord's 3D view (three.js: camera, picking, terrain, rooms, units, clouds), the character viewer and the UI. Read before visual, input or UI changes.
---

## When to use this

- You touch `underlord/src/render/` (`view.js`, `camera.js`, `terrain.js`, `rooms.js`, `specials.js`, `units.js`, `effects.js`, `fog.js`, `overlay.js`, `cursor.js`, `models.js`, `instances.js`, `gallery.js`)
- You touch `underlord/src/game/input.js` or `ui.js` (HUD, panel, tabs, minimap, cheats), `underlord/index.html`, `underlord/src/styles/underlord.css`
- You change `underlord/src/config/assets.js`, a model in `underlord/models` or an SVG
- Keywords: three.js, camera, rotate, zoom, pick, raycast, instanced, model, glb, KayKit, Kenney, animation, clouds, fog, minimap, overlay, label, HUD, tab, Chronicle, character viewer

## Structure

- `render/view.js` exports `view`, the only thing game code uses: `init()` (renderer, lights, model loading), `render(dt, time)` every frame, `pick()`, `pickUnit()`, and camera calls (`centerOn`, `zoomAt`, `zoomBy`, `fit`, `rotate`, `panStart`/`panTo`, `panKeys`, `groundView`).
- `game/index.js` boots: `applyConfig()`, `initUi()`, `initInput()`, `await view.init()` (the New game button shows "Loading N%"), then `newGame()` and the frame loop: `update(dt)` x speed, `keyPan()`, `view.render()`; `ui()` + `drawMini()` every 0.2 s. With `?characters` in the URL it opens the character viewer instead.
- The renderer only reads `G` (it never changes game state). Exceptions it relies on: render hints the game sets for it (`e.hitT` attack, `e.hurtT` hit, `e.digging` hero tunnelling, `e.aim` direction, fx type `death`), all short-lived and not saved; and `fog.js` clears `G.fogDirty`.

## World and camera (`camera.js`)

- 1 world unit = 1 tile. Tile (x, y) spans x..x+1 on X and y..y+1 on Z; floors at Y = 0, solid blocks `TOP` (1) high (`terrain.js`), the clouds at `FOG_Y` (`fog.js`).
- `CameraRig`: a perspective camera (FOV 38) looking at `target` on the ground from pitch `PITCH` (~56 degrees), at distance `dist` (5..70), turned by `yaw`. Yaw 0 looks north, so the view matches the minimap. `rotate(±1)` eases a quarter turn (Q / E, the ⟲ ⟳ buttons).
- `zoomAt()` keeps the ground point under the pointer fixed; `panStart()`/`panTo()` drag the ground point under the pointer; `panKeys()` scrolls in screen directions; `fit()` shows the whole map; `clamp()` keeps the target on the map.
- `groundView()` returns the four ground points at the screen corners: the trapezoid on the minimap.

## Picking

- `view.pick(sx, sy)` walks the view ray from the cloud height down to the floor and returns the first tile whose visible surface it reaches (`surface(i)` in `cursor.js`: clouds over unseen tiles, block tops over seen solid tiles, else the floor): `{ fx, fy, x, y }`. So clicking the top of a block or a cloud picks that tile, not the floor behind it.
- `view.pickUnit(sx, sy, filter)` measures the screen distance to each drawn unit's upright line (feet to head) and takes the nearest within about half its on-screen height.
- `game/input.js` uses `pick()` for tiles (marking, building, casting, dropping) and `pickUnit()` for units (Hand pick-up, slapping, the hover info via `app.hover.unit`).

## Models and instancing

- `models.js`: `loadModels()` loads every file `assets.js` names (`view.js` `modelFiles()`); `parts(file)` gives the meshes of a static model for instancing, `clone(file)` a full copy with its own skeleton (SkeletonUtils), `animations('Rig_Medium')` the shared KayKit clips. A model that fails to load is skipped (logged); its instances or figure are simply missing.
- `instances.js` `Instances`: one `InstancedMesh` per mesh of a model, filled with `begin()`, `add(matrix, tint)`, `end()`; grows as needed. `place(x, y, z, rotY, scale)` builds the matrix. Per-instance tint uses `instanceColor`.

## Terrain (`terrain.js`)

- Rebuilt only when `signature()` changes (tile types, rooms present, marks, seen, chests, reinforced wall damage).
- Unseen tiles draw nothing (the clouds cover them), except dig marks, which float above the clouds and are drawn after them (render order 12, clouds 10), so a marked area stays visible through the shroud.
- Floors: Kenney Cave Kit floor (unclaimed, gate, portal). Claimed ground, the Heart and rooms: a tiled stone floor drawn in code (`tileTexture()`), tinted with the keeper colour (`assets.js` `keeper`), rooms towards their room colour; every claimed tile outside rooms has an inlaid keeper emblem (`emblems`). Lava: a flat animated shader slightly below the floor.
- Solid blocks: a dark cap per tile (colour per type, `CAP_COLORS`) plus a Kenney `template-wall` piece on every side that faces a seen open tile: Cave Kit for earth, gold, gems and rock (rock tinted dark); reinforced walls are brick slabs drawn in code (`brickTexture()`, same footprint as a wall piece, darker as they are damaged), with a keeper-coloured jewel on top (`jewels`). A block in the inner corner of a reinforced wall (`wallCorner()`: diagonal to open ground, reinforced walls on both sides) gets a reinforced top and jewel, although imps never reinforce it. Gold nuggets and gem crystals stick out of gold and gem faces and tops.
- Chests (Mini Dungeon) on tiles with `G.loot`.

## Rooms (`rooms.js`)

- Rebuilt when rooms, the Treasury fill (tenths) or the set of claimed beds change.
- A trim in the room colour along each room's outline. Treasury: coins, more and bigger as it fills. Lair: a straw nest on each claimed bed, with a ball in the owner's colour. Hatchery: straw and chickens (animated every frame). Training Room: wooden posts with shields on a checkerboard, and swords or spears. Library: bookshelves (built in code), tables with chairs and potions, banners.

## Landmarks (`specials.js`)

- Heart: four Dungeon Kit columns, a pedestal and a floating crystal in the keeper colour (`assets.js` `keeper`), after The Dark Crystal: a tall tilted shard with smaller shards (`shardGeometry()`, uneven facets), a glow, a light and a faint shaft of light from above. It pulses, dims as `heartHP` falls and flashes white on `heartFlash`. Portals: a Cave Kit arch with a swirl (bright once owned). Hero Gate: Dungeon Kit bars with a blue light, only once seen. The Call to Arms flag while a rally lasts. Rebuilt when `G` changes (new game, load).

## Units (`units.js`)

- `Figure` per drawn unit: a KayKit model (see `assets.js` `units`: `height`, `width`, `tint`, per-part `tints`, `hide`, `borrow`, `extras`, `right`/`left`) with an `AnimationMixer`, a ring in the side's colour, and a gold nugget above it while it carries gold.
- Drawn: your units always; heroes and wanderers only on seen tiles; units in the hand (up to 4) float at the pointer. Wanderers are see-through; hit units glow red, slapped ones flicker.
- Animation by activity (`activityOf()` + `CLIPS`): walk (speed-matched), attack (`hitT`), dig (imp jobs, hero tunnelling), train, study, eat, sleep, stun, hurt, guard, held, die. Facing follows movement, else the fight target, the dug block or `aim`.
- Deaths: fx `death` spawns a copy that plays its death and fades out.
- Parts: `dress()` hides parts by name, rebinds borrowed KayKit parts to the figure's skeleton (same rig), and adds `extras` on the head bone (`crown`, `horns`). `makeTool()` builds the pickaxe and mattock, `makeWhip()` the Dark Mistress's whip. Optional reshaping, on copies of the geometry (the rest pose, so skinning still fits): `shape: 'hourglass'` (`hourglass()`: narrower waist, wider hips, fuller chest on the "Body" mesh), `headSize` (`resizeHead()`: a smaller head, less chibi), `gloss` (shiny leather on named parts). Part names match a mesh's own name or its parent's (`partName()`).

## Clouds, overlay, cursor, effects

- `fog.js`: one plane at `FOG_Y` with a shader: a `W x H` mask texture (unseen = opaque, linear filtering for soft edges) and drifting fbm clouds. Glints (points) for unseen gold and gems; pulsing white dots for `unknownHeroes()`.
- `overlay.js`: HTML labels in `#labels` over the canvas: per unit a health bar (when hurt), level above 1, "z" when sleeping or guarding, "?" on wanderers; and the floating texts (fx `text`).
- `cursor.js`: the hover outline on the visible surface (light = `toolValid()`, red = not), the drag rectangle and a tint on every tile `affects()` would change.
- `effects.js`: fx `proj` (glowing shot; from the Heart's core for the zap), `dust`, `ring`, `heal`, `bolt` (jagged line, glow and a flash light).

## Character viewer (`gallery.js`)

- Open the game with `?characters`. A tab per unit kind: a tab shows that figure alone; with Compare on, tabs add or remove figures to see side by side; All shows every kind. Each stands on a stone tile, labelled with its model. Buttons play an animation on the figures in view; "Turn" spins them; clicking a figure (not comparing) shows it alone; the info line lists model, height, width, held items and clip for up to three figures; drag orbits, scroll zooms. Uses `Figure`, so it shows exactly what the game draws.

## Panel and HUD (`underlord/index.html`, `game/ui.js`, `ui()` every 0.2 s)

- Header stats: Gold `money / cap`, Imps, Creatures `count / Lair tiles`, Research, Payday `m:ss · due g` (red when due > gold), Heroes `wave N in m:ss` / `final wave`, Heart bar. Buttons: Save, Load, Cheats (hidden), Pause/Resume, speed `1× 2× 3×`.
- Tools (`buildTools()`): Hand / Slap / Look; Rooms tab: each room + Sell; Spells tab: every spell (cost or "research N", disabled while locked).
- Tabs (`showTab()`, remembered in `localStorage['underlord-tab']`): Info (payday and research gauges, portal pool list), Rooms, Spells, Creatures (idle/working/fighting per kind with SVG portraits from `assets.js` `icons`, list by kind and level).
- `#info`: hover details for the unit (`app.hover.unit`) or tile under the pointer, or help for the current tool.
- Chronicle `#log`: `msg(text, key, cls)` prepends, keeps 7; the same `key` is muted for 20 s of game time. Banner for waves; overlay card for intro and end; drag tip `#tip`.
- Minimap (`drawMini()`): one cell per tile (unseen = cloud colour, or dark gold for unseen gold/gem; rooms in their colour), portals, white dots, units, and the camera's view trapezoid. Click or drag it to look there.
- Version label `#version` (`src/main.js`, `__BUILD_VERSION__`).

## Input (`game/input.js`)

- Pointer: the Hand of Evil (`underlord/src/assets/cursors`, set in the CSS on `#cv`): a pointing claw, an open claw over your units with the Hand or Slap tool (class `over-unit`), a fist while the hand holds units (`holding`) or while dragging the map (`grab`). `cursor()` in `input.js` sets the classes.
- Canvas: left = current tool (Hand: pick up / dismiss / drop / mark-drag; room or Sell: drag; spell: cast at the picked point); right-drag or middle-drag pans, right-click without moving slaps; Look tool left-drag pans; two pointers pinch-zoom and pan; wheel zooms at the pointer (x1.15).
- Keys: `Space`/`P` pause, `1`-`3` speed, `+`/`-` zoom, `Q`/`E` turn, arrows/WASD scroll, `Esc` hand tool + cancel drag + close cheats, `` ` `` or Ctrl+C toggles the Cheats panel once unlocked. Keys with Ctrl, Cmd or Alt are left to the browser.
- Buttons ⟲ ⟳ + − Fit on the map.

## Fonts and accessibility

- System fonts only: CSS `--f-display` (Palatino stack) and `--f-body` (Gill Sans / Segoe UI / Trebuchet MS / system-ui). Labels over the map use `--f-body` with a dark text shadow.
- Keep text at WCAG AA: `--muted` `#9a8672` on `--panel` `#16100e` is about 5.4:1.
- ARIA: canvas and minimap `aria-label`; `#labels` is `aria-hidden`; tabs use `role=tablist/tab/tabpanel`; C and mode buttons `aria-pressed`; Cheats `aria-expanded`/`aria-controls`; speed, zoom and turn buttons labelled; Chronicle `role=log aria-live=polite`.

## Cheats

- Typing `iliketocheat` unlocks the Cheats panel (`cheatKey()` in `ui.js`); keys that continue the code from its third letter on are swallowed, so its E's do not turn the view. Not stored: a reload locks it again.
- `cheatList()`: +500 / +5000 gold, Reveal map, Finish research, Restore Heart, Free imp, + Orc / Warlock / Troll / Dark Mistress (at an owned portal, or next to the Heart without one; ignoring pool and limit), Level up all, Next wave now, Defeat heroes.

## Gotchas

- Models are separate files (`underlord/models`, copied to `dist/models` by `singleFilePage({ copy: ['models'] })`): the page must be served over HTTP; opened from disk, the models do not load.
- Kenney models reference an external texture; `tools/import-models.mjs` embeds it. Copy new models through that script, not by hand.
- GLTFLoader drops `.` from node names (`handslot.r` becomes `handslotr`); look bones up with `byName()`.
- KayKit's right hand slot points a weapon straight ahead with its blade up; `attach()` turns right-hand items half a turn around their length so blades face down. Left-hand items (shields, bows, books) are not turned. Pointing weapons straight down makes long ones go through the floor.
- Instanced meshes are not frustum-culled (the whole map is small); terrain and rooms only rebuild on a signature change, so anything they draw must be part of that signature.
- The drag tip counts unseen non-diggable tiles (floor, lava) as "blocks"; only diggable ones get marked.

## See also

- [map](map.md) — what `G.seen` means and what shows through the clouds
- [heroes](heroes.md) — white dots
- [saving](saving.md) — Save / Load buttons
- `underlord/src/assets/README.md` — the model packs, the import script and the SVGs
