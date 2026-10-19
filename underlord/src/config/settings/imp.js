export default {
    /** Create Imp costs this, plus perImp for every imp you already have. */
    baseCost: 100,
    /** Extra cost of Create Imp per imp you already have. */
    perImp: 25,
    /** Imps you start with. */
    startCount: 4,
    /** How far imps can see, in tiles. */
    vision: 4,
    /** Seconds after the last hit on the Heart that imps keep defending it (Dungeon Keeper: imps defend the Heart). */
    defendTime: 5,
    /** Imps within this many tiles of the Heart come to defend it; they attack heroes within settings.heart.zapRange of it. */
    defendRange: 10,
};
