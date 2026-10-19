# Underlord

A browser game in the spirit of *Dungeon Keeper*. You are an evil overlord deep underground: dig into a cloud-covered map, claim territory, build rooms, attract creatures through portals and defend your Dungeon Heart against six invasions from the surface.

The game is a web page built with [Vite](https://vite.dev). All game data (settings, creatures, heroes, rooms, spells and waves) lives in plain JavaScript files under [`src/config`](src/config). Play it at [pjotrvdh.github.io/underlord](https://pjotrvdh.github.io/underlord/). It is one of the games in the [Arcade](../README.md).

## How to play

- **Dig:** click a block to mark it for digging, or drag to mark a whole rectangle. You can mark blocks inside the clouds too. Your imps dig the blocks out, carry the gold to the Heart or a Treasury, and claim the new floor.
- **Imps defend the Heart:** imps flee from heroes, but when the Dungeon Heart is under attack, the imps nearby rush in to fight.
- **Walls:** idle imps reinforce the earth walls around your territory. Heroes take much longer to tunnel through a reinforced wall.
- **Explore:** the map is hidden in clouds. Your units reveal what they can see, and walls block their sight. Gold seams and the portal near your Dungeon Heart shine through the clouds. Hidden caverns hold treasure chests, wandering creatures that join you, and a camp of sleeping heroes. Invading heroes show as white dots, on the map and the minimap, until they reach ground you have discovered; only then can you see which hero it is.
- **Build:** you build rooms on claimed ground by clicking a tile or dragging a rectangle. The rooms are Treasury, Lair, Hatchery, Training Room and Library.
- **Creatures:** creatures only arrive through a portal you have claimed. Each one claims its own bed (a Lair tile) the first time it needs one; that tile is then locked for the others. Stronger creatures also need rooms of 9 or more tiles. Each map has a limited pool of creatures, and they want their wages on payday.
- **Hand:** left-click a creature to pick it up (you can hold up to 8), then left-click your territory to drop it.
  - A creature dropped into a Training Room, Library or Hatchery starts working there right away, with a small bonus.
  - Dropped on a free Lair tile, a creature moves its bed there and goes to sleep. Another creature's bed stays locked.
  - A dropped creature is dazed for a moment.
  - Dropping a creature on your own portal dismisses it.
  - Right-click slaps a creature; slapped imps work 25% faster.
- **Spells:** Create Imp, Call to Arms, Heal and Lightning, in the research order of Dungeon Keeper. You unlock the last three through research in the Library. Call to Arms is free on your own territory.
- **Control panel:** a minimap at the top (click it to jump there), then Info, Rooms, Spells and Creatures tabs. The Creatures tab shows, for each type, how many are idle, working and fighting. Click a number to pick one of them up, or right-click it to look at it.
- **Computer Assistant:** the **C** button on the minimap lets the computer play for you, in one of four modes: Aggressive, Defensive, Construction only or Move only.
- **Cheats:** type `iliketocheat` during the game to unlock the Cheats panel. A reload locks it again.
- **Saving:** games are saved in your browser (localStorage). The game also autosaves every two minutes.
- **Win:** survive all six hero waves. The last wave is led by the Lord of the Land. You lose when your Dungeon Heart is destroyed.

### Controls

| Action | Mouse / touch | Keyboard |
|---|---|---|
| Mark for digging / build | click or drag | |
| Slap | right-click | |
| Scroll the map | right- or middle-drag, the **Look** tool, two-finger drag | arrow keys / WASD |
| Zoom | mouse wheel, pinch, **+ / − / Fit** buttons | `+` / `-` |
| Pause | **Pause** button | `Space` / `P` |
| Game speed | **1×** button | `1` `2` `3` |
| Back to the hand tool | | `Esc` |
| Cheats panel (after typing `iliketocheat`) | **Cheats** button | `` ` `` |

## Development

Set up the Arcade as described in the [root README](../README.md); `npm run dev` there also serves this game at `/underlord/`. For this game alone, from the repository root:

| Command | What it does |
|---|---|
| `npm run dev -w underlord` | start a dev server for the game only |
| `npm run build -w underlord` | build the game into one file, `underlord/dist/index.html` |

The build is a single, self-contained HTML file: the JavaScript, the styles, the SVGs and the favicon are all embedded. You can open it straight from disk, put it anywhere or send it to someone, also offline. The commit hash and time of the build are shown below the Chronicle.

## Project layout

```
index.html              the game page
cover.svg               the game's tile on the Arcade index (16:9)
vite.config.js          builds one self-contained HTML file (see ../tools/vite.js)
src/
  assets/               SVG graphics and the favicon (see src/assets/README.md)
  main.js               entry point: styles, game and the version label
  game/underlord.js     the game itself
  styles/underlord.css
  config/               all game data, one file per item
    index.js            puts everything together for the game
    settings/           one file per group: economy, imp, heart, portal, waves, hand, assistant, walls
    creatures/          your creatures: imp.js, orc.js, warlock.js, troll.js, mistress.js
    heroes/             the invaders: tunneller.js, archer.js, wizard.js, knight.js, lord.js
    rooms/              treasury.js, lair.js, hatchery.js, training.js, library.js
    spells/             imp.js, rally.js, heal.js, bolt.js
    waves.js            the hero invasions, in order
    assets.js           which SVG the game draws for what
```

## Game data

- Every creature, hero, room and spell has its own file, and every value is documented in it.
- The `index.js` in each folder sets the order the game uses. To add something, add a file and list it there.
- Keys are fixed: the game logic, the waves and the assets refer to them.
- Only creatures and heroes from the original Dungeon Keeper (1997) belong in the game.
- See [`src/assets/README.md`](src/assets/README.md) for the size and orientation of the SVGs.
