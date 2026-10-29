/*
 * The original options menu (optmenu, sprite 148 at root depth 136) is replaced by the control bar
 * in controls.js. It is still placed by the timeline, so it is hidden here: hidden clips cannot be
 * clicked.
 */

export default {
    clips: {
        'root:136': {
            load(c) {
                c.visible = false;
                c.stop();
            },
        },
    },
};
