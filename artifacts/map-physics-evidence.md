# Map, line-sensor, and servo mechanics — completion evidence

Date: 2026-09-14

## Delivered behavior

- The line lab is a single open 49 × 43 white calibration field inside a 64-unit arena. Only the selected course is rendered, so there is no competing visual noise.
- Oval, figure-eight, and switchback courses use 0.82–0.86-unit black tape. The renderer and the line sensor sample the same point data; thin checkpoint rings do not cover the tape.
- All three line-rover starts were measured live at `100%`, ready on Arduino alias pin A0 / digital 14.
- The proving-ground and challenge-arena layouts were audited from home, top, and front views. Sheds and containers now face the playable space; challenge road arrows follow traffic direction; ramp yaw and slope follow the delivery road.
- The servo is now a real mechanical host. Its output spline offers `SERVO_OUTPUT_SHAFT`; a visible, clockable `servoHorn` snaps to that shaft; a beam then bolts to the horn's ordinary chassis hole.
- Assembly planning derives each hinge actuator from the physical `servo -> horn -> bolt -> moving beam` chain. The robot-arm template no longer relies on proximity magic or hidden `actuatesBolt` metadata.
- The arm has six powered, signalled servos, six visible horns, six corresponding revolute joints, 29 preserved parts, 16 preserved bolts, and 22 preserved leads.
- Live Dupont leads recompute their endpoints from moving rigid bodies. During the verified run, all 22 stayed connected while the wrist endpoint travelled 10.670 world units.
- Anchored mechanisms use a dedicated Run framing. Rover follow-camera behavior is retained, while a fully extended arm remains visible beside the open Parts drawer.

## Fresh visual captures

- `shots/lineOval.png`
- `shots/lineFigure8.png`
- `shots/lineSwitchback.png`
- `shots/lineOval-outer-turn-run.png`
- `shots/map-provingGround-top.png`
- `shots/map-provingGround-front.png`
- `shots/map-challengeArena-top.png`
- `shots/map-challengeArena-front.png`
- `shots/robot-arm-build.png`
- `shots/robot-arm-run.png`

## Automated evidence

- `tools/maps-test.mjs`: **39/39**
  - all three live line-sensor starts: `100%`, ready, pin 14
  - every rendered line sample is sensed as tape
  - every checkpoint lies on its visible course
  - full white surface edge `30.5` is covered by the `±32` ground collider
  - minimum course-to-collider-edge clearance is `5.67` units
  - rover relocated to the former outer-turn failure point stayed supported at wheel-centre Y `0.619`
  - four maps and their mission selectors load with no browser errors
- `tools/mechanics-test.mjs`: **30/30**
  - 6/6 horns attached to 6/6 real servo output shafts
  - 6/6 hinges derive the intended actuator from their horn chain
  - shoulder, elbow, wrist, and both jaws receive non-zero physical targets
  - 22/22 live cable endpoint pairs preserved
  - wrist cable endpoint travelled `10.670` units and remained at Y `17.499`
  - extended wrist projected to `{x: 777, y: 183, behind: false}` beside the open drawer
  - 781 draw calls and 71,934 triangles
- `tools/mission-test.mjs`: **5/5**
- `tools/sensors-test.mjs`: **320/320**
- `tools/sensor-program-test.mjs`: **10/10**
- `tools/kit-electronics-test.mjs`: **10/10**
- `tools/wiring-test.mjs`: **31/31**
- `tools/mount-test.mjs`: **20/20**
- `tools/orient-test.mjs`: **37/37**
- `npm run build`: production Next.js build passed, including 23 generated pages/routes.
- `npm run build:single`: offline single-file Vite build passed; 4,247.93 kB, 1,525.93 kB gzip.

## Physical contract

Dupont leads remain electrical cables, not load-bearing members. They visibly stay plugged into moving components and deform with the mechanism, while load passes through bolts, horn adapters, anchored structure, and servo-driven revolute joints. That separation matches a real educational robotics kit.
