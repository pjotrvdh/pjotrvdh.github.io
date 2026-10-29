/**
 * What a unit's figure shows for what the unit does: the activity (activityOf()), the Rig_Medium clip
 * that plays for it (CLIPS, per unit overridable with `clips` in assets.js) and what its hands hold then
 * (PROPS, itemShown()).
 */

/** Which Rig_Medium clip plays for which activity. */
export const CLIPS = { idle: 'Idle_A', guard: 'Idle_B', walk: 'Walking_A', run: 'Running_A', attack: 'Melee_Unarmed_Attack_Punch_A', dig: 'Pickaxing', claim: 'Working_A', reinforce: 'Hammering', train: 'Melee_1H_Attack_Chop', study: 'Holding_A', eat: 'Use_Item', sleep: 'Lie_Idle', sit: 'Sit_Floor_Idle', stun: 'Hit_B', hurt: 'Hit_A', held: 'Jump_Idle', cheer: 'Cheering', wave: 'Waving', die: 'Death_A' };

/** Activities whose clip plays once and holds its last pose. */
export const ONCE = new Set(['die']);

/**
 * The props a unit holds for one activity, in place of its own things: an open book to study, a steak
 * to eat, a hammer to reinforce, a pick to dig (units with a tool of their own dig with that). `turn`
 * (radians, x y z), `at` (a shift from the hand, in the hand's own units) and `scale` fit the model in
 * the hand.
 */
export const PROPS = {
    book: {
        during: 'study',
        turn: [Math.PI, -Math.PI / 2, 0],
        at: [0, 0.3, -0.35],
        scale: 1
    },
    steak: {
        during: 'eat',
        turn: [Math.PI / 2, 0, 0],
        at: [0.2, 0, -0.1],
        scale: 0.45
    },
    hammer: {
        during: 'reinforce',
        turn: [0, Math.PI, 0],
        scale: 1.1
    },
    pickaxe: {
        during: 'dig',
        turn: [0, Math.PI, 0],
        scale: 1
    },
};

/**
 * Is a held item in view during this activity? A unit always holds its own weapon, shield or tool,
 * except asleep or sitting in a cell (a death drops it, see `Figure.dropItems()`) and while it studies,
 * eats, reinforces or digs: then it holds that activity's prop instead (a unit's own tool stays in hand
 * for digging).
 */
export function itemShown(item, what) {
    if (item.prop) {
        return PROPS[item.prop].during === what;
    }
    if (what === 'sleep' || what === 'sit' || what === 'study' || what === 'eat' || what === 'reinforce') {
        return false;
    }
    if (what === 'dig') {
        return item.use === 'tool';
    }

    return true;
}

/** Unit states that show as the activity of the same name. */
const SAME = new Set(['dig', 'claim', 'reinforce', 'sleep', 'eat', 'train', 'study', 'cheer', 'stun', 'guard']);

/** States that show as another activity: prisoners lie knocked out (also when carried) or sit in a cell. */
const AS = { out: 'sleep', hauled: 'sleep', jailed: 'sit' };

/** What a unit is doing, as an activity (a key of CLIPS). */
export function activityOf(e, moving) {
    if (e.hitT > 0) {
        return 'attack';
    }
    if (moving) {
        return 'walk';
    }
    if (e.digging > 0) {
        return 'dig';
    }
    if (SAME.has(e.state)) {
        return e.state;
    }

    return AS[e.state] ?? (e.hurtT > 0 ? 'hurt' : 'idle');
}
