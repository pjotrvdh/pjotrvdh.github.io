/** The rules of a game. Times are in seconds. */
export default {
    /** Lives you start the game with; they carry over between levels. */
    playerLives: 5,
    /** Lives the opponent has in each level: take them all to clear the level. */
    opponentLives: 3,
    /** How much of your paddle's speed becomes spin on the ball (before the level's curve factor). */
    spinFromPaddle: 0.55,
    /** How much hitting off-centre angles the ball: sideways speed per unit of distance from the centre. */
    angleFromOffset: 1.6,
    /** Spin left after one second; the curve fades out over a rally. */
    spinDecayPerSecond: 0.55,
    /** The ball gets this much faster with every return in a rally. */
    rallySpeedUp: 1.02,
    /** Lives each side has in a 2-player or CPU vs CPU match. */
    matchLives: 5,
    /** The speed (level) a 2-player or CPU vs CPU match starts on, 1 to 10. */
    matchLevel: 4,
    /** Seconds the exploding paddle gets before the end screen. */
    explosionTime: 1.6,
    /** Seconds of countdown (3, 2, 1) before every serve; then the ball serves itself. */
    serveCountdown: 3,
    /** Seconds before the next CPU vs CPU match starts on its own. */
    demoRestartDelay: 3,
    /** Online: seconds without a message from the other player before the match counts as abandoned. */
    onlineTimeout: 4,
    /** How many entries the local high score list keeps. */
    highScores: 10,
};
