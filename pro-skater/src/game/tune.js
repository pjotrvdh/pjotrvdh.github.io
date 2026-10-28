/**
 * The tuning panel, shown with `?tune` in the URL: a slider for every number in config/physics.js and
 * config/camera.js, changed live while skating. "Copy changes" puts the changed values on the
 * clipboard, to paste into those files.
 */
const GROUPS = ['physics', 'camera'];

/** @param {object} config the game config (changed in place) */
export function createTunePanel(config) {
    const defaults = structuredClone(Object.fromEntries(GROUPS.map((group) => [group, config[group]])));
    const panel = document.createElement('aside');
    panel.className = 'tune';
    panel.setAttribute('aria-label', 'Tuning');

    for (const group of GROUPS) {
        const heading = document.createElement('h2');
        heading.textContent = group;
        panel.append(heading);
        for (const [key, value] of Object.entries(config[group])) {
            if (typeof value !== 'number') {
                continue;
            }
            const label = document.createElement('label');
            const name = document.createElement('span');
            name.textContent = key;
            const output = document.createElement('output');
            output.textContent = String(value);
            const input = document.createElement('input');
            input.type = 'range';
            input.min = '0';
            input.max = String(value > 0 ? value * 3 : 1);
            input.step = String(value >= 10 ? 0.5 : value >= 1 ? 0.05 : 0.005);
            input.value = String(value);
            input.addEventListener('input', () => {
                config[group][key] = Number(input.value);
                output.textContent = input.value;
            });
            // Keys on a slider would also steer the skater.
            input.addEventListener('keydown', (event) => event.stopPropagation());
            label.append(name, output, input);
            panel.append(label);
        }
    }

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = 'Copy changes';
    copy.addEventListener('click', async () => {
        const changes = {};
        for (const group of GROUPS) {
            for (const [key, value] of Object.entries(config[group])) {
                if (value !== defaults[group][key]) {
                    (changes[group] ??= {})[key] = value;
                }
            }
        }
        await navigator.clipboard?.writeText(JSON.stringify(changes, null, 4));
        copy.textContent = 'Copied';
        setTimeout(() => {
            copy.textContent = 'Copy changes';
        }, 1200);
    });
    panel.append(copy);
    document.body.append(panel);
}
