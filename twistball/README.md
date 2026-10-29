# Twistball

Pong, but with a twist: down a neon tunnel. Your see-through paddle is at the front, the opponent guards the far end. Move your paddle as you hit the ball to put spin on it: the ball curves on its way down the tunnel. Play it at [pjotrvdh.github.io/twistball](https://pjotrvdh.github.io/twistball/). It is one of the games in the [Arcade](../README.md).

## How to play

- **Move** with the mouse, by dragging anywhere on a touch screen, or with the arrow keys or WASD. **Serve** with a click, a tap or Space.
- **Curve the ball** by moving your paddle as you hit it: the faster you move, the more it bends.
- **Modes:**
  - **1 player:** against the computer through ten levels, each faster and sharper. Pick the level to start on and the kind of computer: Calm, Aggressive, Trickster, Wall, or Auto for a random one every level. You have 5 lives; take the opponent's 3 to clear a level.
  - **Play online:** make a room and share the code or link (copy it, send it with WhatsApp, Telegram, Messages, e-mail or the phone's share menu, or let them scan a QR code), or join someone's room. Both players score; when one runs out of lives, the higher score wins. Over WebRTC with [PeerJS](https://peerjs.com/): the host runs the game, the guest sends its paddle and sees the tunnel mirrored, so both have their own paddle at the front.
  - **CPU vs CPU:** watch two random kinds of computer play each other.
- **Scoring (1 player):** 100 per return, a curve bonus (50) or super curve bonus (150), a bullseye bonus (100) for hitting the ball in the centre of your paddle, and a level bonus that counts down from 3000.
- **Colours:** five palettes (Neon, Sunset, Glacier, Toxic, High contrast). High scores, the palette and the start level are kept in your browser.
- P or Esc pauses (not online), M mutes. All sounds are laser "pews" made with the Web Audio API: no sound files.

## Development

From the repository root: `npm run dev -w twistball` for this game alone, `npm run build -w twistball` to build `twistball/dist/index.html`. See the [root README](../README.md) for the rest.

## Project layout

```
index.html              the game page
cover.svg               the game's tile on the Arcade index (16:9)
vite.config.js          builds one self-contained HTML file (see ../tools/vite.js)
src/
  main.js               entry point: styles, game and the version label
  game/game.js          the rules (serving, hits, points, levels) and the frame loop
  game/context.js       what every part shares: config, renderer, paddles, game state
  game/physics.js       paddles (also the computer players) and the ball
  game/online.js        online play: rooms, ready check, sync, pause
  game/screens.js       the HUD, calls, screens and countdowns
  game/input.js         pointer, drag and keys
  game/share.js         sharing a room: links and QR code
  game/palette-menu.js  the palette choice
  game/wake.js          keeps the screen on during a game
  game/render.js        draws the tunnel, paddles and ball (three.js)
  game/net.js           online rooms over PeerJS
  game/audio.js         the laser sounds
  game/highscores.js    the local high score list
  styles/game.css       the page and HUD
  config/               the game data, one file per part
    tunnel.js           sizes of the tunnel, paddles and ball
    rules.js            lives, spin, rally speed-up, online and CPU timings
    scoring.js          points and bonuses
    levels.js           the ten levels: ball speed, opponent speed and aim, spin, curve
    cpus.js             the kinds of computer: Calm, Aggressive, Trickster, Wall
    palettes.js         the colour palettes
```
