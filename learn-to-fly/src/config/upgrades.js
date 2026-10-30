/**
 * The shop: every upgrade, its effect per level and its price, exactly as in the original
 * (the `s…` and `c…` arrays of its init frame). Level 1 is what you start with; `prices[i]` buys
 * level i + 2. The shop bars (rh1, rf1, re1, rp1) are 25 px per level, the glider and rocket
 * pictures (gl1, ro1) 90 px per item.
 */
export default {
    /** Ramp height: how far the ramp's foot is above the sea (px; 50 px = 1 ft). Original `srh`, `crh`. */
    rampHeight: {
        values: [25, 75, 125, 175, 250, 350, 500, 700, 1000, 1400, 2000],
        prices: [10, 30, 50, 90, 175, 300, 600, 1000, 2000, 4000],
    },
    /** Ramp slide: how much of the slope's drop turns into speed per frame. Original `srf`, `crf`. */
    rampSlide: {
        values: [0.015, 0.025, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1, 0.11, 0.12],
        prices: [15, 45, 80, 150, 400, 750, 1500, 3500, 6000, 10000],
    },
    /** Aerodynamics: the air friction while flying (lower is better). Original `sre`, `cre`. */
    aerodynamics: {
        values: [0.065, 0.061, 0.057, 0.053, 0.049, 0.046, 0.043, 0.04, 0.038, 0.036, 0.034],
        prices: [10, 30, 50, 100, 175, 375, 800, 2000, 4000, 6500],
    },
    /**
     * Gliders: level 1 is none, then three gliders. Original `sgl` … `sgl4`, `cgl`.
     * - sink: slope (tan) of the angle the glider settles at; 0 = none.
     * - fallSpeed / glideSpeed: below fallSpeed the glider does not carry you, at glideSpeed it fully does.
     * - criticalSpeed: above it the air drag grows fast; also the top of the HUD speed meter.
     * - altitudeScale: the top of the HUD altitude meter (ft).
     */
    gliders: {
        values: [
            { sink: 0, fallSpeed: 1000, glideSpeed: 1000, criticalSpeed: 50, altitudeScale: 1 },
            { sink: 1 / 12, fallSpeed: 0, glideSpeed: 5, criticalSpeed: 55, altitudeScale: 60 },
            { sink: 1 / 24, fallSpeed: 0, glideSpeed: 6, criticalSpeed: 100, altitudeScale: 500 },
            { sink: 1 / 36, fallSpeed: 0, glideSpeed: 7, criticalSpeed: 200, altitudeScale: 200 },
        ],
        prices: [50, 1000, 5000],
        /** Names of levels 2-4 (the shop's cards, the ramp menu). */
        names: ['Beat-up glider', 'Hang glider', 'Sail plane'],
    },
    /** Rockets: level 1 is none; the thrust added per frame while Space is held. Original `sro`, `cro`. */
    rockets: {
        values: [0, 0.45, 0.9, 1.5],
        prices: [250, 2000, 10000],
        /** Names of levels 2-4. */
        names: ['Penguin rocket', 'Double rocket', 'Mega rocket'],
    },
    /** Rocket fuel: frames of thrust. Only for sale once you have a rocket. Original `srp`, `crp`. */
    fuel: {
        values: [30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 175],
        prices: [50, 100, 150, 300, 600, 1000, 2000, 3500, 6000, 10000],
    },
};
