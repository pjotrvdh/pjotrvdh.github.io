/**
 * Copies the 3D models Underlord uses from the downloaded asset packs into underlord/models, as
 * self-contained .glb files: textures (and .bin buffers) are embedded, so every model is one file.
 *
 * Usage, from the repository root, with the packs unzipped in ./downloads/KayKit and ./downloads/Kenney (ignored by git):
 *     node underlord/tools/import-models.mjs
 *
 * The packs (all CC0): Kenney Mini Dungeon, Modular Dungeon Kit and Modular Cave Kit (kenney.nl),
 * KayKit Adventurers 2.0, Block Bits 1.0, Restaurant Bits 1.0 and Character Animations 1.1 (kaylousberg.itch.io). See
 * underlord/src/assets/README.md.
 *
 * Animation files keep only the clips listed in ANIMATIONS, and no mesh: the game plays them on its own
 * figures, so each file holds just the skeleton's nodes and those clips.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SOURCE = 'downloads';
const TARGET = 'underlord/models';

const MINI = 'Kenney/kenney_mini-dungeon/Models/GLB format';
const DUNGEON = 'Kenney/kenney_modular-dungeon-kit_1.0/Models/GLB format';
const CAVE = 'Kenney/kenney_modular-cave-kit_1.0/Models/GLB format';
const KAYKIT = 'KayKit/KayKit_Adventurers_2.0_FREE';
const BLOCKS = 'KayKit/KayKit_BlockBits_1.0_FREE/Assets/gltf';
const RESTAURANT = 'KayKit/KayKit_Restaurant_Bits_1.0_FREE/Assets/gltf';
const ANIMS = 'KayKit/KayKit_Character_Animations_1.1/Animations/gltf/Rig_Medium';

/** The Rig_Medium clips the game plays (see CLIPS in src/render/units.js and `clips` in src/config/assets.js), per file. */
const ANIMATIONS = {
    General: ['Idle_A', 'Idle_B', 'Death_A', 'Hit_A', 'Hit_B', 'PickUp', 'Use_Item', 'Interact', 'Throw', 'Spawn_Ground'],
    MovementBasic: ['Walking_A', 'Running_A', 'Jump_Idle'],
    CombatMelee: ['Melee_1H_Attack_Chop', 'Melee_1H_Attack_Slice_Horizontal', 'Melee_2H_Attack_Chop', 'Melee_Unarmed_Attack_Punch_A', 'Melee_Blocking'],
    CombatRanged: ['Ranged_Bow_Release', 'Ranged_Magic_Shoot', 'Ranged_Magic_Spellcasting'],
    Simulation: ['Lie_Idle', 'Sit_Floor_Idle', 'Push_Ups', 'Cheering'],
    Tools: ['Pickaxing', 'Hammering', 'Working_A'],
};

/** [target name, source file] */
const MODELS = [
    ...['coin', 'chest', 'table', 'chair', 'banner', 'potion', 'wood-support', 'weapon-sword', 'weapon-spear', 'shield-round']
        .map((name) => [`mini/${name}.glb`, `${MINI}/${name}.glb`]),
    ...['template-detail', 'gate-metal-bars']
        .map((name) => [`dungeon/${name}.glb`, `${DUNGEON}/${name}.glb`]),
    ...['gate']
        .map((name) => [`cave/${name}.glb`, `${CAVE}/${name}.glb`]),
    ...['dirt', 'gravel', 'stone_dark', 'stone_with_gold', 'stone_with_silver', 'bricks_A', 'bricks_B', 'lava']
        .map((name) => [`blocks/${name}.glb`, `${BLOCKS}/${name}.gltf`]),
    ...['Barbarian', 'Knight', 'Mage', 'Ranger', 'Rogue', 'Rogue_Hooded']
        .map((name) => [`kaykit/${name}.glb`, `${KAYKIT}/Characters/gltf/${name}.glb`]),
    ['kaykit/steak.glb', `${RESTAURANT}/food_ingredient_steak.gltf`],
    ...['sword_1handed', 'sword_2handed_color', 'shield_badge_color', 'bow_withString', 'staff', 'axe_1handed', 'dagger', 'spellbook_open']
        .map((name) => [`kaykit/${name}.glb`, `${KAYKIT}/Assets/gltf/${name}.gltf`]),
];

const pad4 = (n) => (n + 3) & ~3;

/** Reads a .glb into its JSON and binary chunks. */
function readGlb(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const jsonLength = view.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)));
    const binStart = 20 + jsonLength;
    const bin = binStart < bytes.length ? bytes.subarray(binStart + 8, binStart + 8 + view.getUint32(binStart, true)) : new Uint8Array(0);

    return { json, bin };
}

/** Writes JSON and binary chunks as a .glb. */
function writeGlb(json, bin) {
    const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
    const jsonLength = pad4(jsonBytes.length);
    const binLength = pad4(bin.length);
    const out = new Uint8Array(12 + 8 + jsonLength + 8 + binLength);
    const view = new DataView(out.buffer);
    view.setUint32(0, 0x46546c67, true); // "glTF"
    view.setUint32(4, 2, true);
    view.setUint32(8, out.length, true);
    view.setUint32(12, jsonLength, true);
    view.setUint32(16, 0x4e4f534a, true); // "JSON"
    out.fill(0x20, 20, 20 + jsonLength);
    out.set(jsonBytes, 20);
    const binStart = 20 + jsonLength;
    view.setUint32(binStart, binLength, true);
    view.setUint32(binStart + 4, 0x004e4942, true); // "BIN"
    out.set(bin, binStart + 8);

    return out;
}

/** Appends a file to the binary chunk and returns a buffer view for it. */
function append(json, chunks, bytes) {
    const offset = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    chunks.push(bytes, new Uint8Array(pad4(bytes.length) - bytes.length));
    json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });

    return json.bufferViews.length - 1;
}

/** Turns a .glb or .gltf with external files into one self-contained .glb. */
function embed(file) {
    const folder = dirname(file);
    let json;
    let chunks;
    if (file.endsWith('.glb')) {
        const glb = readGlb(readFileSync(file));
        json = glb.json;
        chunks = [glb.bin, new Uint8Array(pad4(glb.bin.length) - glb.bin.length)];
    } else {
        json = JSON.parse(readFileSync(file, 'utf8'));
        // Every buffer of a .gltf becomes part of the one binary chunk, in order.
        chunks = [];
        const offsets = [];
        let offset = 0;
        for (const buffer of json.buffers) {
            const bytes = readFileSync(join(folder, buffer.uri));
            offsets.push(offset);
            chunks.push(bytes, new Uint8Array(pad4(bytes.length) - bytes.length));
            offset += pad4(bytes.length);
        }
        for (const view of json.bufferViews) {
            view.byteOffset = (view.byteOffset ?? 0) + offsets[view.buffer];
            view.buffer = 0;
        }
    }
    json.bufferViews ??= [];
    for (const image of json.images ?? []) {
        if (!image.uri || image.uri.startsWith('data:')) {
            continue;
        }
        image.bufferView = append(json, chunks, readFileSync(join(folder, decodeURIComponent(image.uri))));
        image.mimeType ??= image.uri.endsWith('.png') ? 'image/png' : 'image/jpeg';
        delete image.uri;
    }
    const bin = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
    let at = 0;
    for (const chunk of chunks) {
        bin.set(chunk, at);
        at += chunk.length;
    }
    json.buffers = [{ byteLength: bin.length }];

    return writeGlb(json, bin);
}

/** Keeps only the named animation clips of a .glb, and only the nodes they move: no meshes, skins or textures. */
function clipsOnly(file, names) {
    const { json, bin } = readGlb(readFileSync(file));
    const animations = json.animations.filter((a) => names.includes(a.name));
    const missing = names.filter((n) => !animations.some((a) => a.name === n));
    if (missing.length) {
        throw new Error(`${file}: no clip ${missing.join(', ')}`);
    }
    // every accessor the kept clips read, copied into a fresh binary chunk
    const accessors = [];
    const bufferViews = [];
    const chunks = [];
    let offset = 0;
    const remap = new Map();
    const copy = (index) => {
        if (remap.has(index)) {
            return remap.get(index);
        }
        const a = { ...json.accessors[index] };
        const view = json.bufferViews[a.bufferView];
        const start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
        const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type] * ({ 5126: 4, 5123: 2, 5121: 1 }[a.componentType]) * a.count;
        const bytes = bin.subarray(start, start + size);
        chunks.push(bytes, new Uint8Array(pad4(size) - size));
        bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: size });
        offset += pad4(size);
        a.bufferView = bufferViews.length - 1;
        delete a.byteOffset;
        accessors.push(a);
        remap.set(index, accessors.length - 1);

        return accessors.length - 1;
    };
    for (const animation of animations) {
        for (const sampler of animation.samplers) {
            sampler.input = copy(sampler.input);
            sampler.output = copy(sampler.output);
        }
    }
    const nodes = json.nodes.map((node) => {
        const { mesh, skin, ...rest } = node;

        return rest;
    });
    const out = { asset: json.asset, scene: json.scene ?? 0, scenes: json.scenes, nodes, animations, accessors, bufferViews, buffers: [{ byteLength: offset }] };
    const data = new Uint8Array(offset);
    let at = 0;
    for (const chunk of chunks) {
        data.set(chunk, at);
        at += chunk.length;
    }

    return writeGlb(out, data);
}

// check every source first, so a missing pack never leaves the models folder empty
for (const [, source] of MODELS) {
    readFileSync(join(SOURCE, source));
}
rmSync(TARGET, { recursive: true, force: true });
for (const [target, source] of MODELS) {
    const out = join(TARGET, target);
    mkdirSync(dirname(out), { recursive: true });
    const glb = embed(join(SOURCE, source));
    writeFileSync(out, glb);
    console.log(`${out} (${Math.round(glb.length / 1024)} KB)`);
}
for (const [group, names] of Object.entries(ANIMATIONS)) {
    const out = join(TARGET, `kaykit/Rig_Medium_${group}.glb`);
    const glb = clipsOnly(join(SOURCE, `${ANIMS}/Rig_Medium_${group}.glb`), names);
    writeFileSync(out, glb);
    console.log(`${out} (${Math.round(glb.length / 1024)} KB, ${names.length} clips)`);
}
