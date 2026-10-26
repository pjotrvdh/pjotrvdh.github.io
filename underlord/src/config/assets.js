/**
 * What the game draws for what. 3D models are .glb files under underlord/models (copied there by
 * underlord/tools/import-models.mjs; Kenney and KayKit packs, CC0), loaded at run time from ./models/.
 * The SVG portraits under src/assets/units are only used in the panel (Creatures tab).
 * See src/assets/README.md.
 */
const icons = import.meta.glob('../assets/units/*.svg', { eager: true, query: '?url', import: 'default' });

/** The URL of a portrait SVG under src/assets/units (a data URI in the build). */
function icon(kind) {
    const url = icons[`../assets/units/${kind}.svg`];
    if (!url) {
        throw new Error(`Missing asset src/assets/units/${kind}.svg`);
    }

    return url;
}

export default {
    /** Your colour as the keeper: claimed floor, the emblem on it, the jewels on reinforced walls, your units' rings. */
    keeper: '#e0483c',

    /** Ruby purple: the gems in gem seams (the gold of the gold block, recoloured), their glints and the minimap. */
    gemColor: '#a32a9c',

    /** Panel portraits per unit kind. */
    icons: Object.fromEntries(['imp', 'orc', 'warlock', 'troll', 'mistress', 'skeleton', 'tunneller', 'thief', 'archer', 'wizard', 'barbarian', 'knight', 'lord'].map((k) => [k, icon(k)])),

    /**
     * Unit figures, all KayKit Adventurers (they share one skeleton, animated with the Rig_Medium clips
     * in `rigs`). `model`: a .glb under models/; `height`: in tiles; `width`: extra breadth (1 = as
     * modelled); `tint`: multiplied into every colour; `tints`: per part, matched on the mesh name (a colour, or [colour, brightness]);
     * `hide`: parts left out; `shape`: 'hourglass' (a feminine torso); `headSize`: head scale (less chibi); `gloss`: shiny parts (leather); `borrow`: parts taken from another KayKit model; `extras`: built-in
     * pieces on the head ('crown', 'horns'); `right` / `left`: a model held in that hand ('pickaxe', 'mattock' and 'whip' are built in); `clips`: Rig_Medium clips per activity that replace the defaults (`CLIPS` in src/render/units.js); `turn`: extra degrees a held item turns around its length, per hand ({ left: 90 }); `mirror`: activities whose clip plays mirrored, left and right swapped. Check them all
     * in the character viewer: the game with ?characters.
     */
    units: {
        imp: {
            clips: {
                attack: 'Melee_1H_Attack_Chop'
            },
            model: 'kaykit/Rogue.glb',
            rig: 'kaykit',
            height: 0.5,
            width: 1.1,
            hide: ['Cape'],
            tints: {
                Head: '#ff7a5c',
                Arm: '#ff7a5c',
                Body: '#d06a50',
                Leg: '#9a5a48',
            },
            extras: ['horns'],
            right: 'pickaxe',
        },
        orc: {
            clips: {
                attack: 'Melee_1H_Attack_Chop',
                train: 'Melee_1H_Attack_Slice_Horizontal',
            },
            model: 'kaykit/Knight.glb',
            rig: 'kaykit',
            height: 0.84,
            width: 1.1,
            hide: ['Visor'],
            tints: {
                Head: '#8fcf6a',
                Helmet: '#7d8272',
                Body: '#7d8272',
                Arm: '#7d8272',
                Leg: '#7d8272',
                Cape: '#5a3a2a',
            },
            right: 'kaykit/axe_1handed.glb',
        },
        warlock: {
            clips: {
                attack: 'Ranged_Magic_Shoot',
            },
            model: 'kaykit/Rogue_Hooded.glb',
            rig: 'kaykit',
            height: 0.74,
            tint: '#b796e6',
            right: 'kaykit/staff.glb',
            left: 'kaykit/spellbook_closed.glb',
        },
        troll: {
            clips: {
                attack: 'Melee_1H_Attack_Chop',
                train: 'Push_Ups',
            },
            model: 'kaykit/Barbarian.glb',
            rig: 'kaykit',
            height: 0.7,
            width: 1.2,
            hide: ['BearHat'],
            tints: {
                Head: '#8fbf6a',
                Arm: '#8fbf6a',
                Body: '#a0b07a',
            },
            right: 'kaykit/axe_1handed.glb',
        },
        mistress: {
            clips: {
                attack: 'Melee_1H_Attack_Slice_Horizontal',
                train: 'Melee_1H_Attack_Slice_Horizontal',
            },
            model: 'kaykit/Rogue.glb',
            rig: 'kaykit',
            height: 0.92,
            shape: 'hourglass',
            headSize: 0.78,
            hide: ['Cape'],
            gloss: [
                'Body',
                'Leg',
                'Arm',
            ],
            tints: {
                Body: [
                    '#3a2236',
                    0.9,
                ],
                Leg: [
                    '#2c1a2a',
                    0.9,
                ],
                Arm: [
                    '#3a2236',
                    0.9,
                ],
                Head: '#ffd6dc',
            },
            right: 'whip',
        },
        skeleton: {
            clips: {
                attack: 'Melee_1H_Attack_Chop'
            },
            model: 'kaykit/Skeleton_Warrior.glb',
            rig: 'kaykit',
            height: 0.78,
            hide: ['Cloak'],
            right: 'kaykit/Skeleton_Blade.glb',
        },
        tunneller: {
            clips: {
                attack: 'Melee_2H_Attack_Chop'
            },
            model: 'kaykit/Barbarian.glb',
            rig: 'kaykit',
            height: 0.6,
            width: 1.25,
            hide: ['BearHat'],
            borrow: [
                {
                    from: 'kaykit/Knight.glb',
                    part: 'Knight_Helmet',
                },
            ],
            tints: {
                Helmet: [
                    '#e8a85a',
                    1.6,
                ],
            },
            right: 'mattock',
        },
        thief: {
            clips: {
                attack: 'Melee_1H_Attack_Slice_Horizontal'
            },
            model: 'kaykit/Rogue_Hooded.glb',
            rig: 'kaykit',
            height: 0.7,
            tint: '#8c94a0',
            right: 'kaykit/dagger.glb',
        },
        archer: {
            clips: {
                attack: 'Ranged_Bow_Release'
            },
            model: 'kaykit/Ranger.glb',
            rig: 'kaykit',
            height: 0.76,
            left: 'kaykit/bow_withString.glb',
            turn: { left: 180 },
        },
        wizard: {
            clips: {
                attack: 'Ranged_Magic_Shoot'
            },
            model: 'kaykit/Mage.glb',
            rig: 'kaykit',
            height: 0.82,
            right: 'kaykit/staff.glb',
        },
        barbarian: {
            clips: {
                attack: 'Melee_2H_Attack_Chop'
            },
            model: 'kaykit/Barbarian.glb',
            rig: 'kaykit',
            height: 0.84,
            width: 1.15,
            right: 'kaykit/axe_2handed.glb',
        },
        knight: {
            clips: {
                attack: 'Melee_1H_Attack_Chop',
                guard: 'Melee_Blocking',
            },
            model: 'kaykit/Knight.glb',
            rig: 'kaykit',
            height: 0.82,
            right: 'kaykit/sword_1handed.glb',
            left: 'kaykit/shield_badge_color.glb',
        },
        lord: {
            clips: {
                attack: 'Melee_2H_Attack_Chop'
            },
            model: 'kaykit/Knight.glb',
            rig: 'kaykit',
            height: 0.82,
            tints: {
                Helmet: [
                    '#ffc83a',
                    1.75,
                ],
                Body: [
                    '#ffc83a',
                    1.75,
                ],
                Arm: [
                    '#ffc83a',
                    1.75,
                ],
                Leg: [
                    '#ffc83a',
                    1.75,
                ],
                Cape: '#8a3ad0',
            },
            extras: ['crown'],
            right: 'kaykit/sword_2handed_color.glb',
        },
    },


    /** Animation clips shared by every KayKit figure. */
    rigs: ['General', 'MovementBasic', 'CombatMelee', 'CombatRanged', 'Simulation', 'Tools'].map((group) => `kaykit/Rig_Medium_${group}.glb`),

    /**
     * Blocks per tile type (KayKit Block Bits): solid tiles are full blocks, open tiles a block sunk to
     * floor level. `claimed` is tinted with the keeper colour (rooms with their room colour).
     */
    tiles: {
        earth: 'blocks/dirt.glb',
        gold: 'blocks/stone_with_gold.glb',
        /** The gold block, its gold recoloured with `gemColor` (terrain.js), so gem seams read like gold seams. */
        gem: 'blocks/stone_with_gold.glb',
        rock: 'blocks/stone_dark.glb',
        wall: 'blocks/bricks_A.glb',
        floor: 'blocks/gravel.glb',
        claimed: 'blocks/bricks_B.glb',
        lava: 'blocks/lava.glb',
    },

    /** Props in rooms and landmarks (Kenney). */
    props: {
        chest: 'mini/chest.glb',
        coin: 'mini/coin.glb',
        /** Stacks of coins in the Treasury, more and bigger as it fills (KayKit Dungeon Pack 1.1). */
        coinsSmall: 'kaykit/coin_stack_small.glb',
        coinsMedium: 'kaykit/coin_stack_medium.glb',
        coinsLarge: 'kaykit/coin_stack_large.glb',
        /** Training Room: archery targets and racks of weapons (KayKit Mini-Game Variety Pack, Dungeon Pack 1.0). */
        target: 'kaykit/targetStand.glb',
        weaponRack: 'kaykit/weaponRack.glb',
        /** Lair: a bed on the floor for every creature that has claimed one (KayKit Dungeon Pack 1.1). */
        bed: 'kaykit/bed_floor.glb',
        /** Library: filled bookcases (KayKit Dungeon Pack 1.0). */
        bookcase: 'kaykit/bookcaseWideFilled.glb',
        /** On your reinforced walls, facing your rooms and territory (KayKit Dungeon Pack 1.1). */
        torch: 'kaykit/torch_mounted.glb',
        table: 'mini/table.glb',
        chair: 'mini/chair.glb',
        potion: 'mini/potion.glb',
        /** Held while eating (KayKit Restaurant Bits). */
        steak: 'kaykit/steak.glb',
        /** Held while reinforcing a wall (KayKit RPG Tools Bits). */
        hammer: 'kaykit/hammer.glb',
        /** Held open while studying (KayKit Adventurers). */
        book: 'kaykit/spellbook_open.glb',
        banner: 'mini/banner.glb',
        /** Prison: iron bars along the room's outline (Kenney Graveyard Kit). */
        bars: 'graveyard/iron-fence.glb',
        heartColumn: 'dungeon/template-detail.glb',
        portalArch: 'cave/gate.glb',
        heroGate: 'dungeon/gate-metal-bars.glb',
    },
};
