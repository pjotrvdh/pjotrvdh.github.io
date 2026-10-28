/**
 * The follow camera (src/render/camera.js). Distances in metres, rates in 1/s (higher follows faster).
 */
export default {
    /** Distance behind the skater at standstill. */
    distance: 5.2,
    /** Extra distance at top speed. */
    distanceFast: 1.6,
    /** Height above the skater. */
    height: 2.2,
    /** Point the camera looks at, above the skater's feet. */
    lookHeight: 1.1,
    /** How fast the camera swings round behind the direction of travel. */
    yawFollow: 4,
    /** How fast the camera follows the skater up and down. */
    heightFollow: 5,
    /** Field of view at standstill, degrees. */
    fov: 60,
    /** Extra field of view at top speed, degrees. */
    fovFast: 10,
    /** Gap kept between the camera and a wall in the way, metres. */
    wallMargin: 0.4,
};
