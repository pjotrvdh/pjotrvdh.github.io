# Assets

The game is drawn in 3D with three.js. [`src/config/assets.js`](../config/assets.js) decides which model is used for what: point an entry at a different file to swap it.

## 3D models (`underlord/models`)

Self-contained `.glb` files, loaded at run time from `./models/` and copied next to the page by the build. They come from free CC0 packs:

| Folder | Pack | Used for |
|---|---|---|
| `models/cave/` | [Kenney Modular Cave Kit](https://kenney.nl/assets/modular-cave-kit) | Unclaimed floor, earth walls, the portal arch |
| `models/dungeon/` | [Kenney Modular Dungeon Kit](https://kenney.nl/assets/modular-dungeon-kit) | The Heart's columns, the Hero Gate |
| `models/mini/` | [Kenney Mini Dungeon](https://kenney.nl/assets/mini-dungeon) | Room props: coins, chests, tables, chairs, banners, weapons, training posts; the stands in the character viewer |
| `models/kaykit/` | [KayKit Adventurers](https://kaylousberg.itch.io/kaykit-adventurers) | Every creature and hero, their weapons and the shared animations (`Rig_Medium_*`) |

- Copy them with `node underlord/tools/import-models.mjs` (from the repository root) after unzipping the packs into `downloads/` (ignored by git). The script embeds each model's texture, so every file stands alone, and only copies the models it lists.
- Kenney's modular kits use 4 × 4-unit tiles (scaled to one tile); a wall piece faces +Z with its body half a tile behind it. The Mini Dungeon uses 1 × 1 tiles.
- All KayKit figures share one skeleton, so a figure can borrow parts from another (the Tunneller wears the Knight's helmet) and all play the same clips. Weapons sit on the `handslot.r` / `handslot.l` bones. The pickaxe (imp) and the mattock (Tunneller) are built in code, in the same style.
- Look at every figure and animation in the character viewer: open the game with `?characters` (for example `/underlord/?characters`). Pick a tab to see one figure, or switch on Compare to put several side by side.

## SVGs (`src/assets`)

- `units/`: portraits of every creature and hero, only used in the panel's Creatures tab (`0 0 64 64`, facing right, *Plants vs. Zombies* style with thin dark-brown outlines `#2b1b12`).
- `brand/logo.svg`: the Underlord logo; `favicon.svg`.
- The build embeds these SVGs in the HTML file.

## Built in code

The tiled floor of claimed ground with the keeper emblem, the brick reinforced walls and their jewels, the imp's horns, the Lord's crown, the pickaxe and mattock, the block tops, gold nuggets and gems in the rock, lava, the clouds, the Heart's crystal and the swirls in the portals, nests, straw, chickens and bookshelves, and every effect (shots, dust, rings, lightning).
