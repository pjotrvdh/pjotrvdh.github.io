---
name: rules
description: Twistball's rules: modes, lives, levels, auto-serve countdown, scoring and how games end. Read before changing gameplay or the game flow.
---

## When to use this

- Changing lives, levels, serving, scoring or what happens when a side runs out of lives.
- Editing `startGame()`, `startLevel()`, `startMatch()`, `toServe()`, `missed()`, `levelCleared()`, `endSolo()`, `endMatch()` in `twistball/src/game/game.js` (shared state in `context.js`).
- Editing `twistball/src/config/rules.js`, `scoring.js` or `levels.js`.

## Modes (`state.kind`)

- **`solo`**: you (near) against the CPU (far). Ten levels from `levels.js`; the start level and the kind of computer (or Auto) are picked on the title screen (remembered as `twistball.option.startLevel` and `twistball.option.cpu`). You have `playerLives` (5) for the whole game; the CPU has `opponentLives` (3) per level.
- **`online`**: two people, see [online.md](online.md). Both have `matchLives` (5); the speed (a level from `levels.js`) is the host's choice on the title screen. Both score; see Scoring.
- **`demo`**: CPU vs CPU at the chosen speed, two different random kinds of computer every match (see [computer-players.md](computer-players.md)), `matchLives` each; after a match the next one starts by itself after `demoRestartDelay` (3 s). Esc goes back to the menu; on a touch screen a tap on the tunnel does.

## Flow

- `state.mode`: `title` → `serve` → `play` → (`wait` after a point) → `serve` … → `levelClear` / `over`. Online also uses `lobby` (ready check).
- **Serving:** every point starts with `toServe(server)`: the ball sits on the server's paddle, a 3-2-1 countdown runs (`serveCountdown`, 3 s, shown by `showServeCountdown()`), then the ball serves itself via `launch(server, false)`. Nobody clicks to serve. The server's paddle movement at that moment still puts spin on the serve.
- **Who serves:** solo — always you. Online and demo — the first serve is random, then whoever lost the point serves.
- **A miss** (`missed(side)`): the paddle that missed breaks apart (`explodePaddle()`, see [rendering.md](rendering.md)) and loses a life; after 0.8 s (`pauseThen`) the next serve starts, and `toServe()` makes the paddle whole again (`renderer.restore()`).
- **Out of lives:** after the last break, the level or match ends `explosionTime` (1.6 s) later.
  - Solo, CPU out of lives → `levelCleared()`: the level bonus is added, then the "Level cleared" screen; after level 10 → `endSolo(true)`.
  - Solo, you out of lives → `endSolo(false)`: game over, high score entry when the score qualifies.
  - Online and demo → `endMatch(matchWinner(side))`: the **higher score wins**, so a side that ran out of lives can still win on trick shots (a tie goes to the side with lives left). Online shows "You win!" / "Your opponent wins" with both scores (and a note when the side out of lives won) and a Rematch button (rematch needs both players ready again); demo calls the winner and the score.
- **Pause (solo, demo):** P or Esc, or the window losing focus (solo). Resume runs a 3-2-1 countdown (`startCountdown()`); the ball is hidden while paused and during that countdown. Online pauses are covered in [online.md](online.md).

## Levels (`levels.js`)

- Each level sets `ballSpeed` (depth units per second), `opponentSpeed` and `opponentAim` (how well the CPU tracks the ball), `opponentSpin` (spin on CPU returns) and `curve` (multiplier on the spin you put on the ball).
- The ball also speeds up by `rallySpeedUp` (×1.02) with every return in a rally; it resets at each serve.

## Scoring (`scoring.js`, `scoreReturn()`)

- Solo: only your returns score (`state.score`). In a match (online, CPU vs CPU) both sides score (`near.score`, `far.score`), the same way, and taking one of the other side's lives adds `matchPoint` (300).
- `hit` (100) for every ball returned.
- On top: `curveBonus` (50) when the spin is ≥ `curveThreshold` (1.2), or `superCurveBonus` (150) when ≥ `superCurveThreshold` (2.6); and `accuracyBonus` (100) when the ball hits within `accuracyZone` (25 %) of your paddle's centre ("Bullseye!").
- Bonus calls (`callBonus()`): your own as "Super curve! +200"; the other side's in its colour with its name ("Opponent: Bullseye! +200"). None in CPU vs CPU, where the computer scores a bonus on nearly every return.
- The level bonus (solo) starts at `levelBonus` (3000) and drops `levelBonusPerSecond` (40) while the ball is in play; it is added when you clear the level.
- High scores (`highscores.js`): top `highScores` (10) entries in `twistball.highscore.<place>.*`, each with name, score, level reached and `from` (start level; shown as "level 7 (from 3)").

## Screen on

- While a game runs (`keepAwake()`, every frame) the page holds a Screen Wake Lock, so a phone does not dim or lock while you only drag the paddle. It is released on the title and online menus, the end screen of a solo game and during a solo pause (it comes back with the resume countdown); CPU vs CPU keeps it, also between matches. The browser drops the lock when the page is hidden; it is asked again when the page is back. Where the browser has no Wake Lock API or refuses it, the screen dims as usual (a refusal is retried after 5 s).

## Gotchas

- The HUD shows Score in every mode (in a match labelled with the near side's name) and the far side's score only in a match (`.match-only`); Level bonus only in solo (`.solo-only`).
- `missed()` handles events, sounds and the explosion for all modes; the online branch also emits events for the guest. Keep those in step when you change it.

## See also

- [physics.md](physics.md) — how hits, spin and misses are decided.
- [online.md](online.md) — the online-only parts of the flow.
