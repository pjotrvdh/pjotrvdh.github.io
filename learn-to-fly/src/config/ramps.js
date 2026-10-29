/**
 * The five ramps (the stage menu) and their achievements, from the original's init frame
 * (`stagedis11` … `stagedur52`, `stageac1` … `stageac5`). Each ramp has four achievements:
 * distance (ft), altitude (ft), speed (mph) and glide time (seconds), each with a cash reward.
 * `unlock` is how many achievements (over all ramps) it takes to open the ramp.
 */
export default [
    { name: "5' Ramp", unlock: 0, distance: [40, 25], altitude: [10, 25], speed: [45, 25], duration: [5, 25] },
    { name: "10' Ramp", unlock: 2, distance: [200, 100], altitude: [25, 100], speed: [70, 100], duration: [8, 100] },
    { name: "20' Ramp", unlock: 6, distance: [650, 500], altitude: [45, 500], speed: [100, 500], duration: [15, 500] },
    { name: "35' Ramp", unlock: 10, distance: [1500, 2000], altitude: [100, 2000], speed: [150, 2000], duration: [25, 2000] },
    { name: "50' Ramp", unlock: 16, distance: [4000, 5000], altitude: [225, 5000], speed: [225, 5000], duration: [35, 5000] },
];
