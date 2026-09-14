# Architecture notes

Working notes for anyone editing this repository. Read `README.md` too — that
has the full architecture writeup with diagrams and rationale. This file is the
condensed, action-oriented version: what to run, and the things that are not
obvious just from reading the code.

## What this is

ARDUINIUM — a browser-based 3D robotics sandbox for grades 5–7. Students bolt
together Meccano-style parts into a rover, wire up an Arduino Uno with real
Dupont leads, write a program in Scratch-style blocks, then watch it actually
drive on real physics (Rapier/WASM) across a small arena. English, Russian and
Uzbek throughout.

## Stack

React 19 + Vite 8 + `@react-three/fiber` + `@react-three/drei` +
`@react-three/rapier` + `three-bvh-csg` (real boolean hole-cutting) +
`simplex-noise` + `zustand`. Ships as one self-contained HTML file via
`vite-plugin-singlefile` (Rapier's WASM gets inlined too).

## Two apps, one repo

This repo now holds **two applications that share `src/` and `node_modules`**:

| | Entry | Build | What it is |
|---|---|---|---|
| Sandbox | `index.html` → `src/main.jsx` (Vite) | `dist-single/index.html` | The 3D workshop. Unchanged. |
| Site | `app/` (Next.js 16, App Router, TS, Tailwind v4) | `.next` | The marketing/learning platform around it. |

There is also `prototype/index.html`: a **third, independent artifact** — the
landing + register + app-stub as one self-contained file, no build and no
framework, built to its own written spec (hash router, GSAP from cdnjs,
Fontsource Manrope, inline-SVG logo and mascot, canvas pixel-ripple). It is
not part of either build and imports nothing from `src/`. Treat it as a
deliverable in its own right, not as a copy of the site — the two are
different designs, and `tools/proto-test.mjs` is its gate.

The site imports the sandbox **at source level** (`@sandbox/*` → `./src/*`) and
mounts it at `/learn/simulator` via `next/dynamic({ ssr: false })`. There is no
iframe and no second copy of the code. This works because the sandbox uses no
`import.meta`, no `?url` imports and no other Vite-only API — check that still
holds before adding one.

**Nothing in `src/` was rewritten for the site**, which is what keeps the nine
harnesses below a valid regression gate for both. The two edits that were
needed are presentation-only and carry their own comments:
`src/styles.css` scopes its route-level and element resets (see the SCOPING
note there), and `index.html` gained the `ard-sandbox-page` class those rules
key on.

## Commands

- `npm install`
- `npm run dev` — **the site** (Next, port 3200)
- `npm run sandbox:dev` — the standalone sandbox (Vite)
- `npm run build` — production build of the site
- `npx vite build --mode single` — single-file build to `dist-single/index.html`
- `npm run db:seed` / `npm run db:reset` — demo data into Supabase (needs
  `.env.local`; see README §The backend)
- The Arduino board is authored procedurally in
  `src/three/ArduinoUnoLowPoly.jsx`; it has no converter or runtime asset.

### Test suites

Build the single-file bundle first — every browser harness loads
`dist-single/index.html` from disk.

| Command | Covers | Expected |
|---|---|---|
| `node tools/model-test.mjs` | Block-editor model layer, pure node, no browser | 38/38 |
| `node tools/editor-test.mjs` | Block editor UI (`?editor=1`) | 37/37 |
| `node tools/edit-test.mjs` | rotatePart, undo/redo, move, delete | 32/32 |
| `node tools/wiring-test.mjs` | Terminals, wire rules, pin map, save/load | 28/28 |
| `node tools/wiredrag-test.mjs` | Real-mouse drag wiring | 14/14 |
| `node tools/mount-test.mjs` | Upright post, raised holes, L-bracket node | 20/20 |
| `node tools/code-test.mjs` | Emitter, parser, round trip, tree ops — pure node | 36/36 |
| `node tools/codeui-test.mjs` | Code tab, new blocks, drag-to-reorder/nest | 30/30 |
| `node tools/shot.mjs <out.png> <scenario>` | Smoke test + screenshot | — |
| `node tools/web-test.mjs` | The Next.js site: every route, i18n, responsive, sandbox-inside-Next | 69/69 |
| `node tools/phase2-test.mjs` | Backend, AI assistant, admin panel, secrets hygiene | 107/107 |
| `node tools/proto-test.mjs` | The single-file prototype (`prototype/index.html`) | 50/50 |

`web-test.mjs` and `phase2-test.mjs` are the odd ones out — they load a
**running dev server** rather than `dist-single/index.html`, so start one first
(`npm run dev`). `web-test.mjs`'s most
valuable assertions are the ones that guard the seam: that the sandbox's
stylesheet does not leak page-scroll or button resets into the site, that
client-navigating away from `/learn/simulator` undoes them, and that the rover
template still assembles, wires and drives *inside Next* — the same scenario
`shot.mjs drive` runs against the standalone build, so the two numbers are
directly comparable.

`phase2-test.mjs` runs against an **unconfigured** instance — no Supabase, no
API key — because that is the state a fresh clone and CI are in, and because
the unconfigured behaviour is itself a requirement. The database rules it
cannot exercise live in SQL and are asserted structurally: every table has
policies, and `ai_messages` has no teacher or admin policy at all. To check the
*configured* paths by hand (login form present, `/admin` and `/ai` redirecting,
the register form growing an email + password field), set
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to any
syntactically valid values and restart the dev server — the gating is exercised
before any request reaches the database. Next 16 refuses a second `next dev` in
the same directory, so stop the first one.

`shot.mjs` scenarios: `boot led rover drive code xray build drivetrain mission
ru uz`. Screenshots land in `shots/` (gitignored) — read them with the Read
tool after anything touching `Build.jsx`, `Placement.jsx`, `Terrain.jsx`,
`PartMeshes.jsx`, `SensorMeshes.jsx`, `KitPartMeshes.jsx` or `Wiring.jsx`.

`tools/diag/` holds throwaway view-specific screenshot scripts (top view,
side view with wiring mode on). Handy for eyeballing geometry changes.

### Clicks vs. drags in tests

Most harnesses dispatch clicks (`el.dispatchEvent('click')`) instead of
`page.click()`. The full-bleed WebGL canvas under software rendering
(`--use-gl=swiftshader`) keeps the main thread too busy for Playwright's
post-click settle-wait to resolve, so a normal `.click()` hangs for 30s and
throws. Follow that pattern for new steps.

The exception is `wiredrag-test.mjs`: a drag is pointerdown → pointermove →
pointerup against R3F's raycaster, and only real `page.mouse` events produce
the intersections it needs. Synthetic clicks cannot test it.

## Environment caveats (read before trusting a test result)

- **Playwright is not in `package.json`** despite every harness importing it.
  Install with `npm install --no-save playwright`, then
  `npx playwright install chromium-headless-shell`. `phase2-test.mjs` also
  *optionally* uses `libpg-query` (Postgres's own parser, as WASM) to check the
  migrations parse; install both in one command —
  `npm install --no-save playwright libpg-query` — because a second `--no-save`
  install prunes the first one.
- **Install the headless shell specifically.** The full Chrome-for-Testing
  build fails to start on Windows without the MSVC Redistributable
  ("the side-by-side configuration is incorrect"). `chromium_headless_shell`
  has no such dependency and is what `chromium.launch()` picks by default.
- **`tools/ui-test.mjs` used to carry an absolute path** from whichever machine
  wrote it, so it only ran there. It now resolves `dist-single/` relative to
  itself like the other harnesses, but it has not been used as a gate in a long
  time — treat a pass from it as informational.
- **`shot.mjs boot` is flaky** — roughly 1 run in 3 dies with
  "Unable to capture screenshot" under swiftshader. Retry before investigating.
- **`getState()` returns a snapshot.** In `page.evaluate`, re-read
  `window.__ARDUINIUM_BUILD__()` after every mutation. Holding one reference
  across several `commitPlace()` calls reads parts that were current several
  placements ago — this has produced two separate false test failures.

## The ideas that drive everything else

**The snap matrix** (`src/lib/parts.js`). Every part declares an `accepts`
list and an `offers` list over three node categories: `CHASSIS_HOLE`,
`MOTOR_SEAT` and `MOTOR_SHAFT`. `candidateNodes(kind, parts)` in
`geometry.js` is the *only* function that decides what a held part is allowed
to snap to. A wheel accepts only `MOTOR_SHAFT`, so it is structurally
impossible to bolt one into a chassis hole or leave it floating in the
terrain. Adding a new part means adding a row to `PART_SPECS` plus a mesh in
`PartMeshes.jsx` — the palette, snap highlighting and placement rules all
follow from that row automatically.

**The mount chain** (`chainTransform` in `geometry.js`). Fittings — motor
mount, motor, wheel, caster, standoff, L-bracket, and now the sensor — own no
position of their own. Each derives its transform by walking up to whatever
flat part ultimately carries it: `chassis hole -> motor mount -> motor ->
wheel`, all sharing one axis. A wheel's position is a *consequence* of the
shaft it's on, never a free placement.

**Structure and electricity are separate systems.** The snap matrix decides
what bolts to what; `src/lib/terminals.js` decides what can be wired to what.
A sensor bolts to the chassis for mechanical reasons and reaches the Arduino
for electrical ones — different questions, different answers. Motors live in
`CATALOGUE.structure`, but their electrical state comes only from a complete
L293D circuit resolved in `src/lib/circuits.js`.

**Rotation is the 24-element quarter-turn group now** — see `src/lib/orient.js`
and the rewritten section in CLAUDE.md. The paragraph below describes the
original yaw-only design and is kept for the history of the decision; parts
today carry `rot: 0..23` (plus a derived `rotY` mirror), fittings may carry
`spin`, and saves are format v3 with a lossless v2 migration.

**Rotation is yaw-only.** (historical) Parts carry `rotY` and nothing else; `yaw()` in
`geometry.js` is used in a dozen places and the whole snap/mount system is
authored in the ground plane. Adding X/Z rotation means rewriting that core —
it is not a local change. Deliberately deferred.

The whole assembly floats as one unit: parts are authored on a flat build
plane (a strip sits at `y = thickness / 2`) and `buildLift()` raises the
finished build so its lowest point rests on the ground. Don't give individual
parts a negative Y fudge to compensate for wheel or caster overhang — fix
`buildLift()` or the part's `partHalfHeight()` instead. The ball caster is
deliberately sized so `CASTER.stem + CASTER.ball == WHEEL.radius`.

## Subsystems added since the original writeup

### The Arduino board model

`src/three/ArduinoUnoLowPoly.jsx` authors the Uno Rev3 from primitives and one
small extruded PCB outline. Its layout follows the supplied top-view pinout:
the USB and barrel connectors, split header blocks, ATmega328P package, USB
controller, crystal, reset switch and ICSP headers are recognizable at the
sandbox camera scale. The same low-poly model is used at both quality levels.

The previous manufacturer WRL asset and conversion pipeline were removed.
Board headers are electrical terminals, never mechanical component sockets.
LEDs, sensors and kit components mount on the frame and connect through
explicit leads.

### Wiring

- `src/lib/terminals.js` — the full Rev3 pinout plus motor/sensor/LED
  terminals. Positions are local to the part and resolved through
  `partTransform`, so a wire never stores a coordinate.
- `src/lib/wirePath.js` — one shared curve for every lead: vertical exit from
  the plug, an arch over the tallest obstacle between the ends, then sag.
- `src/three/Wiring.jsx` — interactive drawing: pin dots, live lead, commit.
  Behind the **Wiring** toggle in the top bar (dots are hidden otherwise).
- `pinMap()` in the build store derives a wired device's pin from the cable,
  which is what makes the harness mean something rather than just look like
  something.

### Building upwards

`mountHoles(kind)` in `parts.js` is the vertical half of the snap matrix.
`CHAIN_OFFSET` says how far a fitting sits ALONG the chain axis; `mountHoles`
says where it hands out new holes, in its own local frame (+X along the chain
axis, +Y up). Three parts return something: the standoff (one, on top), the
L-bracket (one, at the top of its upright arm) and the `upright` post (one per
`PITCH` up its length).

Two consequences worth knowing:

- **The mesh and the snap node read the same numbers.** `UprightMesh` draws its
  holes from `mountHoles('upright')`. The L-bracket used to hard-code its node
  as "straight up by one arm" while the mesh drew that hole half an arm along
  +X, so the ring a student aimed at and the place the part landed were
  different places.
- **A host that raises holes places its child AT the chosen hole**, not further
  along the chain axis (see `chainTransform`). Stepping along the axis is right
  for the drivetrain and wrong for anything that gains height — every level of
  an upright would land its child in the same spot, and it also cancelled a
  standoff's whole purpose, putting a sensor bolted to one at exactly the
  height it would have had bolted straight to the strip.

Stacked holes share an X/Z, so `resolveSnap` cannot tell them apart by
`distXZ`. `Placement.jsx` therefore passes a `hint` — the node nearest the
cursor ON SCREEN — and the store honours it. Without a hint (a template, a
test) it falls back to X/Z, preferring a free node over an occupied one and
then the lowest, so fittings fill a post from the bottom up.

### Text code, and blocks with variables

The Arduino tab is editable. `toArduinoCode()` emits; `src/lib/arduinoParser.js`
reads the same subset back into the **same block tree**, which `makeRunner()`
then executes — there is one interpreter, so text and blocks cannot drift into
meaning different things. No `eval`, no `new Function`: student text is
tokenised and parsed, never executed as JavaScript.

The property to preserve is the **round trip**: blocks → C++ → blocks must come
back unchanged, or a student who opens the code tab and switches back has had
their program silently rewritten. `code-test.mjs` asserts it for every block
type. Two places that costs something:

- A Drive block emits three statements (start, wait, stop), so `foldDrives()`
  puts them back together. Reading them one at a time would triple the program
  every time the tab was opened.
- `if (readDistanceCm() < 20)` parses back to `ifDistance`, not the general
  `ifCompare`, because that is the shape the friendly block emits.

Variables are globals above `setup()` in the emitted C++ and live for the whole
run in the interpreter — that is what makes "add one to count" inside a Repeat
forever actually count. Division is integer division in both, so the two cannot
disagree. Names go through `safeVarName()` at the edge: whatever a student types
is emitted as an identifier and read back as one, so anything that is not a
plain identifier is filtered rather than guarded at every use.

### Block canvas editor

A separate 2D grid editor at `?editor=1` (`src/editor/`). Deliberately not
wired into the 3D workshop; `main.jsx` picks one or the other. Pure model
layer in `src/editor/model.js` with no React or DOM, which is why
`model-test.mjs` needs no browser.

### The site (`app/`, `components/`, `lib/`)

Design concept is **"perfboard"**: the page sits on a visible engineering dot
grid, sections are joined by drawn PCB traces with solder pads, and one offset
hard shadow (`--shadow-hard`) is used on every button, card and input. Colours
carry fixed electrical meanings — orange is power/CTA, teal is signal/success,
pink is achievements only and appears exactly twice in the whole product.

- **Tokens live in CSS, not `tailwind.config`.** Tailwind v4 is configured
  through `@theme` in `app/globals.css`. The palette is the spec's, verbatim.
- **Never introduce a bare `--card` / `--teal` / `--orange` variable in
  `globals.css`.** The sandbox's `:root` already defines those names and both
  stylesheets are live on `/learn/simulator`. Tailwind namespaces everything
  as `--color-*`; anything else of ours is prefixed `--ard-*`.
- **i18n is `t.hero.titleA`, not `t('hero.titleA')`.** `lib/i18n/en.ts` is
  typed as the Uzbek dictionary's shape, so a missing translation is a build
  error rather than a raw key rendered in front of a reader.
- **`useLocalState` is the fallback persistence, not the only one.** See the
  backend section below: with no `.env.local` the site still behaves exactly as
  it did in Phase 1, and progress, posts and the registration answers go to
  localStorage.

### The backend (`supabase/`, `lib/supabase/`, `lib/auth/`, `lib/ai/`)

Supabase — Postgres, Auth and RLS. Three migrations, applied in order:
`0001_schema.sql`, `0002_rls.sql`, `0003_functions.sql`. `supabase/seed.mjs`
fills a fresh project with a demo school; it imports the curriculum straight
from `lib/content/*.ts` (Node 24 strips the types), so the seeded catalogue
cannot drift from what the lesson pages render.

**The site runs in two configurations and both are supported.** `hasSupabase`
in `lib/supabase/config.ts` is the switch. Unconfigured, every Phase 1 screen
works and the three routes that genuinely need a server (`/ai`, `/admin`,
`/login`) render `NotConfigured` instead of redirecting to a sign-in that could
not succeed. That is what keeps `web-test.mjs` a valid gate on a machine with
no database, and it is why the browser clients return `null` rather than
throwing — every caller reads `const db = supabaseBrowser(); if (!db) {…local…}`.

**`0002_rls.sql` is the access-control spec, not a copy of it.** The table in
its header is the product decision; the policies below it are the enforcement.
Two properties are worth protecting by hand:

- **`ai_messages` and `ai_conversations` have no teacher or admin policy.** A
  student's conversation with the assistant is theirs. "Show me the student's
  chat log" is not a query someone can write later — they would have to add the
  policy first. `phase2-test.mjs` fails if one appears. What a teacher does see
  is `activity_log`: that the assistant was used, and when.
- **Role escalation is closed in two places.** `guard_profile_privileges` (a
  trigger, `0001`) stops a user changing their own `role` or `school_id`, and
  `handle_new_user` only honours `student`/`teacher` from signup metadata. The
  `/register` form offering two roles is presentation; these two are the rule.

**RLS helper functions must be `SECURITY DEFINER`.** A policy on `profiles`
that selects from `profiles` recurses and Postgres aborts the query. `my_role()`,
`teaches_student()` and friends step outside RLS for that one lookup, which is
what breaks the cycle — and they carry `set search_path = public` so the
definer privilege cannot be aimed at a shadowed table.

**The admin functions are `SECURITY INVOKER` on purpose.** `admin_overview()`
and `admin_teacher_activity()` run as the caller, so the policies still apply
inside them. `/admin`'s route-level `requireRole` is a courtesy to the reader;
deleting it would make the page render *empty*, not leak.

**The AI key exists in one process.** `app/api/ai/chat/route.ts` is the only
caller of `lib/ai/provider.ts`, which is the only importer of the Anthropic SDK,
and both carry `import 'server-only'`. There is no client-side path and no
fallback that would create one. The route authenticates, then claims a slot from
the daily allowance, then talks to the model — in that order, so neither an
anonymous request nor an over-quota one costs anything.

**`ai_rate_limit_take()` does the check and the increment in one statement.**
The obvious read-then-write version has a race with a bill attached: two
requests both read "9 of 10 used" and both proceed. It fails closed — a database
error means no model call.

**Ardu reads the sandbox, never writes to it.** The slide-over in the workshop
toolbar (`components/sandbox/ardu-panel.tsx`) takes its context from the debug
hooks already on `window` plus `toArduinoCode()`, at the moment a question is
sent. No file under `src/` changed. `phase2-test.mjs` asserts the scene keeps
running, the part count is unchanged and the canvas keeps its size while the
panel is open.

## Hard-won gotchas — do not reintroduce these

### The site / sandbox seam

- **Unlayered CSS outranks every `@layer`.** `src/styles.css` is plain CSS, so
  its `button { border: none; background: none }` reset beat Tailwind's own
  utilities the moment the file loaded, silently stripping the border off every
  hard-shadow button on the site. Element resets there are now confined to
  `.app` / `.bc-app`. Anything new added to that file at element scope has the
  same reach — scope it.
- **`body { overflow: hidden }` is fatal to a marketing page.** It is correct
  for a full-screen tool and it removes all page scrolling everywhere else.
  Route-level rules in `src/styles.css` are gated on `html.ard-sandbox-page`,
  and `SandboxMount` removes that class on unmount. Drop the cleanup and the
  whole site stops scrolling the moment someone visits the sandbox once.
- **Scroll-reveal must default to VISIBLE.** `opacity: 0` in CSS with JS
  removing it means every failure mode ends in permanently invisible content —
  this produced a landing page with the hero, the footer, and eight blank
  bands between them. `.ard-reveal` only hides on `[data-shown="false"]`,
  which the component writes after it has measured; it also shows immediately
  for anything already on screen, so above-the-fold headings do not wait for a
  scroll that may never come.
- **A `postcss.config.mjs` at the root is picked up by Vite too.** Vite
  searches upward for one, found the site's Tailwind config, and would have
  run it over `src/styles.css`. `vite.config.js` pins `css.postcss` to empty.

### Auth and data

- **`proxy.ts`, not `middleware.ts`.** Next 16 deprecated the older file
  convention and warns on every build until it is renamed; the export is
  `export default async function proxy(request)`. What it does is force a
  session refresh — a Server Component cannot write a cookie, so without this
  the refreshed token has nowhere to land and a reader who leaves a tab open is
  signed out mid-lesson.
- **`getUser()`, never `getSession()`, for anything that gates.** The former
  re-validates against the auth server; the latter trusts a cookie the browser
  handed over. In front of a school's data that difference is the whole point.
  `getViewer()` also never throws — an auth outage must degrade to "signed out"
  (recoverable) rather than a 500 on every gated page.
- **Community posts carry `author_name` and `author_role` denormalised**, and
  the reason is privacy rather than performance. Posts are readable by everyone;
  profiles are not. Joining the feed to `profiles` for a display name would
  force a policy letting every child read every other child's record.
- **AI history is fetched newest-first and then reversed.** Ordering ascending
  with a `LIMIT` replays the *oldest* turns and silently drops everything said
  since — the assistant keeps answering a question from ten minutes ago.
- **`useProgress` keeps its Phase 1 signature.** It swapped a localStorage body
  for a Supabase one and gained `error`/`synced`, but `/learn`, the lesson page
  and the sandbox chrome consume it unchanged and none of them learned about
  auth. Extend the return value; do not change what is already there.

### Physics and 3D

- **Collider `position`/`rotation` props are silently ignored by
  `@react-three/rapier`.** Wrap every collider in a `<group position rotation>`
  or the whole compound body piles up at the origin and the robot spawns
  inside the terrain.
- **`<Physics>` must remount on every Run**, never stay paused between runs —
  a paused world dumps its accumulated time into the first step and explodes.
- **Terrain trimesh geometry must be authored in world orientation**, not
  built flat and rotated — a rotated-plane trimesh becomes an invisible wall.
- **Revolute joint params must be memoized** (`useMemo`).
- **Wheels are driven by applied force, not Rapier's joint motor.**
- **Never derive "forward" from a single wheel's mount axis** — the two sides
  point opposite ways. `driveFrame()` in `Build.jsx` computes one shared
  direction for the assembly.
- **Wheels have no pin of their own.** Resolve through `drivenPin(wheel,
  parts)` in `Build.jsx`.

### Rendering

- **Vertex colours are LINEAR.** three.js applies the sRGB transfer curve on
  output, so any future authored vertex colours must be converted from sRGB
  before they are stored.
- **Use the shared toon ramp, not Lambert.** The scene runs ~4.5x total light
  (2.5 key + 0.85 ambient + 0.6 hemisphere + 0.55 rim), which a Lambert
  material multiplies straight into the base colour and clips.
  `MeshToonMaterial` caps at 1.0 through its 4-step ramp — that is why every
  other mesh looks right.
- **Measure the model, don't assume.** Every guessed constant against the
  Rev3 mesh has been wrong: the PCB threshold cut *inside* the slab, the
  header Z came from the plastic body's median rather than the pin tips
  (2 mm out), and header blocks centred on their bodies put pins over bare
  plastic. Cluster the vertices and read the numbers off.
- **No in-scene text — never drei's `<Text>`.** It is troika, which fetches
  Unicode font metadata from a CDN the first time it lays out a string, and
  drei's wrapper *suspends* until that resolves. Over `file://` — how
  `shot.mjs`, every harness and every student loads the built bundle — Chrome
  blocks that fetch outright, so it never resolves. `Wiring` renders inside
  Scene's `<Suspense fallback={null}>`, so one hover over a pin blanked the
  whole 3D view: no terrain, no build, no pin dots, for as long as a lead was
  held. Pin labels are a canvas texture on a sprite instead (`PinLabel` in
  `Wiring.jsx`) — no network, no suspense, billboarded for free. The same trap
  waits for any library that lazily fetches an asset; this is the constraint
  that already keeps the Arduino mesh out of `public/`.

### State and React

- **i18n log entries store `{key, params}`, never the rendered sentence** —
  see `useUiStore.teach()`, so switching language re-translates history.
- **Never commit from inside a `setState` updater.** StrictMode double-invokes
  updaters, which applied a wire drop twice. Mirror the value into a ref.
- **Plain window listeners are auto-batched by React.** The keyboard handler
  is a window listener, so ten arrow presses in one task all read the same
  stale state. Ops a user can fire rapidly must derive from the committed
  value inside the updater (see `moveSelection`).
- **Pick-up and place is ONE undo step.** `pickUpPart` snapshots; therefore
  `commitPlace` must not snapshot again when `pending.from` is set, or one
  undo lands between them and the part vanishes with nothing in hand.
- **A moved part keeps its id.** `commitPlace` reuses `pending.from.id`.
- **Align/distribute need a whole-set overlap check.** Validating each moved
  block against only the blocks that stayed put approves a board where the
  moved ones landed on each other (`hasOverlaps` in `editor/model.js`).
- **A wire lands on what the preview shows, not on what the raycast hits.**
  Committing from a pin's own pointer handler needs a hit on its grab sphere —
  about four pixels across for a board pin — while the snapper that draws the
  preview reaches thirty-four (`SNAP_NDC`). A lead could sit previewing "D9"
  in green and still be thrown away on release for missing a four-pixel
  target, and when the raycast *did* hit, overlapping spheres let it land on a
  neighbour instead. Both press and release now commit to `wiring.target`.
  Any new "release does X to the thing under the cursor" gesture has the same
  choice to make, and the answer is the same.

## Known issues

- The board's header posts sit at roughly 2.3 mm effective spacing in the
  model and only ~16 of 18 digital posts are modelled, so pins sit on the
  strip at the nominal 2.54 mm pitch but do not each cap an individual post.
- **The migrations have not been run against a live Postgres from this repo.**
  There is no Supabase project attached and no local `psql`/Docker on the
  development machine, so `supabase/migrations/*.sql` is verified by parsing it
  with Postgres's own grammar (`libpg-query`) and by review, not by execution.
  Syntax is covered; a wrong column name or a policy that behaves differently
  from how it reads is not. Run all three against a scratch project once before
  trusting a deployment, and run the seed script after — that exercises every
  table, both triggers and the whole policy set from a real client.

## Debug hooks

Exposed on `window` from `App.jsx` / `Effects.jsx`:

`__ARDUINIUM__()` summary · `__ARDUINIUM_BUILD__()` whole build store ·
`__ARDUINIUM_UI__()` · `__ARDUINIUM_SCENE__()` mesh/triangle counts plus
`project([x,y,z])` → page pixels · `__ARDUINIUM_TERMINAL__(partId, terminalId)`
→ world position · `__ARDUINIUM_XFORM__(partId)` resolved world transform ·
`__ARDUINIUM_NODES__(kind)` every snap node that kind may use ·
`__ARDUINIUM_LOAD__/RUN__/SETPROG__/PROG__/PARTS__/RT__`.

`__ARDUINIUM_LOAD__` takes a build JSON, **not** a template id — load a template
the way `shot.mjs` does, by clicking `[data-testid="templates"]` then
`[data-template="<id>"]`.
The block editor exposes `__BC__()`, `__BC_EXPORT__()`, `__BC_IMPORT__(data)`.

## After any change

1. `npx vite build --mode single`
2. Run the suites relevant to what you touched (table above). If you touched
   the store, geometry or config, run all of them — they are fast.
3. `node tools/shot.mjs drive.png drive` — the one that actually catches
   physics regressions. `travelled` should be a sane positive number, not ~0
   and not huge; `distance` non-zero proves the sensor is wired through.

For site or backend changes: `npx tsc --noEmit`, `npm run build`, then
`npm run test:web` and `npm run test:phase2` against a running `npm run dev`.
Touching `supabase/migrations/*` means re-running the three files against a
scratch project — the parse check in `phase2-test.mjs` catches syntax, not a
column that does not exist.

A note on failures: two suites in this repo were written before the code they
test, and several "bugs" found this way turned out to be flaws in the test
rather than the product. Check which one is wrong before changing either — and
when a test is genuinely right, leave it failing rather than relaxing it.
