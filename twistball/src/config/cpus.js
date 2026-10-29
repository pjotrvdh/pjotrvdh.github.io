/**
 * The kinds of computer player. Each one changes the level's opponent values (levels.js) in its own
 * way, so a level still gets harder from one to the next whichever kind you play. Pick one on the
 * title screen, or Auto to get a random one for every level (and for each CPU in CPU vs CPU).
 *   name     shown in the HUD and the calls
 *   about    one line for the title screen
 *   speed    multiplies how fast it moves (the level's opponentSpeed)
 *   aim      added to how far ahead it reads the ball (the level's opponentAim, kept between 0 and 1)
 *   follow   while the ball goes away: how far it follows the ball (0 = back to the centre, 1 = right behind it)
 *   spin     multiplies the spin it puts on returns (the level's opponentSpin)
 *   minSpin  spin it always adds, also on the first levels
 *   wild     chance that a return gets twice the spin: a sudden big curve
 *   angle    multiplies how sharply it angles returns towards the walls
 *   smash    multiplies the ball's speed on its returns
 */
export default {
    calm: {
        name: 'Calm',
        about: 'Steady, straight returns. Easy to read.',
        speed: 0.85,
        aim: 0,
        follow: 0,
        spin: 0.3,
        minSpin: 0,
        wild: 0,
        angle: 0.5,
        smash: 1,
    },
    aggressive: {
        name: 'Aggressive',
        about: 'Fast, hard and sharp. Smashes into the corners.',
        speed: 1.2,
        aim: 0.1,
        follow: 0.6,
        spin: 1.4,
        minSpin: 0.4,
        wild: 0.1,
        angle: 1.6,
        smash: 1.12,
    },
    trickster: {
        name: 'Trickster',
        about: 'Curves everything, and now and then a wild one.',
        speed: 0.95,
        aim: -0.05,
        follow: 0.3,
        spin: 2,
        minSpin: 0.6,
        wild: 0.3,
        angle: 1,
        smash: 1,
    },
    wall: {
        name: 'Wall',
        about: 'Reads the ball early and gets everything back, but plain.',
        speed: 1.15,
        aim: 0.25,
        follow: 0,
        spin: 0.2,
        minSpin: 0,
        wild: 0,
        angle: 0.6,
        smash: 0.95,
    },
};
