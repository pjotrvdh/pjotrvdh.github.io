/**
 * The flight, from the original's game frame. Units are the original's: pixels and frames
 * (33 frames per second); 50 px is 1 ft on the HUD, and the speed in px per frame is shown as mph.
 */
export default {
    /** Speed when the slide starts (px per frame). */
    startSpeed: 5,
    /** How far ahead (px) the slope is sampled to find the ramp's angle. */
    lookAhead: 40,
    /** On flat or rising ramp parts the slide still gains `flatSlide` × the slide upgrade per frame. */
    flatSlide: 20,
    /** Gravity per frame. */
    gravity: 0.4,
    /** Degrees per frame the arrow keys turn the penguin, plus up to `extraSpin` when slow. */
    spin: 1,
    extraSpin: 1.5,
    /** The angle the penguin can be turned to, up and down (degrees from horizontal). */
    maxAngle: 85,
    /** How fast the glide ratio follows the speed (per frame), and its minimum. */
    glideAdjust: 0.05,
    minGlide: 0,
    /** Hitting the sea faster than this and flat enough bounces you back up. */
    bounce: {
        minSpeed: 20,
        minAngle: 75,
        maxAngle: 105,
        friction: 0.8,
        power: -0.18,
        max: -18,
    },
    /** In the water: friction per frame and buoyancy (negative gravity). */
    sea: {
        friction: 0.91,
        buoyancy: -0.9,
        /** You stop (and the score board shows) once the horizontal speed is below this. */
        stopSpeed: 0.7,
    },
    /** The duration counter: starts at 9.5 and adds 0.02 per frame in the air. */
    duration: { start: 9.5, perFrame: 0.02 },
    /** Pixels per foot (distance and altitude). */
    pixelsPerFoot: 50,
};
