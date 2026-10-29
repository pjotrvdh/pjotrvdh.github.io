/**
 * The ten levels, in order. Each level makes the ball faster, the opponent sharper and the curves
 * wilder.
 *   ballSpeed      tunnel units per second the ball travels in depth (the tunnel is 10 deep)
 *   opponentSpeed  how fast the opponent's paddle can move, in tunnel units per second
 *   opponentAim    how far ahead the opponent reads the ball: 0 = only where it is now, 1 = where it will arrive
 *   opponentSpin   how much spin the opponent puts on its returns
 *   curve          multiplies the spin you put on the ball
 */
export default [
    { ballSpeed: 6.0, opponentSpeed: 1.0, opponentAim: 0.0, opponentSpin: 0.0, curve: 1.0 },
    { ballSpeed: 6.6, opponentSpeed: 1.5, opponentAim: 0.1, opponentSpin: 0.0, curve: 1.0 },
    { ballSpeed: 7.2, opponentSpeed: 1.9, opponentAim: 0.2, opponentSpin: 0.2, curve: 1.0 },
    { ballSpeed: 7.8, opponentSpeed: 2.3, opponentAim: 0.3, opponentSpin: 0.3, curve: 1.0 },
    { ballSpeed: 8.5, opponentSpeed: 2.8, opponentAim: 0.4, opponentSpin: 0.4, curve: 1.25 },
    { ballSpeed: 9.2, opponentSpeed: 3.3, opponentAim: 0.5, opponentSpin: 0.5, curve: 1.5 },
    { ballSpeed: 10.0, opponentSpeed: 3.8, opponentAim: 0.6, opponentSpin: 0.6, curve: 1.75 },
    { ballSpeed: 10.8, opponentSpeed: 4.4, opponentAim: 0.7, opponentSpin: 0.7, curve: 2.0 },
    { ballSpeed: 11.7, opponentSpeed: 5.0, opponentAim: 0.8, opponentSpin: 0.8, curve: 2.25 },
    { ballSpeed: 12.6, opponentSpeed: 5.8, opponentAim: 0.9, opponentSpin: 1.0, curve: 2.5 },
];
