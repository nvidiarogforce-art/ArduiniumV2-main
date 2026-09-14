/**
 * Missions.
 *
 * The single biggest thing the leading platforms (VEXcode VR's playgrounds,
 * LEGO SPIKE's challenges) do that an open sandbox does not: give the student
 * something to *achieve*. A goal turns "I made a thing move" into "I solved
 * it", and it gives anyone watching a demo an obvious success moment.
 *
 * Every mission is data only — a flag to reach or a crate to shove, plus some
 * props to dodge. The arena reads this and builds itself; the runtime reads it
 * and decides when you have won.
 */

export const MISSIONS = [
  {
    id: 'sandbox',
    icon: '🧰',
    kind: 'none',
    props: {},
  },
  {
    id: 'firstMetres',
    icon: '🚩',
    map: 'provingGround',
    kind: 'reach',
    flag: [7.5, 0],
    reachRadius: 1.9,
    props: {},
  },
  {
    id: 'followLine',
    icon: '⭕',
    map: 'provingGround',
    kind: 'reach',
    // ON the painted ring (the tape loop is drawn at radius 9.2–9.7, see
    // Terrain.jsx). The old flag sat at [-4.8, 0.6] — inside the build pad,
    // nowhere near the ring the goal text was talking about.
    flag: [0, 9.45],
    reachRadius: 1.7,
    showRing: true,
    // The goal is enforced, not just described: the rover must accumulate
    // this many seconds inside the radial band before the flag counts.
    ring: { min: 8.5, max: 10.4, seconds: 3 },
    props: {},
  },
  {
    id: 'tightSqueeze',
    icon: '🪨',
    map: 'provingGround',
    kind: 'reach',
    flag: [8.4, 0],
    reachRadius: 1.8,
    props: {
      /*
       * A gate the rover has to line up with before it sets off. The template
       * rover is ~6.5 units wide across its wheels, so the old inner rocks at
       * z = ±1.5 (gap 2.1) made the mission geometrically impossible — the
       * only route was a detour wider than the arena decoration. The gap is
       * now 7.5: tight enough that a sloppy heading clips a rock, honest
       * enough that a straight run fits.
       */
      rocks: [
        [5.2, 4.2],
        [5.2, -4.2],
        [5.2, 5.8],
        [5.2, -5.8],
      ],
    },
  },
  {
    id: 'pushCrate',
    icon: '📦',
    map: 'provingGround',
    kind: 'push',
    props: {
      crate: [4.6, 0],
      square: [4.6, 0, 1.5],
    },
    pushDistance: 1.9,
  },
  {
    id: 'provingRun',
    icon: '⛰',
    map: 'provingGround',
    kind: 'checkpoints',
    checkpoints: [
      [7.5, 0],
      [13.5, 0],
      [17.5, 5.5],
    ],
    checkpointRadius: 2.4,
    props: {},
  },
  {
    id: 'powerLed',
    icon: '⚡',
    map: 'circuitLab',
    kind: 'circuit',
    props: {},
  },
  {
    id: 'deliveryAB',
    icon: '▣',
    map: 'challengeArena',
    kind: 'deliver',
    target: [18, -7],
    targetRadius: 2.4,
    props: {
      crate: [6.8, -0.3],
      square: [18, -7, 2.4],
      goalColour: '#df554b',
    },
  },
  {
    id: 'liftCrate',
    icon: '↥',
    map: 'challengeArena',
    kind: 'lift',
    liftHeight: 2.2,
    holdSeconds: 0.65,
    props: {
      crate: [7.2, 0.4],
      liftZone: [7.2, 0.4, 2.2],
    },
  },
  {
    id: 'arenaPush',
    icon: '▰',
    map: 'challengeArena',
    kind: 'deliver',
    target: [-11, 9],
    targetRadius: 1.9,
    props: {
      crate: [-19.5, 9],
      square: [-11, 9, 1.9],
      goalColour: '#2aa58a',
    },
  },
  {
    id: 'precisionPark',
    icon: '▥',
    map: 'challengeArena',
    kind: 'reach',
    flag: [15.5, 10.5],
    reachRadius: 1.35,
    props: {},
  },
  {
    id: 'lineOval',
    icon: '⬭',
    map: 'lineLab',
    kind: 'line',
    track: 'oval',
    laps: 1,
    props: {},
  },
  {
    id: 'lineFigure8',
    icon: '∞',
    map: 'lineLab',
    kind: 'line',
    track: 'figure8',
    laps: 1,
    props: {},
  },
  {
    id: 'lineSwitchback',
    icon: '≋',
    map: 'lineLab',
    kind: 'line',
    track: 'switchback',
    laps: 1,
    props: {},
  },
]

export const getMission = (id) => MISSIONS.find((m) => m.id === id) ?? MISSIONS[0]
