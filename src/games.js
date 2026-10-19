/**
 * The games on the Arcade index, newest first. Each game lives in a folder with the same name as
 * its slug: an npm workspace (listed in package.json) that builds to <slug>/dist/index.html and has
 * a 16:9 <slug>/cover.svg. The root build copies <slug>/dist to dist/<slug>.
 *
 * Plain data only: vite.config.js reads this file too.
 */
export default [
    {
        slug: 'underlord',
        title: 'Underlord',
        description: 'Dig into the dark, build rooms and attract creatures, then defend your Dungeon Heart against six waves of heroes. In the spirit of Dungeon Keeper.',
        tags: ['Strategy', 'Simulation'],
        added: '2026-10-15',
    },
];
