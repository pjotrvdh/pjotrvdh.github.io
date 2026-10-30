/*
 * One tab at a time: a game that keeps its running state in localStorage (shared/storage.js) holds a
 * Web Lock for as long as the tab is open, so two tabs never write over each other's game. While
 * another tab has it, a modal covers the whole page and swallows keys and clicks; it goes away when
 * that tab closes, or when the player picks "Play here", which takes the game over (the other tab then
 * shows the modal). Without Web Locks every tab simply keeps the game.
 */

const CSS = `
.one-tab{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:16px;background:rgba(6,8,12,.78);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:#f3f1ec}
.one-tab[hidden]{display:none}
.one-tab-card{width:min(480px,100%);padding:28px 28px 24px;border:1px solid rgba(255,255,255,.16);border-radius:18px;background:#16181d;box-shadow:0 24px 60px rgba(0,0,0,.5);text-align:center}
.one-tab-card h2{margin:0 0 10px;font-size:24px;line-height:1.25}
.one-tab-card p{margin:0 0 12px;color:#cfd3da}
.one-tab-card button{margin-top:8px;padding:10px 24px;border:0;border-radius:10px;background:var(--one-tab-accent,#ffd257);color:var(--one-tab-ink,#14161a);font:600 17px system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer}
.one-tab-card button:focus-visible{outline:3px solid #fff;outline-offset:3px}
`;

const BLOCKED = ['keydown', 'keyup', 'keypress', 'pointerdown', 'pointerup', 'pointermove', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'wheel', 'touchstart', 'touchmove', 'touchend'];

/**
 * Keeps the game in this tab only. `name` is the lock (and the game's storage prefix), `game` its
 * title for the modal, `accent` and `ink` the button's colours (keep them at WCAG AA). onOwner(again) runs when this tab gets the game
 * (again: it had lost it before, so the game should read localStorage back); onLost() when another
 * tab takes it.
 */
export function oneTab(name, { game, accent, ink, onOwner, onLost = () => {} }) {
    if (!navigator.locks) {
        onOwner(false);
        return;
    }
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.append(style);
    const modal = document.createElement('div');
    modal.className = 'one-tab';
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'oneTabTitle');
    if (accent) {
        modal.style.setProperty('--one-tab-accent', accent);
    }
    if (ink) {
        modal.style.setProperty('--one-tab-ink', ink);
    }
    modal.innerHTML = '<div class="one-tab-card"><h2 id="oneTabTitle"></h2><p></p><p>Close the other tab and this one takes over, or play here instead.</p><button type="button">Play here</button></div>';
    modal.querySelector('h2').textContent = `${game} is open in another tab`;
    modal.querySelector('p').textContent = `Only one tab can play ${game} at a time, so the two never write over each other's game.`;
    const button = modal.querySelector('button');
    document.body.append(modal);

    // Keys and clicks outside the modal don't reach the game while it shows.
    const block = (e) => {
        if (!modal.hidden && !modal.contains(e.target)) {
            e.stopImmediatePropagation();
            e.preventDefault();
        }
    };
    for (const type of BLOCKED) {
        window.addEventListener(type, block, { capture: true, passive: false });
    }

    let owner = false;
    let again = false;
    let waiting = null;

    const keep = () => {
        waiting = null;
        owner = true;
        modal.hidden = true;
        onOwner(again);
        again = true;
        return new Promise(() => {});
    };
    // A held lock that is stolen, and a wait that is called off, both end in a rejection.
    const ended = () => {
        if (owner) {
            owner = false;
            show();
            onLost();
            wait();
        }
    };
    const wait = () => {
        waiting = new AbortController();
        navigator.locks.request(name, { signal: waiting.signal }, keep).catch(ended);
    };
    const show = () => {
        modal.hidden = false;
        button.focus();
    };
    button.addEventListener('click', () => {
        waiting?.abort();
        navigator.locks.request(name, { steal: true }, keep).catch(ended);
    });

    navigator.locks.request(name, { ifAvailable: true }, (lock) => {
        if (lock) {
            return keep();
        }
        show();
        wait();
        return undefined;
    }).catch(ended);
}
