/**
 * SVG graphics the game draws, as files under src/assets. Swap a file or a path to restyle something;
 * remove an entry to fall back to the built-in drawing. Sizes and orientation: src/assets/README.md.
 * The build embeds every SVG in the HTML file as a data URI.
 */
const files = import.meta.glob('../assets/{units,tiles,props}/*.svg', { eager: true, query: '?url', import: 'default' });

/** The URL of an SVG under src/assets (a data URI in the build). */
function svg(path) {
    const url = files[`../assets/${path}`];
    if (!url) {
        throw new Error(`Missing asset src/assets/${path}`);
    }

    return url;
}

export default {
    units: {
        imp: svg('units/imp.svg'),
        orc: svg('units/orc.svg'),
        warlock: svg('units/warlock.svg'),
        troll: svg('units/troll.svg'),
        mistress: svg('units/mistress.svg'),
        tunneller: svg('units/tunneller.svg'),
        archer: svg('units/archer.svg'),
        wizard: svg('units/wizard.svg'),
        knight: svg('units/knight.svg'),
        lord: svg('units/lord.svg'),
    },
    tiles: {
        earth: svg('tiles/earth.svg'),
        gold: svg('tiles/gold.svg'),
        gem: svg('tiles/gem.svg'),
        rock: svg('tiles/rock.svg'),
        floor: svg('tiles/floor.svg'),
        claimed: svg('tiles/claimed.svg'),
        wall: svg('tiles/wall.svg'),
    },
    props: {
        heart: svg('props/heart.svg'),
        portal: svg('props/portal.svg'),
        "portal-unclaimed": svg('props/portal-unclaimed.svg'),
        gate: svg('props/gate.svg'),
        chest: svg('props/chest.svg'),
        "treasury-pile": svg('props/treasury-pile.svg'),
        "lair-nest": svg('props/lair-nest.svg'),
        "hatchery-chicken": svg('props/hatchery-chicken.svg'),
        "training-dummy": svg('props/training-dummy.svg'),
        "library-shelf": svg('props/library-shelf.svg'),
    },
};
