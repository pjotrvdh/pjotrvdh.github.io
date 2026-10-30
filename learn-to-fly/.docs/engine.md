---
name: engine
description: How Learn to Fly exports the SWF and plays it: library.json, timelines, depths, scripts, drawing. Read before editing src/render or the import tool.
---

## When to use this

- Changing `learn-to-fly/tools/import-swf.mjs` or anything in `learn-to-fly/src/render/`.
- A clip shows the wrong frame, a child is missing, a frame script does not run, or something draws wrong.

## The export (`tools/import-swf.mjs`)

- Reads `downloads/learn-to-fly.swf` (SWF 9, AS2, 640 × 480, 33 fps), leaves out some characters (`LEFT_OUT`: loader, intro, the MaxGames sponsor, the version number, the menu's credit and the penguin drawn on the ramp pictures, see also `PICTURE_PENGUINS`; their placements are dropped too) and then every character nothing uses any more, and writes `src/assets/library.json` and `sounds/`. No bitmaps are exported: the rocket flames (shapes 73 and 76) are redrawn as vector shapes (`REDRAWN`), and bitmap fills elsewhere (only in clips hidden behind HTML) are dropped (`dropBitmapFills()`). Rerun it instead of editing the output.
- `chars[id]`, by `t`:
  - `shape`: `b` bounds, `fills`, `lines`, `paths` = `['f' | 'l', styleIndex, svgPathData]` in drawing order (per style group: fills, then lines). Fill edges are chained into closed loops per fill style (fill1 as is, fill0 reversed).
  - `morph`: like a shape, but each path is `{cmd, a, b}` (commands, start and end coordinates, all quadratic), interpolated at the placement's `ratio`.
  - `font` (DefineFont3, em = 1024), `text` (static, glyph indices), `edit` (dynamic text field: `variable`, font, size, align, …).
  - `button`: `records` with `states` (1 up, 2 over, 4 down, 8 hit); `sprite`: `frames` (+ `stream`); `sound`.
- Frame `ops`: `['place', {depth, c, m, cx, ratio, name, clip, filters, blend, events, move}]`, `['remove', depth]`, `['sound', id, info]`. Frame `actions` are DoActions that only stop/play/goto; any other DoAction sets `script: true`.
- Matrices are `[a, b, c, d, tx, ty]` in px; colour transforms `[rMul, gMul, bMul, aMul, rAdd, gAdd, bAdd, aAdd]`.
- `exports`: linkage names (`'BGM'`, `'shop.wav'`, `'beat'`, …) for `attachMovie()` and `attachSound()`.

## The player (`src/render/player.js`, `display.js`)

- One `tick()` per 1/33 s (`src/game/index.js` runs up to 4 to catch up): queued scripts, input events, timelines advance (parents first; clips placed this frame stay on frame 1), frame scripts, `enterFrame` handlers, scripts again.
- Timelines: forward = apply each frame's ops; backward = `rebuild()` from frame 1, keeping children placed by the same PlaceObject (same char, same `placedAt`). A child whose transform a script set (`scripted`) is no longer moved by the timeline, as in Flash.
- Depths: timeline children use Flash depth − 16384 (negative), script children (`attachMovie`, `duplicate`) the depth asked for.
- Scripts come from `src/game/scripts.js`: `frames[spriteId | 'root'][frame](clip)`, `clips['<parentSpriteId | root>:<flashDepth>']` (onClipEvent: `load`, `enterFrame`, `keyDown`, …), `buttons[buttonId](button, timeline)` (release). In dev, a missing frame script logs a warning.
- AS2 handlers on a clip: `onEnterFrame`, `onMouseDown`, `onMouseUp`, `onMouseMove` (all clips get mouse events, not just the one under the mouse). `player.keyListeners` is `Key.addListener`.
- Text fields bound to a variable (`_root.casha`) read `clip.vars` along the path; scripts write `root.vars`.
- `player.onRootFrame` runs when the root changes frame, before that frame's script: the game clears the root's handlers there.
- Streams: a sprite's stream sound starts when it plays its first stream frame and stops when the clip stops or goes.

## Drawing (`draw.js`, `text.js`)

- Layout (`layout()` in `src/game/index.js`, `Renderer.render()`): the canvas fills the window.
  - `world` (the flight, root frame 11): the stage is scaled to the window's height (width on a tall screen) and the world around it is drawn too; extra width goes to the right, ahead of the penguin. The sky clip (520, 640 × 480) is stretched over the window (`stretch`).
  - `scene` (every other scene): the stage as large as fits, centred; backgrounds (shapes covering ≥ 95 % of the stage) are scaled up around its centre until they cover the window (`fillMatrix()`), so the scene goes edge to edge while its buttons and texts stay whole.
  - `coverRects`: clips whose picture area (a stage rect) is scaled evenly to cover the window's width and the height below `top` (the ramp menu's picture, 457, its top just below the window's top edge).
  - `extend`: shapes whose land (or sky) goes on to the window's left (or top) edge: a clean slice of the shape is stretched from the edge to where the land starts, after the shape and over its first `overlap` units, so the shape's edge line doesn't show (`drawExtension()`). Used in the ramp menu: the ice under the penguin (431, 436, 440, 443, 446) to the left, the sky (423) up. The slices are in `index.js`. `extendEdges()` first fills the window around the stage with the scene's edge rows and columns, for what the backgrounds leave open. Layers (filters) as big as the stage are drawn over the whole canvas so their backgrounds can fill too.
  - `overlays` (fades 108, 109, 119) cover the whole window, on `fxCanvas` (above the HTML screens); `skip` (options menu 148, HUD 644, score board 579) are not drawn: HTML replaces them.
- Smooth motion: the game ticks at 33 fps; `Player.snapshot()` keeps each object's previous matrix (`prevM`) and drawing, at the display's refresh rate, interpolates towards the current one (`alpha`). Jumps of more than 120 px or big rotations are not interpolated.

- Colour transforms are applied to the fill colours.
- Gradient fills draw the path mapped into the gradient's own space (cached per shape).
- Masks (`clipDepth`) become a canvas clip; filters (glow, drop shadow) and blend modes draw the object into an offscreen layer and composite it with a canvas shadow / composite operation. Blur, bevel and colour-matrix filters are skipped.
- Device-font text uses system font stacks; Comic Sans MS (the day number) is replaced by Arial Rounded (AGENTS.md rule).

## Gotchas

- The pane's `requestAnimationFrame` stops while the browser pane is hidden: in tests, call `learnToFly.player.tick()` yourself (`window.learnToFly` exists in dev).
- `hitTest(x, y, true)` uses `isPointInPath` on the fill paths; the ramp code calls it hundreds of times a frame, so keep it cheap.
- A placement with `move` and a new `c` replaces the character but keeps the instance's transform, name and `placedAt`.

## See also

- [game.md](game.md) — what the scripts do with all this.
