/**
 * How the skater moves (src/game/skater.js). Arcade, not realistic: tune for feel. Units are metres,
 * seconds and radians. Every value can be changed live in the tuning panel (`?tune`).
 */
export default {
    /** Gravity in the air, m/s². Higher feels snappier, lower floatier. */
    gravity: 20,
    /** Share of gravity that pulls along ramps and transitions: below 1 keeps speed going up a quarter pipe. */
    slopeGravity: 0.7,

    /** Acceleration while pushing, m/s². */
    pushAccel: 7,
    /** Pushing stops adding speed above this, m/s. Ramps can take you faster. */
    pushSpeed: 9,
    /** Rolling resistance when not pushing, m/s². */
    coastDrag: 0.35,
    /** Braking deceleration, m/s². */
    brakeDecel: 9,
    /** Top speed anywhere, m/s. */
    maxSpeed: 16,

    /** Turn rate when (almost) standing still, rad/s. */
    turnRate: 3,
    /** Turn rate at top speed, rad/s: turning gets wider the faster you go. */
    turnRateFast: 1.6,
    /** How fast steering follows the input, 1/s: lower is smoother, higher is twitchier. */
    steerResponse: 12,

    /** Upward speed of a tapped ollie, m/s (≈ 0.75 m high at the gravity above). */
    ollieSpeed: 5.5,
    /** Upward speed of a fully charged ollie (jump held), m/s (≈ 1.4 m high). */
    ollieChargedSpeed: 7.5,
    /** Seconds of holding jump for a fully charged ollie. */
    ollieChargeTime: 0.35,
    /** Seconds after rolling off an edge in which an ollie still works. */
    coyoteTime: 0.12,

    /** Spin speed in the air, rad/s (≈ a 360 in 0.9 s). */
    spinRate: 7,
    /** Largest angle between the board and the direction of travel that still lands, degrees. Fakie counts too. */
    landAngle: 40,
    /** Below this horizontal speed (m/s) any landing angle is fine. */
    landAnySpeed: 1.5,
    /** Share of speed kept on landing. */
    landKeep: 0.95,

    /** Highest step the wheels roll up without stopping, m. Higher edges are walls. */
    stepUp: 0.12,
    /** Ground that falls away more than this below the board's path makes it leave the ground, m. */
    dropSnap: 0.06,
    /** The same on transitions, which the board sticks to unless the ground falls away more than this, m. */
    vertStick: 0.3,
    /** Over a crest (a kicker's lip, the top of a funbox) you take off when the ground bends away faster than this many times gravity. */
    crest: 1.5,
    /** Seconds after taking off in which rising ground under the board lifts it rather than landing it. */
    liftTime: 0.08,
    /** Distance ahead of the board's centre that is checked for walls, m. */
    probe: 0.45,
    /** Hitting a wall head-on faster than this bails, m/s. */
    wallBailSpeed: 8,
    /** Share of speed bounced back from a head-on wall. */
    wallBounce: 0.25,

    /** Steepness (rise per metre) of a quarter-pipe transition at which you fly straight up out of it. */
    vertLaunchSlope: 2.2,
    /** Upward speed out of a quarter pipe, as a share of the speed you rode up with. */
    vertBoost: 1.15,
    /** Largest angle between the board and straight up or down the ramp that still lands back in a quarter pipe, degrees. */
    vertLandAngle: 70,

    /** Seconds on the ground after a bail before you get up. */
    bailTime: 1.6,
    /** Deceleration while sliding after a bail, m/s². */
    bailDecel: 10,
};
