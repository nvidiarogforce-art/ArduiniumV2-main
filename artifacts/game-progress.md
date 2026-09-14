# ARDUINIUM multi-map upgrade

## Intent and constraints

- Add four task-specific, authored maps without breaking the existing build,
  wiring, program or physics workflows.
- Every map starts from a generated visual reference saved under
  `src/assets/map-references/`.
- Maps preserve the student's current robot when switching.
- World geometry is deterministic, offline-safe and uses explicit Rapier
  colliders while running.
- UI stays readable for grades 5–7 in English, Russian and Uzbek.

## Design brief

Player promise: build a real circuit or robot, then test it in the environment
that an engineer would actually choose for that job. The primary verb is
build/program; secondary verbs are wire, drive, sense, lift and iterate. Every
map communicates one clear objective, gives immediate physical evidence, and
allows Stop → edit → Run retry without losing the build.

Non-goals: arbitrary deformable mud, fluid simulation, decorative NPCs,
network-fetched runtime assets, or replacing the existing electronics model.

## Core loop contract

The student builds and programs a machine to complete a visible map objective
while terrain, clearances, wiring and physics create risk; success gives a
checked challenge result, and failure returns to the exact editable build for
a fast retry.

## Level plan

1. Science Circuit Lab — quiet white workbench, electronics-only challenge;
   complete a powered breadboard LED circuit.
2. Robot Proving Ground — large outdoor loop with ramp, mud lane, rock crawl,
   log bridge, bumps, slalom and sequential checkpoints.
3. Engineering Challenge Arena — delivery A→B, crane lift, crate push and
   precision parking, solvable either by blocks or an on-screen/WASD remote.
4. Line-Follower Test Center — beginner oval, figure-eight and advanced
   switchback variants driven by the same line geometry the sensor samples.

Landmarks, leading floor lines and shape-coded checkpoints expose the golden
path. Course dimensions use the existing rover's measured ~6.5-unit wheel span;
required gates remain at least 7.5 units wide.

## Generated references

- Original concepts are retained for comparison.
- `science-bench-v2.png` — corrected hero workbench, built-in GPT Image
- `robot-proving-ground-v2.png` — corrected ARDUINIUM toon style
- `engineering-challenge-arena-v2.png` — corrected multi-challenge layout
- `line-follower-center-v2.png` — corrected three-variant line facility

## Status

- [x] Four independent reference concepts generated and copied into the repo.
- [x] Map data model and localized selector.
- [x] Four deterministic render/collider kits.
- [x] Circuit, checkpoint, delivery, lift, push, parking and line objective logic.
- [x] Momentary on-screen/WASD remote with blur/cancel safety.
- [x] Browser tests, captures and renderer-budget measurements.
- [x] Final evidence report and full production regression summary.
