import { createElement, Maximize, Minimize, Pause, Play, Settings, Volume2, VolumeX } from 'lucide';
import { audio } from './audio.js';
import { options } from './state.js';

/*
 * The control bar in the top right corner: settings (day intro, control reminders), sound,
 * pause and full screen. Keys: M mutes, P or
 * Esc pauses, F toggles full screen. The settings are kept in localStorage (`learn-to-fly-options`).
 */

const KEY = 'learn-to-fly-options';

function loadOptions() {
    try {
        Object.assign(options, JSON.parse(localStorage.getItem(KEY) ?? '{}'));
    } catch {
        // No saved options.
    }
}

function saveOptions() {
    try {
        localStorage.setItem(KEY, JSON.stringify({ skipCutscenes: options.skipCutscenes, showControls: options.showControls, mute: options.mute }));
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
    const sound = iconButton('Sound off (M)', Volume2);
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
        return label;
    };
    panel.append(
        toggle('Day intro', () => !options.skipCutscenes, (v) => { options.skipCutscenes = !v; }),
        toggle('Control reminders', () => options.showControls, (v) => { options.showControls = v; }),
    );

    bar.append(settings, sound, pause, full, panel);

    const applySound = () => {
        audio.setVolume(options.mute ? 0 : 100);
        setIcon(sound, options.mute ? VolumeX : Volume2, options.mute ? 'Sound on (M)' : 'Sound off (M)');
        sound.setAttribute('aria-pressed', String(options.mute));
    };
    const toggleSound = () => {
        options.mute = !options.mute;
        applySound();
        saveOptions();
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

    settings.addEventListener('click', () => {
        panel.hidden = !panel.hidden;
        settings.setAttribute('aria-expanded', String(!panel.hidden));
    });
    sound.addEventListener('click', toggleSound);
    pause.addEventListener('click', () => setPaused(!state.paused));
    full.addEventListener('click', toggleFull);
    document.addEventListener('pointerdown', (e) => {
        if (!panel.hidden && !bar.contains(e.target)) {
            panel.hidden = true;
            settings.setAttribute('aria-expanded', 'false');
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
