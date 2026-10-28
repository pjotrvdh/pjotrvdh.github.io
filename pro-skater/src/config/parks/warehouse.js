/**
 * The test park: an open floor with a quarter-pipe wall north and west, a halfpipe along the east,
 * a funbox in the middle, a kicker, a ramp-to-stairs set, a ledge, rails, manual pads and a mini ramp
 * in the south-west. Tokens are explained in config/parks/index.js; row 0 is north (−z), column 0 west (−x).
 *
 * `spawns`: where skaters start, as tile column and row, facing a direction (N, E, S, W).
 */
export default {
    name: 'Warehouse',
    map: `
## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ## ##
## I0 QS QS QS QS QS QS QS QS QS QS QS QS QS QS QS QS QS QS QS QS QS QS QS ##
## QE .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. F|
## QE .. .. .. .. .. .. .. .. .. .. .. .. .. RS .. .. .. .. .. .. .. .. .. F|
## QE .. .. .. .. M. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. F|
## QE .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ## QE .. .. QW ## F|
## QE .. .. .. .. .. eW r- r- r- r- r- eE .. .. .. .. .. ## QE .. .. QW ## F|
## QE .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ## QE .. .. QW ## F|
## QE .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ## QE .. .. QW ## F|
## QE .. .. .. .. .. .. .. RW RN RN RN RN RE .. .. .. .. ## QE .. .. QW ## F|
F| .. .. .. .. .. .. .. .. RW RS RS RS RS RE .. .. .. .. ## QE .. .. QW ## F|
F| .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ## QE .. .. QW ## F|
F| .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ## QE .. .. QW ## F|
F| .. .. .. RN RN RN .. .. .. .. .. .. .. .. .. EN .. .. ## QE .. .. QW ## F|
F| .. .. .. TS TS TS .. .. .. .. .. .. .. .. .. L| .. .. ## QE .. .. QW ## F|
F| .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. L| .. .. ## QE .. .. QW ## F|
F| .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. L| .. .. ## QE .. .. QW ## F|
F| qE .. .. qW .. .. .. .. .. .. M. M. .. .. .. ES .. .. .. .. .. .. .. .. F|
F| qE .. .. qW .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. F|
F| qE .. .. qW .. .. .. .. h- h- h- h- h- .. .. .. .. .. .. .. .. .. .. .. F|
F| qE .. .. qW .. .. .. BN .. .. .. BN .. .. .. .. P. .. .. .. .. .. .. .. F|
F- F- F- F- F- F- F- F- F- F- F- F- F- F- F- F- F- F- F- F- F- F- F- F- F- F-
`,
    spawns: [
        { col: 8, row: 12, facing: 'N' },
        { col: 17, row: 12, facing: 'N' },
        { col: 15, row: 6, facing: 'W' },
        { col: 7, row: 18, facing: 'E' },
        { col: 12, row: 15, facing: 'N' },
        { col: 5, row: 9, facing: 'S' },
        { col: 17, row: 3, facing: 'W' },
        { col: 21, row: 18, facing: 'N' },
    ],
};
