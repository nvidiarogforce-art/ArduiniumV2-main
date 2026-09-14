# Map fidelity + articulated physics plan

## Target

Bring the four environments closer to their approved reference compositions,
retain crisp engineering detail at normal zoom, and make the servo-arm starter
remain mechanically assembled while every electrical lead follows its real
terminal during Rapier simulation.

## Execution order

1. **Measure the failures** — compare supplied captures with the four stored
   references; reproduce the arm in the single-file production build.
2. **Fix owning physics systems** — create joints before the first physics
   step, run servo holding on Rapier's fixed clock, map each starter servo to
   one explicit hinge, and anchor the arm's base plate as a workbench fixture.
3. **Make wiring live** — resolve each terminal through its owning rigid body
   and draw a gravity-sagged, allocation-safe flexible lead between the two
   live endpoints. Electrical connectivity remains owned by the netlist.
4. **Recompose maps** — denser perimeter course for the proving ground,
   readable road/cell network for challenges, three parallel line stations,
   and the close workbench composition for circuits.
5. **Camera and clarity** — delay fog to genuine long distance, preserve at
   least 1.35 DPR under adaptive quality, enlarge far clip and frame full maps.
6. **Regression and visual QA** — builds, map missions, sensors, wiring,
   mounting/orientation/editing, robotic-arm telemetry, desktop captures and
   renderer budgets.

## Physics contract

- Rapier 3D, fixed `1/60 s`, 16 solver iterations.
- Two bolts between rigid members weld them into one compound body; one bolt
  creates one revolute joint.
- Powered servo joints hold position on every physics step, independent of
  render FPS.
- An explicitly anchored base is fixed to the work surface; ordinary student
  parts remain dynamic.
- Dupont leads stay attached and sag visually. They do not act as structural
  ropes: bolts and servos carry mechanical loads, which matches real circuits.

## Completion evidence

- Arm: 6/6 intended actuators, 22/22 live leads, wrist endpoint stays above
  `y=7` after Run.
- Maps: all four render below 900 calls / 180k triangles.
- Line sensor: all three rendered tracks use the exact samples sensed by the
  runtime and start with a valid live reading.
