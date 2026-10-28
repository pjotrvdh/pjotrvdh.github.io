import './styles/game.css';
import './game/index.js';

// The commit this build was made from (see tools/vite.js).
const version = document.getElementById('version');
if (__BUILD_VERSION__ && version) {
    version.textContent = `${__BUILD_VERSION__.hash} · ${__BUILD_VERSION__.time}`;
    version.hidden = false;
}
