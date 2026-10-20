---
name: rules
description: Twistball's rules: modes, lives, levels, auto-serve countdown, scoring and how games end. Read before changing gameplay or the game flow.
---

## When to use this

- Changing lives, levels, serving, scoring or what happens when a side runs out of lives.
- Editing `startGame()`, `startLevel()`, `startMatch()`, `toServe()`, `missed()`, `levelCleared()`, `endSolo()`, `endMatch()` in `twistball/src/game/game.js`.
- Editing `twistball/src/config/rules.js`, `scoring.js` or `levels.js`.

## Modes (`state.kind`)

- **`solo`**: you (near) against the CPU (far). Ten levels from `levels.js`; the start level is picked on the title screen (remembered as `twistball-start-level`). You have `playerLives` (5) for the whole game; the CPU has `opponentLives` (3) per level.
- **`online`**: two people, see [online.md](online.md). Both have `matchLives` (5); the speed (a level from `levels.js`) is the host's choice on the title screen. No scores.
- **`demo`**: CPU vs CPU at the chosen speed, `matchLives` each; after a match the next one starts by itself after `demoRestartDelay` (3 s). Esc goes back to the menu; on a touch screen a tap on the tunnel does.

## Flow

- `state.mode`: `title` → `serve` → `play` → (`wait` after a point) → `serve` … → `levelClear` / `over`. Online also uses `lobby` (ready check).
- **Serving:** every point starts with `toServe(server)`: the ball sits on the server's paddle, a 3-2-1 countdown runs (`serveCountdown`, 3 s, shown by `showServeCountdown()`), then the ball serves itself via `launch(server, false)`. Nobody clicks to serve. The server's paddle movement at that moment still puts spin on the serve.
- **Who serves:** solo — always you. Online and demo — the first serve is random, then whoever lost the point serves.
- **A miss** (`missed(side)`): the paddle that missed breaks apart (`explodePaddle()`, see [rendering.md](rendering.md)) and loses a life; after 0.8 s (`pauseThen`) the next serve starts, and `toServe()` makes the paddle whole again (`renderer.restore()`).
- **Out of lives:** after the last break, the level or match ends `explosionTime` (1.6 s) later.
  - Solo, CPU out of lives → `levelCleared()`: the level bonus is added, then the "Level cleared" screen; after level 10 → `endSolo(true)`.
  - Solo, you out of lives → `endSolo(false)`: game over, high score entry when the score qualifies.
  - Online → `endMatch(winner)` → "You win!" / "Your opponent wins" with a Rematch button (rematch needs both players ready again).
- **Pause (solo, demo):** P or Esc, or the window losing focus (solo). Resume runs a 3-2-1 countdown (`startCountdown()`); the ball is hidden while paused and during that countdown. Online pauses are covered in [online.md](online.md).

## Levels (`levels.js`)

- Each level sets `ballSpeed` (depth units per second), `opponentSpeed` and `opponentAim` (how well the CPU tracks the ball), `opponentSpin` (spin on CPU returns) and `curve` (multiplier on the spin you put on the ball).
- The ball also speeds up by `rallySpeedUp` (×1.02) with every return in a rally; it resets at each serve.

## Scoring (solo only, `scoring.js`, `scoreReturn()`)

- `hit` (100) for every ball you return.
- On top: `curveBonus` (50) when the spin is ≥ `curveThreshold` (1.2), or `superCurveBonus` (150) when ≥ `superCurveThreshold` (2.6); and `accuracyBonus` (100) when the ball hits within `accuracyZone` (25 %) of your paddle's centre ("Bullseye!").
- The level bonus starts at `levelBonus` (3000) and drops `levelBonusPerSecond` (40) while the ball is in play; it is added when you clear the level.
- High scores (`highscores.js`): top `highScores` (10) entries in `twistball-highscores`, each with name, score, level reached and `from` (start level; shown as "level 7 (from 3)").

## Gotchas

- Scoring only exists in solo; the HUD hides Score and Level bonus elsewhere (`.solo-only`).
- `missed()` handles events, sounds and the explosion for all modes; the online branch also emits events for the guest. Keep those in step when you change it.

## See also

- [physics.md](physics.md) — how hits, spin and misses are decided.
- [online.md](online.md) — the online-only parts of the flow.
