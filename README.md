# ARDUINIUM — Robotics Workshop

A browser workshop where 10–13 year olds bolt a robot together out of
perforated metal strips, wire an Arduino to it, write a program with blocks,
press Run, and watch the thing physically drive across a terrain.

The standalone build needs no runtime asset downloads. Most meshes are
  procedural (the strips use real boolean holes); the Arduino board is authored
  as a low-poly procedural mesh. Sounds use the Web Audio API, and the
terrain comes from a noise function.

---

The workshop now ships inside a **platform** — a Next.js site with lessons,
video modules, a teacher-training track, a community feed and pricing, in
Uzbek and English. The workshop itself is unchanged and still runs standalone.

---

## Running it

```bash
npm install
npm run dev            # the site — http://localhost:3200
npm run sandbox:dev    # the standalone workshop — http://localhost:5173
npm run build          # the site, production
npm run build:single   # dist-single/index.html — one self-contained file
```

`build:single` inlines everything, including the Rapier physics WebAssembly, so
the resulting HTML runs by double-clicking it with no server.

### Two apps, one `src/`

| | Entry | What it is |
|---|---|---|
| Workshop | `index.html` → `src/main.jsx` (Vite) | The 3D sandbox — everything the rest of this README describes |
| Site | `app/` (Next.js, App Router, TS, Tailwind v4) | The learning platform around it |

The site imports the workshop **at source level** — `@sandbox/*` maps to
`./src/*` — and mounts it at `/learn/simulator` with
`next/dynamic({ ssr: false })`. No iframe, no duplicated code, one React tree,
shared navigation and language. This is possible because the workshop uses no
`import.meta`, no `?url` imports and no other Vite-only API.

Nothing under `src/` was rewritten to make that work. Two presentation-only
edits were needed and both are commented in place: `src/styles.css` scopes its
route-level rules (`body { overflow: hidden }` is right for a full-screen tool
and fatal for a scrolling page) and its element resets (unlayered CSS outranks
every Tailwind `@layer`), and `index.html` carries the class those rules key
on. Because the simulation layer is untouched, the harnesses in `tools/`
remain a valid regression gate for both apps — `tools/web-test.mjs` re-runs
the same rover-drive scenario against the workshop *inside Next*.

### Automated checks

```bash
node tools/shot.mjs out.png <scenario>
# boot | led | rover | drive | code | xray | build
node tools/core-regression-test.mjs       # geometry, import, snapping, raised bolts
node tools/sensors-test.mjs --browser    # wiring, real Rapier rays, sensor lifecycle
node tools/sensor-program-test.mjs       # sensor operands and parser regressions
node tools/workshop-integration-test.mjs # live lab, XYZ, wiring errors, short drive
node tools/tutorial-test.mjs             # action-checked Academy progression
```

Loads the built app in headless Chromium, drives the real UI, screenshots into
`shots/`, and **exits non-zero on any console error or page exception**. The
`drive` scenario asserts the rover physically travels: it reports how far the
robot actually moved, which is the one thing that cannot be faked.

`?quality=high` in the URL pins render quality (the FPS guard would otherwise
downgrade under a software renderer); `?flat` removes obstacles. Both are debug
aids only.

---

## The backend

The site runs in two configurations, and both are supported on purpose.

**With no `.env.local`** — a fresh clone — the landing page, the lessons, the
video catalogue and the 3D workshop all work, and progress and community posts
persist to `localStorage` exactly as they did before there was a server. The
routes that genuinely need a backend (`/ai`, `/admin`, `/login`) say the backend
is not set up instead of redirecting to a sign-in that could not succeed. This
is what keeps `tools/web-test.mjs` a valid regression gate on a machine with no
database, and it is why `npm run dev` works the minute you clone.

**With Supabase configured** the same screens read and write real rows: accounts
and roles, lesson progress that a teacher can see aggregated, community posts,
class rosters, and the assistant's transcripts.

### Setting up the backend

1. **Create a Supabase project** at [supabase.com](https://supabase.com). From
   *Project Settings → API* copy the project URL, the `anon` key and the
   `service_role` key.

2. **Run the migrations**, in order. Either paste them into the SQL editor in
   the dashboard, or:

   ```bash
   psql "$DATABASE_URL" -f supabase/migrations/0001_schema.sql
   psql "$DATABASE_URL" -f supabase/migrations/0002_rls.sql
   psql "$DATABASE_URL" -f supabase/migrations/0003_functions.sql
   ```

   `0001` is the schema, `0002` is row-level security, `0003` is the rate
   limiter and the admin panel's aggregate queries. All three are idempotent.

3. **Fill in `.env.local`** from `.env.example` (which documents every
   variable). At minimum:

   ```
   NEXT_PUBLIC_SUPABASE_URL=…
   NEXT_PUBLIC_SUPABASE_ANON_KEY=…
   SUPABASE_SERVICE_ROLE_KEY=…
   ANTHROPIC_API_KEY=…
   ```

   The first two are safe in a browser bundle — the anon key is only ever as
   powerful as the policies in `0002_rls.sql` allow. The other two are
   server-only and must never be prefixed `NEXT_PUBLIC_`.

4. **Seed the demo data:**

   ```bash
   npm run db:seed                  # npm run db:reset clears the demo accounts first
   ```

   Needs **Node 22.6 or newer**. The script imports the curriculum straight out
   of `lib/content/*.ts`, which relies on Node stripping the types at import —
   hence the `--experimental-strip-types` flag the npm script passes. On Node 20
   it will not run; nothing else in the project cares.

   One school, three classes, two teachers, six students, the whole Phase 1
   lesson and video catalogue, community posts, and an activity history spread
   across the buckets the admin panel reports. Every account has the password
   `arduinium-demo` (`SEED_PASSWORD` overrides it) and the script prints the
   list when it finishes; `admin@arduinium.demo` is the school admin.

   The curriculum is imported from `lib/content/*.ts` rather than copied, so the
   seeded catalogue cannot drift away from what the lesson pages render.

5. `npm run dev`, then sign in at `/login`.

### Access control

`supabase/migrations/0002_rls.sql` is the access-control table, expressed the
only place it can be enforced:

| data | student | teacher | school admin |
|---|---|---|---|
| own profile, own progress | read/write own | — | — |
| progress of students in their classes | — | read | read (school-wide) |
| `community_posts` | read all, write own | read all, write own | read all, write own |
| `ai_messages` | read own | **never** | **never** |
| `activity_log` (aggregate signal only) | own | own classes | school-wide |
| classes / enrolments | read own | read/write own | read/write in school |

The `ai_messages` row is the one that matters most. Most of this product's users
are children, and a student's conversation with the assistant is theirs. There
is no teacher policy and no admin policy on that table — not a hidden UI, an
absent grant. "Show me the student's chat log" is not a query someone can write
later; they would have to come to that file and add the policy that permits it.
What a teacher or an admin *can* see is `activity_log`: that the assistant was
used, and when. Two facts, two tables, two audiences.

Role escalation is closed too. A user may edit their own profile but not their
own `role` or `school_id` (a trigger in `0001` blocks it), and signup metadata
is filtered server-side so a crafted request cannot mint a school admin — the
`/register` form offers `student` and `teacher`, and the database only honours
those two. `school_admin` is assigned by the seed script or by an existing
admin, out of band.

### The AI assistant

Ardu lives in two places and is one component: `/ai` as a full page, and a
slide-over in the workshop's toolbar that opens without leaving the 3D scene.
Opened from the sandbox it carries the current lesson, the build summary and the
student's C++ into the conversation, all read through the debug hooks the
workshop already exposes — no file under `src/` changed to make that work.

The model is called from `app/api/ai/chat/route.ts` and nowhere else. The route
authenticates first, then claims a slot from a per-user daily allowance
(`ai_rate_limit_take()` does the check and the increment in one statement, so
two concurrent requests cannot both spend the last one), and only then talks to
the provider. The key is read from `ANTHROPIC_API_KEY` on the server; there is
no client-side path to the API and no fallback that would create one. With the
key missing, `/ai` and the Ardu button say so plainly rather than failing at
runtime.

`lib/ai/provider.ts` is the seam: everything above it deals in a system prompt,
a message list and a stream of text. Swapping providers is that file and two
environment variables.

The persona is in `lib/ai/prompt.ts`. Its core rule — guide, do not hand over
the answer — is the reason this is an assistant rather than a chat box, and it
shifts to a direct, professional register when the caller's role is `teacher`.

### Deploying to Vercel

1. Push the repo to GitHub and import it at [vercel.com/new](https://vercel.com/new).
   Next.js is detected automatically; the build command is `npm run build`.
2. In *Project Settings → Environment Variables*, add the same four variables
   from `.env.local`. Mark `SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY`
   as server-side only (do not prefix them `NEXT_PUBLIC_`).
3. In Supabase, under *Authentication → URL Configuration*, add the deployment's
   URL as a Site URL and a redirect URL so email confirmation links come back to
   the right place.
4. Deploy. Run the migrations and `node supabase/seed.mjs` against the same
   project if you have not already — a deployed instance with an empty database
   is not worth trying out.

The Vite workshop build (`npm run build:single`) is unaffected by any of this
and still produces a standalone HTML file.

---

## What is in it

- **Four task maps and thirteen checked missions.** The science bench proves a
  real breadboard LED circuit; the toon proving ground tests ramp, mud, rocks,
  logs, bumps and slalom; the challenge arena supports delivery, servo-arm
  lifting, cargo pushing and precision parking; the line lab swaps between an
  oval, figure-eight and switchback. Reaching a goal is detected from live
  circuit or physics state, not from a decorative caption.
- **Manual drive remote.** While Run is active, the on-screen pad and W/A/S/D
  temporarily override drive blocks. Releasing, losing focus or cancelling a
  pointer immediately hands control back to the program, so a touch gesture
  cannot leave the motors latched on.
- **Drive blocks.** `Drive forward / backward / turn left / turn right` for a
  duration, sitting first and largest in the palette, alongside raw `Set pin` and
  `Motor speed` for students who want the wiring-level truth. A Drive block is
  not a black box: it resolves to plain pin writes and the Serial Monitor shows
  exactly which pins it wrote to.
- **Three languages** — English, Russian and Uzbek — covering every label, part
  name, block and sentence of the learning log. Switching language re-translates
  the history too, because only the lesson *key* is stored, never the finished
  sentence.

- **A snap matrix instead of free placement.** Every part declares which kinds
  of attachment point it *accepts* and which it *offers*, and snapping is just
  matching one against the other (`src/lib/parts.js`). A wheel accepts only a
  motor shaft, so it is structurally impossible to bolt one into a chassis hole
  or leave it half-buried in the ground — the two failure modes that made the
  earlier version feel broken. A wheel's position is not something you choose;
  it is a consequence of the shaft it sits on.
- **A real drivetrain, built in the open.** `chassis hole -> motor mount ->
  DC motor -> wheel`. Four separate parts, each of which has to be fitted in
  order, each explaining itself as it goes on. A motor runs only through both
  outputs of a powered L293D channel, including its two direction inputs,
  enable, common ground and separate 9 V motor supply. LEDs use a series
  resistor; sensors stay off the Uno and reach its real headers through visible
  leads.

## The one thing this app is really about

**Every action explains itself.** The right-hand rail is not a status bar — it
is the product. Bolt two strips together and it tells you that one bolt is a
hinge and two bolts are rigid, and *why* that is true of real machines. Draw a
lead to a header and it explains how that cable establishes the pin map. Press
Run and it tells you the world just
unfroze. Get a wheel stuck and it explains what a stalled motor does to real
hardware.

All of that copy lives in one file, `src/lib/coach.js`, written to a fixed
shape: what happened, what it means, and the engineering idea underneath.
Adding a new behaviour means adding its lesson at the same time.

---

## How a build becomes physics

This is the part that took the most care, so it is worth reading before
changing anything in `src/three/Build.jsx` or `src/lib/assembly.js`.

The naive approach is one physics joint per bolt. It looks obviously right and
behaves terribly. Bolt a board onto two rails that are already bolted to each
other and you have a **closed loop of rigid constraints**; the solver cannot
satisfy them all, the residual error feeds back as energy, and the robot
launches itself out of the arena. That genuinely happened here, repeatedly.

What ships instead uses the rule the app already teaches a child:

| bolts between two parts | meaning | physics |
| --- | --- | --- |
| one | a hinge | a real revolute joint |
| two or more | rigid | the parts are **welded into one rigid body** |

`planAssembly()` unions everything rigid into compound bodies and emits joints
only for genuine hinges. Because a part with exactly one bolt is always a leaf,
the joint graph is provably a forest — there is no loop left to fight.

Wheels are welded into their chassis body too, and the robot is driven by
**forces applied at each driven wheel** rather than by a motorised joint. That
is a deliberate trade: a free wheel hinge holding a heavy compound chassis at a
long lever arm, with a stiff motor twisting it, is the single most fragile
constraint in a build like this, and when it fails a child sees "the app is
broken". Welding the wheels and pushing at the contact patches keeps everything
that matters — real forces, real friction, real terrain, real differential
steering (drive the two sides at different speeds and the robot genuinely turns,
because the forces act at different points on the body). The wheels then spin
on screen at exactly the rate the robot is actually travelling, so nothing you
see is a lie. Wheel colliders use very low friction with `CombineRule.Min`,
since a welded wheel cannot roll and must be free to slide; grip is modelled by
the drive force's limit instead.

### Hard-won details worth not undoing

- **Collider transforms go on a wrapping `<group>`, never on the collider.**
  Setting `position`/`rotation` directly on a collider component leaves every
  collider piled at its body's origin. For a build sitting near the ground that
  means spawning inside the terrain and being flung into the sky.
- **The terrain mesh is generated already in world orientation.** A rotated
  mesh plus an auto-generated trimesh collider produced a vertical wall through
  the origin.
- **Bodies mount one frame before joints, and both after the terrain.** A joint
  built against a null body, or a robot created before the terrain collider
  exists, both end badly.
- **The physics world is created fresh on every Run.** A paused world carries a
  time accumulator across the pause and dumps it into the first step.
- **Motors stay off for the first 1000 ms.** Driving a constraint system that has
  not reached equilibrium yet injects a large impulse.
- **The robot never self-collides.** All robot colliders are in one interaction
  group that only collides with the world; a bolted assembly is held together by
  its joints, and letting its own plates grind together only feeds the solver.
- **Joint parameter arrays are memoised.** A fresh array each render makes the
  joint hook tear the joint down and rebuild it every frame.

---

## Layout

```
src/
  lib/
    config.js        every dimension, colour and tuning number
    parts.js         the part catalogue and the snap matrix (accepts/offers)
    geometry.js      attachment nodes, the mount chain, transforms
    stripGeometry.js three-bvh-csg hole cutting — cut once per length, shared
    assembly.js      bolted build -> stable rigid bodies + hinges
    program.js       blocks, Arduino code generation, generator interpreter
    coach.js         every explanation the app can give
    templates.js     the two starter builds, as ordinary save files
    toon.jsx         the shared cel-shading material + outline
    sfx.js           synthesised sound
  store/
    useBuildStore.js parts, bolts, pin map, program, save/load, undo
    useUiStore.js    panels, camera intent, learning log, toasts, X-ray
  three/
    Scene.jsx        canvas, lights, the frozen/simulated switch, view offset
    Build.jsx        rigid bodies, colliders, joints, wheel drive points
    Terrain.jsx      four authored environments, objectives and colliders
    Placement.jsx    carrying a part, node highlighting, rotate, cancel
    Runtime.jsx      program execution, wheel forces, stall detection
    Effects.jsx      camera presets + follow, FPS guard, smoke puffs
    PartMeshes.jsx   strips, deck, brackets, standoffs, casters, motors,
                     mounts, wheels, bolts, wires
    ArduinoUnoLowPoly.jsx  authored procedural Arduino Uno Rev3
  ui/                the 2D interface
```

### Two ideas worth knowing before you edit the geometry

**The snap matrix.** `parts.js` gives every part an `accepts` list and an
`offers` list over four node categories: `CHASSIS_HOLE`, `MOTOR_SEAT`,
`MOTOR_SHAFT` and `PCB_HEADER`. `candidateNodes(kind, parts)` returns only the
nodes a given part is allowed to use, and that single filter is what makes
whole classes of nonsense impossible rather than merely discouraged. Adding a
part means adding a row to that table; the palette, the snap highlighting and
the placement rules all follow from it automatically.

**The build floats; parts do not.** Flat parts are authored on a flat build
plane — a strip lies at `thickness / 2` — and wheels hang below that plane
exactly as they do on a real chassis. Nothing fudges its own height to
compensate. Instead `buildLift()` raises the finished assembly as one rigid
thing so its lowest point rests on the ground, which is why a rover ends up
standing on its wheels with the frame properly clear of the floor. The ball
caster is deliberately sized so `stem + ball == WHEEL.radius`, so a rover with
two driven wheels and two casters sits dead level with no tuning at all.

**Scale: 1 world unit = 25.4 mm.** Real Meccano-style strips use a 12.7 mm hole
pitch, so one pitch is exactly 0.5 units and every other measurement follows.
The Arduino Uno's real 68.6 × 53.4 mm outline is 2.70 × 2.10 units; the full-size
830-contact breadboard follows its real 165 × 55 × 10 mm envelope.

---

## Design decisions

The interface targets grades 5–7, which drove every choice: a warm paper
background instead of the usual dark developer theme, solid fills, 44 px hit
areas, one typeface, four accent colours with fixed meanings (blue = structure,
green = go, orange = power, red = stop). No neon, no glassmorphism, no glow on
every edge.

- **Click, move, click** instead of press-drag. It is far more forgiving for
  young hands and on trackpads, and it makes the "where can this go?" feedback
  readable while you are moving.
- **Structural parts use exact quarter-turn orientations.** The 24-element
  orientation group permits horizontal, upright and side-facing assemblies
  while keeping hole axes and snap decisions integer-exact and predictable.
- **Blocks, with the generated Arduino C++ shown live next to them.** A
  ten-year-old should not lose an afternoon to a missing semicolon. The real
  code is always one tab away, so blocks are the way in rather than a
  replacement. The evaluator is a generator walking the block tree — there is no
  `eval()` and no `new Function()` anywhere near student input.
- **Building is frozen, running is physical.** Nothing settles or drifts while
  you work; Run drops the machine onto the terrain, Stop puts it back exactly
  where you built it. An experiment is never destructive.
- **The camera follows the robot while it drives.** A rover that leaves the
  frame is the fastest way to make a child think their program did nothing.

## A note on the block palette

An earlier version shipped a palette with no drive block at all: `Print`,
`Set pin`, and a raw `Motor speed` that required you to already know which pin a
wheel was bound to. The rover's starter program opened with
`Print "Rover: driving forward"`, and a tester quite reasonably edited that text
to "turning left" and expected the robot to turn. It printed different text and
drove the same way.

Every control was working. The palette was the bug: it made a label look like a
command and hid the actual controls behind wiring knowledge. That is why `Drive`
now leads the palette, `Print` is called `Say` and describes itself as "It does
not move anything", and the starter rover is written with Drive blocks — change
the dropdown from *forward* to *turn left* and the rover really turns.

## Workshop controls and learning

Select a structural part to edit its X/Y/Z coordinates in the inspector, rotate
around any axis, pick it up or make a detached copy. R/T/F turn around world
Y/X/Z; Shift reverses the turn. E/Q adjust carrying height. Arrow keys move a
selected plate; PageUp/PageDown adjust height. Snap can be disabled for placing
structures. Mechanical fittings still require a compatible mounting point.

Quarter-turn orientations, bounded three-dimensional snapping, raised mounting
holes and saved bolt endpoints share the same geometry model. Pickup/place is
one undo step; save format v4 retains v2/v3 template compatibility.

The electronics bench includes a procedural 830-contact solderless breadboard.
Its A–E and F–J terminal rows, centre trench and split power rails form real
electrical nets: a lead can terminate in any hole in a connected strip and a
component footprint occupies the physical holes beneath its pins. The solver
reports shorts, reversed LEDs, bypassed resistors and missing power instead of
accepting a circuit that only looks connected.

The construction kit now includes long strips, 3×5 plates, turntable halves,
meshing gears, a gripper and jaws. Open one-bolt chains become real revolute
joints while closed, multi-bolt contours remain rigid. Powered three-wire
servos drive those joints from 0–180° program blocks, which is exercised by the
six-axis robot-arm template rather than represented as a decorative animation.

The workshop UI is organised as a four-step rail — Build, Circuit, Code and
Simulate — with one context panel at a time. Generated tool illustrations use
the same physical-kit visual language, while text labels, circuit-state badges,
keyboard focus and reduced-motion handling keep the workflow understandable
without relying on icon colour alone.

The sensor lab shows electrical readiness, live values and twelve-second
histories for twelve devices: ultrasound, line, light, temperature, touch,
tilt, encoder, phototransistor, TMP36, tilt switch, potentiometer and push
button. Powered circuits need VCC, GND and unambiguous signal leads to the same
board. Sensor operands work in conditions and variables, and round-trip through
`readSensor(pin)` in the editable workshop C++ subset. A circuit error stops
motor commands and reports the missing connection. Programs begin after the
1000 ms physics settling period, preserving short opening commands.

The interactive workshop guide contains illustrated, action-checked lessons and
a part reference in Uzbek, Russian and English. Progress is saved locally.

The Uno itself is a from-scratch low-poly model based on the Rev3 top-view
pinout. It exposes only four mechanical mounting holes and its real electrical
headers. External LEDs and sensor modules must mount on the frame and connect
with visible leads; there are no invented component sockets on the PCB.

## Simulation limits

- Building remains best with a desktop pointer and keyboard. The guide and
  sensor controls adapt to smaller screens; full touch-based 3D construction
  is not a verified feature.
- Ultrasound uses one physics ray, without acoustic beam/material modelling.
  Line sensing casts a bounded real physics ray to the floor. In the line lab,
  the renderer and sensor share the exact same oval, figure-eight or switchback
  samples; the original proving-ground ring remains supported. Touch uses a
  short contact ray.
- Light and temperature are controlled experiment inputs, explicitly labelled
  as simulated. Tilt uses orientation relative to gravity. Encoder angle comes
  from the simulated wheel's contact-point travel, without shaft-slip or pulse
  electronics modelling.
- Generated C++ uses workshop helpers. Real hardware needs the corresponding
  motor-driver and sensor libraries; exporting it is not a hardware upload.

---

## Tooling

Built with AI-assisted tooling in the loop, principally Claude Code, for
implementation and review passes.

The distinction that matters: the architecture, the product decisions and the
acceptance of every change are the author's. The model is one of the tools used
to get there, alongside the test harnesses in `tools/` that gate what is
allowed to land — several of which were written before the code they test, and
two of which have caught the model being confidently wrong.
