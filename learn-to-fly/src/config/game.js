/** The end of the game and the score, from the original's game frame. */
export default {
    /** Flying past this distance (ft) finishes the game: the penguin crashes through the iceberg. */
    finishDistance: 6000,
    /** Cash for finishing. */
    finishBonus: 10000,
    /**
     * Cash after a flight: (distance + altitude) × duration / 10, all rounded. The score board shows
     * the duration as a multiplier (duration / 10), at most 3.
     */
    scoreDivisor: 10,
    maxBoardDuration: 30,
    /**
     * End texts by number of days: the first entry whose `over` is below the days played picks the
     * frame of the comment clip ("Were you even trying?" … "Incredible !").
     */
    endComments: [
        { over: 50, frame: 1 },
        { over: 25, frame: 2 },
        { over: 20, frame: 3 },
        { over: 15, frame: 4 },
        { over: -1, frame: 5 },
    ],
};
