/** Points. Every return you make scores; a good return scores a bonus on top. */
export default {
    /** Every ball you return. */
    hit: 100,
    /** A return with a clear curve on it. */
    curveBonus: 50,
    /** A return with a huge curve on it. */
    superCurveBonus: 150,
    /** A return hit close to the centre of your paddle. */
    accuracyBonus: 100,
    /** Spin (in tunnel units per second squared) that counts as a curve. */
    curveThreshold: 1.2,
    /** Spin that counts as a super curve. */
    superCurveThreshold: 2.6,
    /** How close to the centre counts as accurate, as a share of the paddle's half size. */
    accuracyZone: 0.25,
    /** The level bonus you get for clearing a level fast: it starts here... */
    levelBonus: 3000,
    /** ...and drops by this much every second the ball is in play. */
    levelBonusPerSecond: 40,
};
