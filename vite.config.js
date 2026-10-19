import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { defineConfig } from 'vite';
import games from './src/games.js';
import { singleFilePage } from './tools/vite.js';

/**
 * Copies a folder file by file. (fs.cpSync fails on folders in the DDEV container's mounted file system.)
 *
 * @param {string} from
 * @param {string} to
 */
function copyFolder(from, to) {
    mkdirSync(to, { recursive: true });
    for (const entry of readdirSync(from, { withFileTypes: true })) {
        const source = `${from}/${entry.name}`;
        const target = `${to}/${entry.name}`;
        if (entry.isDirectory()) {
            copyFolder(source, target);
        } else {
            copyFileSync(source, target);
        }
    }
}

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
