# Assets

The game is drawn in 3D with three.js. [`src/config/assets.js`](../config/assets.js) decides which model is used for what: point an entry at a different file to swap it.

## 3D models (`underlord/models`)

Self-contained `.glb` files, loaded at run time from `./models/` and copied next to the page by the build. They come from free CC0 packs:

| Folder | Pack | Used for |
|---|---|---|
| `models/blocks/` | [KayKit Block Bits](https://kaylousberg.itch.io/block-bits) | The dungeon: earth, gold, gem, rock and brick blocks, gravel and tiled floors |
| `models/cave/` | [Kenney Modular Cave Kit](https://kenney.nl/assets/modular-cave-kit) | The portal arch |
| `models/dungeon/` | [Kenney Modular Dungeon Kit](https://kenney.nl/assets/modular-dungeon-kit) | The Heart's columns, the Hero Gate |
| `models/mini/` | [Kenney Mini Dungeon](https://kenney.nl/assets/mini-dungeon) | Room props: coins, chests, tables, chairs, banners, weapons, training posts; the stands in the character viewer |
| `models/kaykit/` | [KayKit Adventurers](https://kaylousberg.itch.io/kaykit-adventurers), [KayKit Character Animations](https://kaylousberg.itch.io/kaykit-character-animations) | Every creature and hero, their weapons and the shared animations (`Rig_Medium_*`: only the clips the game plays, listed in `ANIMATIONS` in the import script, without the mannequin mesh) |

- Copy them with `node underlord/tools/import-models.mjs` (from the repository root) after unzipping the packs into `downloads/KayKit/` and `downloads/Kenney/` (ignored by git). The script embeds each model's texture, so every file stands alone, and only copies the models it lists.
- Block Bits blocks are 2 × 2 × 2 units (half scale is one tile); open tiles use a block sunk to floor level. Kenney's modular kits use 4 × 4-unit tiles, the Mini Dungeon 1 × 1.
- All KayKit figures share one skeleton, so a figure can borrow parts from another (the Tunneller wears the Knight's helmet) and all play the same clips. Weapons sit on the `handslot.r` / `handslot.l` bones. The pickaxe (imp), the mattock (Tunneller) and the whip (Dark Mistress, in a tight, shiny black leather suit as in Dungeon Keeper, with a smaller head and an hourglass torso set in `assets.js`) are built in code, in the same style.
- Look at every figure and animation in the character viewer: open the game with `?characters` (for example `/underlord/?characters`). Pick a tab to see one figure, or switch on Compare to put several side by side.

## SVGs (`src/assets`)

- `units/`: portraits of every creature and hero, only used in the panel's Creatures tab (`0 0 64 64`, facing right, *Plants vs. Zombies* style with thin dark-brown outlines `#2b1b12`).
- `cursors/`: the Hand of Evil mouse pointer (32 × 32): `claw.svg` (pointing, hotspot at the claw tip), `claw-open.svg` (over your units), `claw-fist.svg` (holding units, dragging the map). Used from `src/styles/underlord.css`.
- `brand/logo.svg`: the Underlord logo; `favicon.svg`.
- The build embeds these SVGs in the HTML file.

## Built in code

The keeper emblem on claimed floors and the jewels on reinforced walls, the imp's horns, the Lord's crown, the pickaxe, mattock and whip, the clouds, the Heart's crystal and the swirls in the portals, nests, straw, chickens and bookshelves, and every effect (shots, dust, rings, lightning).
