/**
 * Authored workshop environments.
 *
 * Geometry stays in Terrain.jsx; this file is the stable product contract used
 * by the selector, camera, missions and tests.  Dimensions are world units
 * (1 unit = 25.4 mm for the student's build), but each environment is a
 * training diorama rather than a literal 1:1 room.
 */
export const MAPS = [
  {
    id: 'circuitLab',
    icon: '⚡',
    size: 24,
    half: 11.7,
    buildZone: 6.2,
    floor: '#f5f3ed',
    sky: '#dcecf0',
    fog: ['#dcecf0', 72, 150],
    defaultMission: 'powerLed',
    camera: [9.5, 8.2, 12.5],
    target: [0, 0.8, 0],
  },
  {
    id: 'provingGround',
    icon: '⛰',
    size: 68,
    half: 32.5,
    buildZone: 6.5,
    floor: '#aa9671',
    sky: '#c5d1d4',
    fog: ['#c5d1d4', 96, 190],
    defaultMission: 'provingRun',
    camera: [34, 42, 40],
    target: [2, 0.45, 2],
  },
  {
    id: 'challengeArena',
    icon: '◆',
    size: 64,
    half: 31.5,
    buildZone: 7.5,
    floor: '#c8b17f',
    sky: '#d7e0e2',
    fog: ['#d7e0e2', 88, 180],
    defaultMission: 'deliveryAB',
    camera: [29, 36, 34],
    target: [1, 0.45, 2],
  },
  {
    id: 'lineLab',
    icon: '∞',
    // The floor collider must extend past both the white calibration surface
    // and a complete rover footprint at every point on every course. Keeping
    // this at 54 left only 0.67–1.0 units under the outside wheels.
    size: 64,
    half: 31.5,
    buildZone: 6.5,
    surface: { center: [0, 9], size: [49, 43] },
    floor: '#e8eceb',
    sky: '#dce6e8',
    fog: ['#dce6e8', 104, 205],
    defaultMission: 'lineOval',
    camera: [28, 42, 46],
    target: [0, 0.25, 11],
  },
]

export const getMap = (id) => MAPS.find((map) => map.id === id) ?? MAPS[1]
