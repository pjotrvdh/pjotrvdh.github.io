---
name: audio
description: Twistball's sound effects: laser "pews" made with the Web Audio API, and when each plays. Read before touching audio.js or adding a sound.
---

## When to use this

- Editing `twistball/src/game/audio.js`.
- Adding a sound, or a sound plays at the wrong moment.

## How sounds are made

- No sound files: every sound is built on the fly with the Web Audio API, so the page stays small.
- `zap(from, to, duration, options)`: a laser "pew". Two slightly detuned oscillators fall from `from` to `to` Hz in `sweep` seconds (exponentially, fastest at the start), through a low-pass filter that closes with the sweep; loud until the sweep is done, then a long fading tail. Options: `sweep`, `type`, `volume`, `delay`, `detune`, `wobble`.
- `blast(duration, volume)`: white noise through a closing low-pass filter, for explosions.
- The audio context starts on the first click or key press (`sounds.unlock()`), as browsers require. M or the Sound button mutes (`setMuted()`).

## Sounds (`sounds`)

| Sound | When |
|---|---|
| `playerHit` / `opponentHit` | the near / far paddle hits the ball |
| `wall` | the ball bounces off a wall |
| `bonus` | a curve, super curve or bullseye bonus (solo) |
| `point` | the far side misses (you scored), on top of its explosion |
| `tick(last)` | each number of a countdown; `last` = the resume moment |
| `explosion` | a paddle breaks apart: on every miss |
| `levelClear` / `gameOver` | a level cleared or a match won / the game or match lost |

## Gotchas

- Many pews overlap in a fast rally; keep volumes low (≈ 0.05) so they don't clip.

## See also

- [rules.md](rules.md) — the moments these sounds belong to.
