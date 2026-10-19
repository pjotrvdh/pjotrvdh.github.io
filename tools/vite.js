import { execSync } from 'node:child_process';

/*
 * Vite helpers shared by the Arcade index (vite.config.js in the root) and every game
 * (<game>/vite.config.js): each page builds to one self-contained HTML file.
 */

/**
 * The short hash and commit time (Europe/Amsterdam) of HEAD, or null outside a git checkout.
 *
 * @returns {{hash: string, time: string}|null}
 */
export function buildVersion() {
    try {
        const [hash, committedAt] = execSync('git log -1 --format="%h %cI"', { encoding: 'utf8' }).trim().split(' ');
        const time = new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'Europe/Amsterdam',
            dateStyle: 'short',
            timeStyle: 'short',
        }).format(new Date(committedAt));

        return { hash, time };
    } catch {
        return null;
    }
}

/**
 * A data URI for a built asset: SVGs as URL-encoded text, everything else as base64.
 *
 * @param {string} fileName
 * @param {string|Uint8Array} source
 * @returns {string}
 */
function dataUri(fileName, source) {
    if (fileName.endsWith('.svg')) {
        return `data:image/svg+xml,${encodeURIComponent(String(typeof source === 'string' ? source : new TextDecoder().decode(source)))}`;
    }

    const types = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', ico: 'image/x-icon', woff2: 'font/woff2' };
    const type = types[fileName.split('.').pop()] ?? 'application/octet-stream';

    return `data:${type};base64,${Buffer.from(source).toString('base64')}`;
}

/**
 * Turns the build into one self-contained dist/index.html: the bundled JS and CSS are written into the
 * page, the SVGs the game imports are data URIs (see assetsInlineLimit), and files the page links to,
 * such as the favicon, become data URIs too.
 *
 * @returns {import('vite').Plugin}
 */
export function singleFile() {
    return {
        name: 'underlord-single-file',
        enforce: 'post',
        apply: 'build',
        generateBundle(_options, bundle) {
            const page = Object.values(bundle).find((file) => file.fileName === 'index.html');
            let html = String(page.source);

            for (const [fileName, file] of Object.entries(bundle)) {
                if (file === page) {
                    continue;
                }

                const name = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                if (file.type === 'chunk') {
                    // Keep "</script" inside the code from closing the inline script early.
                    const code = file.code.replace(/<\/script/gi, '<\\/script');
                    html = html.replace(new RegExp(`<script([^>]*?) src="\\./${name}"></script>`), (_tag, attributes) => `<script${attributes}>${code}</script>`);
                } else if (fileName.endsWith('.css')) {
                    html = html.replace(new RegExp(`<link rel="stylesheet"[^>]*? href="\\./${name}">`), () => `<style>${file.source}</style>`);
                } else if (html.includes(`./${fileName}`)) {
                    // An asset the page itself links to, such as the favicon.
                    html = html.replaceAll(`./${fileName}`, dataUri(fileName, file.source));
                } else {
                    this.error(`${fileName} would be a separate file; it should be inlined.`);
                }

                delete bundle[fileName];
            }

            page.source = html.replace(/ crossorigin(?=[ >])/g, '');
        },
    };
}

// `ddev start`: Vite runs inside the DDEV web container and is served through the DDEV router
// on https://<project>.ddev.site (see .ddev/config.yaml), with hot reloading over wss.
export const ddevHost = process.env.IS_DDEV_PROJECT ? process.env.DDEV_HOSTNAME?.split(',')[0] : null;

/**
 * The Vite config every page shares: relative paths, everything inlined into one HTML file, the
 * build version as __BUILD_VERSION__, and the DDEV dev server when running in DDEV.
 *
 * @returns {import('vite').UserConfig}
 */
export function singleFilePage() {
    return {
        // Relative paths, so nothing in the page depends on where it is served from.
        base: './',
        // One HTML file with everything in it: see singleFile().
        build: {
            assetsInlineLimit: () => true,
            cssCodeSplit: false,
            modulePreload: { polyfill: false },
        },
        plugins: [singleFile()],
        server: ddevHost ? {
            host: true,
            port: 5173,
            strictPort: true,
            allowedHosts: [ddevHost],
            hmr: { host: ddevHost, protocol: 'wss', clientPort: 443 },
        } : {},
        define: {
            __BUILD_VERSION__: JSON.stringify(buildVersion()),
        },
    };
}
