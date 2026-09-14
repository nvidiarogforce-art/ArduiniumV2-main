# ARDUINIUM multi-map upgrade — final evidence

Date: 2026-09-13

## Outcome

Four deterministic, task-specific worlds now share the existing build,
wiring, program and Rapier simulation:

1. `circuitLab` — a white electronics workbench and a live breadboard LED
   proof mission.
2. `provingGround` — the existing warm-beige/blue toon language expanded with
   ramp, mud, rock crawl, log bridge, bumps, slalom and ordered checkpoints.
3. `challengeArena` — A→B delivery, servo-arm lift, cargo push lane and
   precision parking. Code and a momentary on-screen/WASD remote drive the same
   wheel-force system.
4. `lineLab` — oval, figure-eight and switchback variants. The renderer and the
   physical floor-ray sensor consume the same sampled curves.

The selector, map and mission copy are complete in English, Russian and Uzbek.
Switching maps keeps the student's build, changes the default mission, and
moves to an authored overview camera.

## Reference ledger

Loaded and applied:

- `router/SKILL.md`
- `level-design/SKILL.md` and `references/pacing-and-flow.md`
- `threejs-game-director/SKILL.md`
- `threejs-gameplay-systems/SKILL.md`, genre and physics references
- `threejs-aaa-graphics-builder/SKILL.md`, implementation blueprint, model,
  render, technical-art, shader and visual-scorecard references/checklists
- `threejs-game-ui-designer/SKILL.md`, `ui-patterns.md` and UI checklists
- `threejs-debug-profiler/SKILL.md`, debug/profile checklists
- `threejs-qa-release/SKILL.md`, QA/release, visual-harness and bot-playtest
  references/checklists
- `imagegen/SKILL.md` and prompting guidance
- `threejs-image-generator/SKILL.md` and `threejs-3d-generator/SKILL.md`

No required reference was blocked. Some filenames suggested during the first
pass did not exist; the actual reference filenames listed by each `SKILL.md`
were loaded instead.

## Reference and asset sourcing ledger

The four corrected concept references were generated with built-in GPT Image
after visually inspecting the existing ARDUINIUM screenshot:

- `src/assets/map-references/science-bench-v2.png`
- `src/assets/map-references/robot-proving-ground-v2.png`
- `src/assets/map-references/engineering-challenge-arena-v2.png`
- `src/assets/map-references/line-follower-center-v2.png`

Runtime asset strategy: procedural Three.js/Rapier geometry. This is deliberate,
not a generator failure: the user requested the existing stylized visual
language rather than photorealism, and the repository requires a self-contained
single HTML build with no runtime downloads. The references determine layout,
palette, landmarks and camera composition; collision meshes remain simple and
independent from visible detail.

## Technical-art brief and measured budget

- Shapes: chunky low-poly industrial props, clear silhouettes, broad course
  markings, physical build as the hero.
- Material roles: blue structure, orange motion/hazard, teal success/signal,
  warm paper/sand support surfaces, black line tape.
- Lighting: existing toon key/fill/rim stack; no bloom or post-processing.
- VFX/state: animated flag/rings and shape-coded active/passed checkpoints.
- Camera: close frame for building, wide `mapHome` overview for environment
  selection.
- Repetition: generated arrays reuse component factories; collision proxies
  are low-complexity cuboids/cylinders/balls.
- Project gate: fewer than 900 draw calls and 180k triangles in the existing
  procedural/offline renderer. The general 300-call premium target is not
  claimed; the current shared Toon component produces one material per mesh.
- DPR: capped by the existing quality system (high-quality test path uses 2).
- Shadows: one shadow-casting key light; no post passes; three runtime textures.

Measured at 1500×950 in the single-file production build with SwiftShader:

| Map | calls | triangles | geometries | materials | textures |
| --- | ---: | ---: | ---: | ---: | ---: |
| Circuit bench | 391 | 7,660 | 358 | 362 | 3 |
| Proving ground | 755 | 48,532 | 718 | 708 | 3 |
| Challenge arena | 762 | 45,936 | 792 | 651 | 3 |
| Line lab | 705 | 44,226 | 793 | 537 | 3 |

The software renderer makes wall-clock FPS unsuitable as performance evidence;
functional, pixel and renderer-budget results remain valid.

## Gameplay and UI verification

- Remote direction produces real rover displacement; pointer release restores
  program control.
- Pointer cancel/lost capture, window blur and visibility changes clear the
  override so motors cannot stick on.
- 900×700 narrow layout has no horizontal overflow; remote remains on-screen;
  direction target is 44×44; mission banner clears the workflow rail.
- Every line layout starts beneath the real centred sensor, reads `100%` from
  A0, and requires a live line reading at ordered mission gates.
- The breadboard mission wins only with a physical breadboard footprint, a
  resistor-protected LED circuit and an active output pin.
- Next.js static-image objects are normalized in the shared workflow rail, so
  `/learn/simulator` makes no `/learn/[object Object]` requests.

## Automated QA

- `npm run build:single` — pass, `dist-single/index.html` 4.239 MB (1.524 MB gzip)
- `node tools/maps-test.mjs` — 32/32
- `node tools/mission-test.mjs` — 5/5
- `node tools/sensors-test.mjs` — 320/320
- `node tools/kit-electronics-test.mjs` — 10/10
- `node tools/sensor-program-test.mjs` — 10/10
- `node tools/wiring-test.mjs` — 31/31
- `node tools/workshop-integration-test.mjs` — 13/13
- `node tools/code-test.mjs` — 51/51
- `node tools/model-test.mjs` — 38/38
- `npm run build` — Next.js production build pass
- `node tools/web-test.mjs` against `npm run dev` — 69/69

Total recorded assertions: 579/579.

## Visual harness and playtest decisions

`tools/maps-test.mjs` is the added visual/interaction harness. It captures all
four maps, all three line variants and the narrow remote state while checking
canvas errors and renderer budgets. Pixel-perfect `toHaveScreenshot()`
baselines were intentionally not added because shadow antialiasing and the live
WebGL renderer vary under SwiftShader; the screenshots are evidence artifacts,
while structural/interaction assertions remain deterministic.

The repository's domain-specific `mission-test.mjs` and the new remote-motion
scenario cover the core physical input loop, so the packaged generic bot
template was not duplicated. No difficulty/fairness claim is made.

## Screenshots

- `shots/map-circuitLab.png`
- `shots/map-provingGround.png`
- `shots/map-challengeArena.png`
- `shots/map-lineLab.png`
- `shots/lineOval.png`
- `shots/lineFigure8.png`
- `shots/lineSwitchback.png`
- `shots/map-remote-narrow.png`

## Visual scorecard (honest stylized target, not an AAA claim)

- Art direction: 2 — cohesive warm workshop palette and world/UI signal roles.
- Hero/player: 2 — existing detailed physical rover remains the focus.
- Obstacles: 2 — ramp, mud, rock, logs, bumps, slalom, bridges and bollards.
- Interactables: 2 — physical crates, circuit proof and shape-coded goals.
- World/environment: 2 — four authored task environments with landmarks.
- Materials/textures: 1 — intentionally flat toon materials, three textures.
- Lighting/render: 2 — readable key/fill/rim and overview composition.
- VFX/motion: 1 — functional rings/flags only; no broad effects pass.
- UI/HUD: 2 — map/mission hierarchy, progress, remote, responsive fit.
- Performance evidence: 2 — production browser diagnostics and assertions.

Average: 1.8/3. This is a polished extension of the existing stylized sandbox,
not a premium/AAA claim. The strongest case against a higher score is the high
material/draw-call count and deliberately restrained VFX. No fog, glow or
darkness is used to hide missing geometry.

## Issues found and fixed during QA

- Blank app from missing `rt` remote import.
- Map switch crash from an out-of-scope perimeter key variable.
- Line sensor stacked on a structurally occupied bolt hole.
- Line starter began off the rendered tape.
- Circuit success arrived too late under the software renderer.
- Independent tape quads left visible wedges at curves.
- Narrow mission banner overlapped the Run panel.
- Next source imports produced `/learn/[object Object]` icon requests.

## Residual risks

- Full touch-based 3D construction is still not claimed; the new remote itself
  is pointer-safe and narrow-layout tested.
- Renderer material/geometry counts remain high because the legacy toon
  pipeline authors many small meshes. They pass the repository's measured
  budget, but a future performance pass should share materials/geometries or
  instance repeated course props before adding denser decoration.
- Existing dependency deprecation warnings (`THREE.Clock`, BVH option naming)
  are outside this map change and do not produce page errors in the gates.
