import { existsSync, rmSync } from 'node:fs';
import { defineConfig } from 'vite';
import games from './src/games.js';
import { copyFolder, singleFilePage } from './tools/vite.js';

/**
 * Copies every game's own build (<slug>/dist, made by `npm run build --workspaces`) into dist/<slug>,
 * next to the Arcade index.
 *
 * @returns {import('vite').Plugin}
 */
function collectGames() {
    return {
        name: 'arcade-collect-games',
        apply: 'build',
        closeBundle() {
            for (const { slug } of games) {
                if (!existsSync(`${slug}/dist/index.html`)) {
                    throw new Error(`${slug} has not been built yet: run \`npm run build\` in the root.`);
                }

                rmSync(`dist/${slug}`, { recursive: true, force: true });
                copyFolder(`${slug}/dist`, `dist/${slug}`);
            }
        },
    };
}

const page = singleFilePage();

// The Arcade index builds to one self-contained dist/index.html; `npm run dev` also serves every game
// at /<slug>/.
export default defineConfig({
    ...page,
    plugins: [...page.plugins, collectGames()],
});
