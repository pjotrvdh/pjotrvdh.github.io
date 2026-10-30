import { createElement, Maximize, Minimize, Pause, Play, Settings, Volume1, Volume2, VolumeX } from 'lucide';
import { audio } from './audio.js';
import { options } from './state.js';
import { readBool, readNumber, write } from './storage.js';

/*
 * The control bar in the top right corner: settings (day intro, control reminders), sound (a
 * volume slider each for music and sound effects; music starts off), pause and full screen. Keys: M
 * mutes everything and brings the volumes back, P or Esc pauses, F toggles full screen. The settings
 * are kept in localStorage, one key each (storage.js): learn-to-fly.option.dayIntro,
 * .option.controlReminders, .option.music and .option.sfx (0-100), and while M has muted everything
 * .option.unmuteMusic and .option.unmuteSfx.
 */

function loadOptions() {
    options.skipCutscenes = !readBool('option.dayIntro', !options.skipCutscenes);
    options.showControls = readBool('option.controlReminders', options.showControls);
    options.music = readNumber('option.music', options.music, 0, 100);
    options.sfx = readNumber('option.sfx', options.sfx, 0, 100);
    const music = readNumber('option.unmuteMusic', null, 0, 100);
    const sfx = readNumber('option.unmuteSfx', null, 0, 100);
    options.unmute = music === null && sfx === null ? null : { music: music ?? 0, sfx: sfx ?? 0 };
}

function saveOptions() {
    write('option.dayIntro', !options.skipCutscenes);
    write('option.controlReminders', options.showControls);
    write('option.music', options.music);
    write('option.sfx', options.sfx);
    write('option.unmuteMusic', options.unmute?.music);
    write('option.unmuteSfx', options.unmute?.sfx);
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
        audio.setChannel('music', options.music / 100);
        audio.setChannel('sfx', options.sfx / 100);
        const loudest = Math.max(options.music, options.sfx);
        const level = loudest === 0 ? 0 : loudest < 50 ? 1 : 2;
        setIcon(sound, [VolumeX, Volume1, Volume2][level], loudest === 0 ? 'Sound: off (M)' : 'Sound (M mutes)');
    };
    /** A volume slider, 0..100 in steps of 5, with its value shown next to it. */
    const slider = (text, key) => {
        const label = document.createElement('label');
        label.className = 'volume';
        const name = document.createElement('span');
        name.textContent = text;
        const input = document.createElement('input');
        input.type = 'range';
        input.min = '0';
        input.max = '100';
        input.step = '5';
        const value = document.createElement('output');
        const show = () => {
            input.value = String(options[key]);
            value.textContent = `${options[key]}%`;
            input.setAttribute('aria-valuetext', `${options[key]} percent`);
        };
        input.addEventListener('input', () => {
            options[key] = Number(input.value);
            options.unmute = null;
            show();
            applySound();
            saveOptions();
        });
        label.append(name, input, value);
        label.sync = show;
        show();
        return label;
    };
    const soundSliders = [slider('Music', 'music'), slider('Sound effects', 'sfx')];
    soundPanel.append(...soundSliders);

    bar.append(settings, sound, pause, full, panel, soundPanel);

    /** M: mutes everything, and the next time brings the volumes back (or full volume if there were none). */
    const toggleSound = () => {
        if (options.music || options.sfx) {
            options.unmute = { music: options.music, sfx: options.sfx };
            options.music = 0;
            options.sfx = 0;
        } else {
            const back = options.unmute ?? { music: 100, sfx: 100 };
            options.music = back.music;
            options.sfx = back.sfx;
            options.unmute = null;
        }
        soundSliders.forEach((s) => s.sync());
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
