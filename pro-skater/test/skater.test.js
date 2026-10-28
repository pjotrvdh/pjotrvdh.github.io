import assert from 'node:assert/strict';
import { test } from 'node:test';
import { config, EAST, NORTH, run, skaterAt, SOUTH, warehouse, WEST } from './helpers.js';

const park = warehouse();
const { physics } = config;

test('the park map parses and the floor is flat', () => {
    assert.equal(park.cols, 26);
    assert.equal(park.rows, 22);
    const [x, z] = [8.5 * park.tile, 12.5 * park.tile];
    assert.ok(Math.abs(park.groundAt(x, z)) < 0.01);
    assert.ok(Math.abs(park.slope(x, z, 1, 0)) < 0.01);
});

test('pushing speeds up to the push speed and no further on flat ground', () => {
    const skater = skaterAt(park, 14, 18, EAST);
    run(skater, park, 1.6, { push: true });
    assert.ok(skater.speed > physics.pushSpeed * 0.8, `speed ${skater.speed}`);
    assert.ok(skater.speed <= physics.pushSpeed + 0.1, `speed ${skater.speed}`);
    assert.ok(skater.grounded);
});

test('braking stops the board', () => {
    const skater = skaterAt(park, 8, 12, NORTH, 8);
    run(skater, park, 1.2, { brake: true });
    assert.equal(skater.speed, 0);
});

test('an ollie on flat ground pops up and lands rolling', () => {
    const skater = skaterAt(park, 8, 12, NORTH, 6);
    const { events, highest } = run(skater, park, 1.5, (t) => ({ jump: t < 0.1 }));
    assert.deepEqual(events.filter((event) => event !== 'air'), ['ollie', 'land']);
    assert.ok(highest > 0.6, `ollie height ${highest}`);
    assert.ok(skater.grounded && skater.speed > 4, `speed after landing ${skater.speed}`);
});

test('a charged ollie goes higher than a tapped one', () => {
    const tapped = run(skaterAt(park, 8, 12, NORTH, 5), park, 1.5, (t) => ({ jump: t < 0.02 })).highest;
    const charged = run(skaterAt(park, 8, 12, NORTH, 5), park, 1.5, (t) => ({ jump: t < 0.4 })).highest;
    assert.ok(charged > tapped + 0.3, `tapped ${tapped}, charged ${charged}`);
});

test('a 180 lands fakie, a 90 bails', () => {
    const spin = (seconds) => (t) => ({ jump: t < 0.3, steer: t > 0.32 && t < 0.32 + seconds ? 1 : 0 });
    const half = skaterAt(park, 8, 16, NORTH, 6);
    const halfRun = run(half, park, 1.6, spin(Math.PI / physics.spinRate + 0.02));
    assert.ok(halfRun.events.includes('land') && !halfRun.events.includes('bail'), halfRun.events.join());
    assert.ok(half.speed < 0, `fakie speed ${half.speed}`);

    const quarter = skaterAt(park, 8, 16, NORTH, 6);
    assert.ok(run(quarter, park, 1.6, spin(Math.PI / 2 / physics.spinRate + 0.02)).events.includes('bail'));
});

test('riding into the quarter pipe flies straight up out of it and lands back in it', () => {
    const skater = skaterAt(park, 4, 6, NORTH, 11);
    const { events, highest } = run(skater, park, 3);
    assert.ok(events.includes('air') && events.includes('land'), events.join());
    assert.ok(!events.includes('bail'), events.join());
    assert.ok(highest > 1.8 + 0.5, `top of the air ${highest}`);
    // Back down the ramp, fakie, heading south.
    assert.ok(skater.grounded);
    assert.ok(skater.z > 2.5 * park.tile, `z ${skater.z}`);
});

test('going too slow up a quarter rolls back down fakie', () => {
    const skater = skaterAt(park, 8, 3, NORTH, 4);
    run(skater, park, 2);
    assert.ok(skater.grounded && skater.speed < 0, `speed ${skater.speed}`);
});

test('the deck behind a quarter pipe is a wall from the floor', () => {
    const skater = skaterAt(park, 17, 10, EAST, 5);
    const { events } = run(skater, park, 1.2);
    assert.ok(events.includes('wall'), events.join());
    assert.ok(skater.x < 19 * park.tile, `x ${skater.x}`);
});

test('rails are walls on the ground but can be ollied over', () => {
    const blocked = skaterAt(park, 10, 8, NORTH, 6);
    assert.ok(run(blocked, park, 1).events.includes('wall'));

    const over = skaterAt(park, 10, 8, NORTH, 6);
    const { events } = run(over, park, 2, (t) => ({ jump: t < 0.25 }));
    assert.ok(!events.includes('wall') && !events.includes('bail'), events.join());
    assert.ok(over.z < 5.5 * park.tile, `z ${over.z}`);
});

test('rolling off the stairs flies and lands', () => {
    // Up the ramp at row 13 from the north, over its top, down the steps at row 14.
    const skater = skaterAt(park, 5, 11, SOUTH, 8);
    const { events } = run(skater, park, 1.5);
    assert.ok(events.includes('air') && events.includes('land') && !events.includes('bail'), events.join());
    assert.ok(skater.z > 15 * park.tile, `z ${skater.z}`);
});

test('a fast head-on hit on a wall bails', () => {
    const skater = skaterAt(park, 5, 15, WEST, 12);
    assert.ok(run(skater, park, 1).events.includes('bail'));
});

test('a kicker launches you without an ollie', () => {
    const skater = skaterAt(park, 15, 7, NORTH, 9);
    const { events, air } = run(skater, park, 1.6);
    assert.deepEqual(events, ['air', 'land']);
    assert.ok(air > 0.35, `air time ${air}`);
});

test('the funbox launches off its top and lands on its far side', () => {
    const skater = skaterAt(park, 11, 7, SOUTH, 9);
    const { events } = run(skater, park, 1.5);
    assert.deepEqual(events, ['air', 'land']);
    assert.ok(skater.grounded && skater.speed > 7, `speed ${skater.speed}`);
});

test('the halfpipe keeps you going back and forth', () => {
    const skater = skaterAt(park, 21, 11, EAST, 9);
    const { events } = run(skater, park, 6);
    assert.ok(events.filter((event) => event === 'land').length >= 3, events.join());
    assert.ok(!events.includes('bail') && !events.includes('wall'), events.join());
});
