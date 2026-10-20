---
name: online
description: Twistball online play over PeerJS: host/guest roles, message protocol, ready check, auto-pause with countdown, heartbeat. Read before touching net.js or online code.
---

## When to use this

- Editing `twistball/src/game/net.js`, or `sessionHandlers()`, `sendState()`, `applyState()`, `openReady()`, `readyUp()`, `pauseOnline()`, `startCountdown()` in `twistball/src/game/game.js`.
- Online games disconnect, freeze, or show different states on both sides.

## Rooms (`net.js`)

- PeerJS (WebRTC). The free PeerJS cloud server introduces the players; then messages go peer to peer. PeerJS's default ICE config includes STUN and TURN.
- The host creates a peer with ID `twistball-arcade-<CODE>`; the guest connects to it with `serialization: 'json', reliable: true`. One guest per room; extra connections are closed.
- Codes are 5 characters from an alphabet without look-alikes (no 0/O, 1/I). A link `?room=CODE` joins at once.
- Under the room link (with **Copy link** next to it) the host gets share options (`fillShare()`): the link prefilled for WhatsApp (`wa.me`), Telegram (`t.me/share`), Messages (`sms:`), E-mail (`mailto:`), **More…** for the device's own share menu where the browser has the Web Share API, and a QR code of the link (`drawQr()`, an SVG drawn with `qrcode-generator`) for a friend next to you to scan.
- `net.js` only moves messages; every game rule lives in `game.js`.

## Who runs what

- **The host is authoritative.** It plays the near paddle and runs the whole simulation; the guest's paddle is the host's far paddle, driven by the guest's `input` messages through `moveHuman()`.
- **The guest only renders.** It moves its own paddle from local input (drawn straight away, so it never lags) and draws everything else from the host's `state`, mirrored: host near ↔ guest far, x flipped, z → `depth − z`. Both players see their own paddle at the front.

## Messages

| Type | Direction | Content |
|---|---|---|
| `start` | host → guest | a match starts; `level` (speed) |
| `state` | host → guest, every frame in a match | `mode`, `server`, `serveIn` (serve countdown), `ball` (or null), `near`/`far` as `[x, y, lives]`, `level`, `events` |
| `input` | guest → host, every frame | the guest's paddle target `x, y` (guest's own view) |
| `ready` | both ways | "I'm ready" (start, rematch, or resume after a pause) |
| `pause` | both ways | "I left the page": pause for both |
| `countdown` | host → guest | both are ready again: run the 3-2-1 resume countdown |
| `ping` | both ways, every second | heartbeat |

- `events` carry what happened during the frame (`wall`, `hit`, `point`, `explode`, `start`, `end`, each with a `side` from the host's view); `playEvent()` plays them (sounds, sparks, calls, explosions) on the guest, mirrored.

## Ready check

- After connecting, and before every rematch, both see "Ready?" (`openReady()`); each click sends `ready`. When both flags are set (`updateReady()`), the host calls `startGame('online')` and sends `start`.
- `openReady()` only resets this player's own flag: the other may already be ready.

## Leaving the page

- `visibilitychange` (hidden) or window `blur` during a match calls `pauseOnline(true)`: both sides pause (`pause` message), the ball is hidden, and both see who left.
- Both click "I'm back, ready" (`ready`); then the host sends `countdown` and both run `startCountdown()` (3-2-1). At the end the host unpauses and the game goes on.
- Leaving again during the countdown cancels it and asks for ready again.

## Heartbeat and disconnects

- Every side sends `ping` each second from a `setInterval` (timers keep running in background tabs, animation frames don't).
- No message for `onlineTimeout` (4 s) ends the match with "The other player left." `pagehide` closes the connection so the other side hears about it at once.

## Gotchas

- An online match can't be paused with P or Esc; only leaving the page pauses it.
- Browsers throttle timers in long-hidden tabs; after several minutes away the heartbeat can stop and the match ends by timeout.
- Everything depends on the free PeerJS cloud server for matchmaking; `net.js` is the only file to change to switch to another transport.

## See also

- [rules.md](rules.md) — the match rules both sides follow.
- [physics.md](physics.md) — the simulation the host runs.
