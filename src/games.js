/**
 * The games on the Arcade index, newest first. Each game lives in a folder with the same name as
 * its slug: an npm workspace (listed in package.json) that builds to <slug>/dist/index.html and has
 * a 16:9 <slug>/cover.svg. The root build copies <slug>/dist to dist/<slug>.
 *
 * Plain data only: vite.config.js reads this file too.
 */
export default [
    {
        slug: 'pro-skater',
        title: "Phony Bonk's Pro Skater",
        description: 'Arcade skateboarding in a low-poly park: push, carve, ollie over rails and fly out of quarter pipes, with keyboard or gamepad.',
        tags: ['Sports', 'Arcade'],
        added: '2026-10-28',
    },
    {
        slug: 'twistball',
        title: 'Twistball',
        description: 'Pong, but with a twist: down a neon tunnel. Move your paddle as you hit the ball to curve it past the opponent, through ten levels that get faster and wilder.',
        tags: ['Arcade', 'Sports'],
        added: '2026-10-19',
    },
    {
        slug: 'underlord',
        title: 'Underlord',
        description: 'Dig into the dark, build rooms and attract creatures, then defend your Dungeon Heart against six waves of heroes. In the spirit of Dungeon Keeper.',
        tags: ['Strategy', 'Simulation'],
        added: '2026-10-15',
    },
];
