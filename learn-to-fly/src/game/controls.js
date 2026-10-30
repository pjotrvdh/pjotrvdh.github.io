import { createElement, Maximize, Minimize, Pause, Play, Settings, Volume1, Volume2, VolumeX } from 'lucide';
import { audio } from './audio.js';
import { options } from './state.js';

/*
 * The control bar in the top right corner: settings (day intro, control reminders), sound (music
 * and sound effects, each on or off; both off at first), pause and full screen. Keys: M switches all
 * sound on or off, P or Esc pauses, F toggles full screen. The settings are kept in localStorage
 * (`learn-to-fly-options`).
 */

const KEY = 'learn-to-fly-options';

function loadOptions() {
    try {
        const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
        // The old single mute switch is dropped: sound starts off until music or effects are switched on.
        delete saved.mute;
        Object.assign(options, saved);
    } catch {
        // No saved options.
    }
}

function saveOptions() {
    try {
        localStorage.setItem(KEY, JSON.stringify({ skipCutscenes: options.skipCutscenes, showControls: options.showControls, music: options.music, sfx: options.sfx }));
    } catch {
        // Private mode: the options last until the page closes.
    }
}

const icon = (node) => {
    const svg = createElement(node);
    svg.setAttribute('aria-hidden', 'true');
    return svg;
};

function iconButton(label, node) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ctl';
    b.title = label;
    b.setAttribute('aria-label', label);
    b.append(icon(node));
    return b;
}

function setIcon(button, node, label) {
    button.replaceChildren(icon(node));
    button.title = label;
    button.setAttribute('aria-label', label);
}

export function setupControls(player) {
    loadOptions();
    const bar = document.getElementById('controls');
    const state = { paused: false };

    const settings = iconButton('Settings', Settings);
    settings.setAttribute('aria-expanded', 'false');
    settings.setAttribute('aria-controls', 'settings');
    const sound = iconButton('Sound', VolumeX);
    sound.setAttribute('aria-expanded', 'false');
    sound.setAttribute('aria-controls', 'sound');
    const pause = iconButton('Pause (P)', Pause);
    const full = iconButton('Full screen (F)', Maximize);

    const panel = document.createElement('div');
    panel.id = 'settings';
    panel.className = 'settings';
    panel.hidden = true;
    const toggle = (text, get, set) => {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = get();
        input.addEventListener('change', () => {
            set(input.checked);
            saveOptions();
        });
        label.append(input, document.createTextNode(text));
        label.sync = () => {
            input.checked = get();
        };
        return label;
    };
    panel.append(
        toggle('Day intro', () => !options.skipCutscenes, (v) => { options.skipCutscenes = !v; }),
        toggle('Control reminders', () => options.showControls, (v) => { options.showControls = v; }),
    );

    const soundPanel = document.createElement('div');
    soundPanel.id = 'sound';
    soundPanel.className = 'settings';
    soundPanel.hidden = true;
    const applySound = () => {
        audio.setChannel('music', options.music);
        audio.setChannel('sfx', options.sfx);
        const on = Number(options.music) + Number(options.sfx);
        setIcon(sound, [VolumeX, Volume1, Volume2][on], ['Sound: off (M)', 'Sound: partly on (M)', 'Sound: on (M)'][on]);
    };
    const soundToggles = [
        toggle('Music', () => options.music, (v) => { options.music = v; applySound(); }),
        toggle('Sound effects', () => options.sfx, (v) => { options.sfx = v; applySound(); }),
    ];
    soundPanel.append(...soundToggles);

    bar.append(settings, sound, pause, full, panel, soundPanel);

    /** M: everything on when anything is off, else everything off. */
    const toggleSound = () => {
        const on = !(options.music && options.sfx);
        options.music = on;
        options.sfx = on;
        soundToggles.forEach((t) => t.sync());
        applySound();
        saveOptions();
    };
    const openPanel = (which) => {
        for (const [p, b] of [[panel, settings], [soundPanel, sound]]) {
            const open = p === which && p.hidden;
            p.hidden = !open;
            b.setAttribute('aria-expanded', String(open));
        }
    };
    const setPaused = (on) => {
        state.paused = on;
        audio.pause(on);
        setIcon(pause, on ? Play : Pause, on ? 'Resume (P)' : 'Pause (P)');
        document.body.classList.toggle('paused', on);
    };
    const toggleFull = () => {
        if (document.fullscreenElement) {
            document.exitFullscreen?.();
        } else {
            document.documentElement.requestFullscreen?.().catch(() => {});
        }
    };
    document.addEventListener('fullscreenchange', () => {
        const on = !!document.fullscreenElement;
        setIcon(full, on ? Minimize : Maximize, on ? 'Leave full screen (F)' : 'Full screen (F)');
    });
    if (!document.documentElement.requestFullscreen) {
        full.hidden = true;
    }

    settings.addEventListener('click', () => openPanel(panel));
    sound.addEventListener('click', () => openPanel(soundPanel));
    pause.addEventListener('click', () => setPaused(!state.paused));
    full.addEventListener('click', toggleFull);
    document.addEventListener('pointerdown', (e) => {
        if (!bar.contains(e.target)) {
            openPanel(null);
        }
    });
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) {
            return;
        }
        if (e.code === 'KeyM') {
            toggleSound();
        } else if (e.code === 'KeyP' || (e.code === 'Escape' && !document.fullscreenElement)) {
            setPaused(!state.paused);
        } else if (e.code === 'KeyF') {
            toggleFull();
        }
    });
    // Leaving the tab pauses.
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && !state.paused) {
            setPaused(true);
        }
    });

    applySound();
    void player;
    return state;
}
