import './styles/arcade.css';
import { createElement, CalendarPlus, Code, Cpu, ExternalLink, Gamepad2, LayoutGrid, Play, Search, Swords, Tag, Trophy } from 'lucide';
import games from './games.js';

/** A Lucide icon as an inline SVG. Decorative: the text next to it says the same. */
const icon = (node) => createElement(node, { class: 'icon', 'aria-hidden': 'true', focusable: 'false' });

/** The icon for a genre; unknown genres get a tag. */
const GENRE_ICONS = { Arcade: Gamepad2, Sports: Trophy, Strategy: Swords, Simulation: Cpu };
const genreIcon = (genre) => icon(GENRE_ICONS[genre] ?? Tag);

/** Each game's 16:9 cover, <slug>/cover.svg (a data URI in the build). */
const covers = import.meta.glob('../*/cover.svg', { eager: true, query: '?url', import: 'default' });

const list = document.getElementById('games');
const search = document.getElementById('search');
const genres = document.getElementById('genres');
const count = document.getElementById('count');
const empty = document.getElementById('empty');
let genre = null;

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** A text node or element, built without innerHTML so game data is never parsed as HTML. */
function el(tag, attributes = {}, ...children) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) {
        node.setAttribute(name, value);
    }
    node.append(...children);

    return node;
}

function card(game) {
    // Every game opens in a new tab, so the Arcade stays open behind it.
    const link = { href: `./${game.slug}/`, target: '_blank', rel: 'noopener' };
    const cover = covers[`../${game.slug}/cover.svg`];

    return el('li', { class: 'game' }, el('div', { class: 'frame' },
        el('a', { class: 'cover', ...link, tabindex: '-1', 'aria-hidden': 'true' },
            cover ? el('img', { src: cover, alt: '', width: '480', height: '270' }) : ''),
        el('div', { class: 'body' },
            el('h2', {}, el('a', { ...link, 'aria-label': `${game.title} (opens in a new tab)` }, game.title)),
            el('p', { class: 'added' }, icon(CalendarPlus), `Added ${dateFormat.format(new Date(game.added))}`),
            el('p', { class: 'description' }, game.description),
            el('ul', { class: 'tags', 'aria-label': 'Genres' }, ...game.tags.map((tag) => el('li', {}, genreIcon(tag), tag))),
            el('a', { class: 'play', ...link, 'aria-label': `Play ${game.title} (opens in a new tab)` }, icon(Play), 'Play', icon(ExternalLink)))));
}

function matches(game) {
    const query = search.value.trim().toLowerCase();
    const text = [game.title, game.description, ...game.tags].join(' ').toLowerCase();

    return (!genre || game.tags.includes(genre)) && (!query || text.includes(query));
}

function render() {
    const shown = games.filter(matches);
    list.replaceChildren(...shown.map(card));
    empty.hidden = shown.length > 0;
    count.replaceChildren(icon(Gamepad2), `${shown.length} of ${games.length} ${games.length === 1 ? 'game' : 'games'}`);
    for (const button of genres.children) {
        button.setAttribute('aria-pressed', String(button.dataset.genre === (genre ?? '')));
    }
}

function genreButton(label, value) {
    const button = el('button', { type: 'button', 'data-genre': value }, value ? genreIcon(value) : icon(LayoutGrid), label);
    button.addEventListener('click', () => {
        genre = value || null;
        render();
    });

    return button;
}

// Icons in the static parts of the page.
document.querySelector('.search span').prepend(icon(Search));
document.querySelector('footer a').prepend(icon(Code));

const allGenres = [...new Set(games.flatMap((game) => game.tags))].sort();
genres.append(genreButton('All', ''), ...allGenres.map((tag) => genreButton(tag, tag)));
search.addEventListener('input', render);
render();

// The commit this build was made from (see tools/vite.js).
const version = document.getElementById('version');
if (__BUILD_VERSION__) {
    version.textContent = `Build ${__BUILD_VERSION__.hash} · ${__BUILD_VERSION__.time}`;
    version.hidden = false;
}
