---
name: dungeon-keeper
description: Original Dungeon Keeper (1997) values for Underlord's creatures, heroes, rooms and spells, and where Underlord differs. Read before balancing.
---

## When to use this

- You balance a creature, hero, room or spell in `underlord/src/config/`
- You add a creature or hero and need its original stats, needs or job
- You want to know whether a rule is faithful to Dungeon Keeper or an Underlord simplification
- Keywords: original, Dungeon Keeper, DK1, faithful, balance, attraction, wage, research order

## Source

- [ludo.guide: Dungeon Keeper](https://www.ludo.guide/guide/dungeon-keeper), a copy of the GameFAQs guide. Stats come from its "Creature Statistics" table (`creature.txt`, level 1) and the per-creature pages.
- DK levels add 35% of the level-1 HP, strength, skill, dexterity and wage per level (level 10 = 415%), rounded down.
- Underlord numbers are scaled down (HP roughly 1/5) and tuned for a short single map. Keep the ordering between kinds close to the original; exact values do not need to match.

## Creatures (level 1)

| Kind | DK HP | DK STR | DK wage | DK portal needs | DK job | Underlord `hp` / `attack` / `wage` | Underlord `attract` |
|---|---|---|---|---|---|---|---|
| Imp | 75 | 5 | 0 | none (Create Imp) | dig, claim, haul, reinforce | 40 / 3 / 0 | n/a |
| Orc | 700 | 65 | 95 | Training Room 9 + Barracks 1 | training, guard post | 140 / 13 / 55 | none |
| Warlock | 350 | 20 | 120 | Library 9 | research | 70 / 13 / 70 | Library 9 |
| Troll | 450 | 40 | 50 | Workshop 1 | manufacture | 110 / 9 / 30 | Lair 9 + Hatchery 9 |
| Dark Mistress | 700 | 60 | 175 | Torture Room 9 | torture herself | 140 / 18 / 105 | Training 9 |

DK job values (1-5, higher is better), as Training / Research / Workshop / Scavenge: Imp 1/0/0/0, Orc 2/0/3/2, Warlock 2/4/1/5, Troll 1/1/4/2, Mistress 2/2/2/3.

Other DK facts per kind:

- **Imp**: Create Imp costs 150 + 150 per imp you have; slapping makes it work 25% faster; fights only when another imp is near or the Heart is attacked; can be trained; Speed at level 3, Teleport at 10.
- **Orc**: easily pleased; trains by itself to level 10, then takes guard posts; Speed 5, Protect 7, Grenade 9; eats 2 chickens.
- **Warlock**: best researcher with the hero Wizard; arrogant; from level 2 it fireballs non-Warlock/non-Wizard creatures out of the Library; ranged (Fireball at level 2, range 8 tiles); natural enemy Vampire; eats 3 chickens.
- **Troll**: top manufacturer, poor fighter, cannot research; eats 3 chickens.
- **Dark Mistress**: likes being slapped (it makes her happy); visits the Torture Room; Lightning 6, Speed 7, Drain 9, Teleport 10; natural enemy Samurai; eats 3 chickens.

## Heroes (level 1)

| Kind | DK HP | DK STR | DK notes | Underlord `hp` / `attack` / `range` |
|---|---|---|---|---|
| Tunneller (Valley Dwarf) | 350 | 40 | weakest hero; digs towards your dungeon so others can follow | 80 / 8 / 1 |
| Archer | 300 | 20 | ranged (Arrow), weak up close | 60 / 9 / 4.5 |
| Wizard | 350 | 20 | ranged (Missile range 10, Fireball at 3); best researcher | 70 / 15 / 4 |
| Knight | 950 | 80 | strong melee, ARM 100 | 230 / 18 / 1 |
| Lord of the Land | = Knight | = Knight | a Knight (the guide lists "Lord of the Land" as another name for it), met as a high-level campaign boss | 1000 / 32 / 1, `big` |

- Underlord's `lord` is a separate hero key with its own stats; in DK it is a Knight. The Avatar, DK's final boss, is not in the game.

## Rooms

| Room | DK gold per tile | Underlord `cost` | DK attracts |
|---|---|---|---|
| Treasure Room | 50 | 50 | Dragon, Demon Spawn (large room) |
| Lair | 100 | 100 | Beetle, Bile Demon, Dragon, Spider, Tentacle, Vampire |
| Hatchery | 150 | 150 | Bile Demon, Spider |
| Training Room | 150 | 150 | Demon Spawn, Orc |
| Library | 200 | 200 | Warlock |

- DK: one Lair tile per creature (Dragons take 4); certain pairs need separate Lairs (Warlock and Vampire, Samurai and Dark Mistress, ...). Training in DK costs a per-creature amount per session; the Training Room lets creatures reach level 10.

## Spells

| Spell | DK cost | DK research | Underlord `cost` / `research` |
|---|---|---|---|
| Create Imp | 150 + 150 per imp | 1000 (available from the start) | 100 + 25 per imp (`settings/imp.js`) / 0 |
| Call to Arms | 1-8 gold per second off your land, free on your land | 7400 | 300 per cast, free on a claimed tile / 150 |
| Heal | 300-1100 (charge) | 14000 | 300 / 400 |
| Lightning | 600-3000 (charge); a full charge kills an imp; does not hurt your own creatures | 15000 | 600 / 500 |

- DK research order (fixed): Create Imp, Treasure Room, Lair, Hatchery, Training Room, Library, Sight of Evil, Bridge, Speed, Must Obey, Guard Post, **Call to Arms**, Workshop, ..., **Heal**, Temple, **Lightning**, ... Underlord's `spells/index.js` keeps that relative order.

## Where Underlord deviates

- **Attraction**: Orc needs nothing (no Barracks), Troll needs Lair 9 + Hatchery 9 (no Workshop), Dark Mistress needs Training 9 (no Torture Room). The Warlock matches.
- **Jobs**: there is no Workshop, Torture Room or Guard Post, so Trolls, Mistresses and Orcs train instead. `train` and `study` in `creatures/*.js` follow DK's job values: the Troll trains slowest (7 XP/s vs 9), Orc and Troll never study (`study: 0`), the Warlock studies fastest (4 vs the Mistress's 1.2).
- **Levelling**: Underlord multiplies `maxhp` by 1.12 and `atk` by 1.1 per level (about 2.8x and 2.4x at level 10); DK adds 35% of the base per level (4.15x at level 10). Wages do not rise with level in Underlord.
- **Food**: one Hatchery visit resets hunger; there are no per-kind chicken counts.
- **Imps** never fight in Underlord, not even to defend the Heart.
- **Personality**: no Warlock Library aggression, no Mistress joy from slaps, no natural enemies or separate-Lair pairs, no happiness/anger beyond wages and hunger.
- **Spells** have one fixed cost instead of a charge level; Call to Arms costs per cast, not per second.
- **Create Imp** is deliberately much cheaper (100 + 25 per imp vs 150 + 150): imps are the only workers on a short map.

## Gotchas

- The guide's "Wizard 350 20 15 ..." page is a misparsed table row with invented text (mana, "trained in the Library or Lair"); trust the Creature Statistics table instead.
- Hero stats in DK campaign maps vary per level (Tunnellers are toned down early on); the table values are the `creature.txt` base.

## See also

- [creatures](creatures.md) — how Underlord's creatures actually behave
- [heroes](heroes.md) — Underlord's waves and hero stats in use
- [spells](spells.md) — Underlord's spell effects and costs
- [rules](rules.md) — attraction, paydays and research from the player's side
