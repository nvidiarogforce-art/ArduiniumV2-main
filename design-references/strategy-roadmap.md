# Arduinium — strategy and roadmap

Context for why the product is shaped the way it is, and what order the
remaining pieces come in. This is not a build list — the build list is
`sitemap.md`.

> **On numbers.** Nothing in this document quotes a market size, a user count,
> a conversion rate or a revenue figure, because none has been measured. Places
> where a real number belongs before this goes in front of an investor are
> marked `[content pending]`. Inventing one that looks authoritative is the
> fastest way to lose a room, and it is the single rule the whole product's
> copy is written under.

---

## 1. The problem, stated precisely

Three separate obstacles stop a school from teaching robotics. They are
usually discussed as one problem — "schools lack resources" — and that framing
is why they rarely get solved.

**1. Hardware does not divide.** One Arduino kit serves one or two students.
Equipping a class means buying a class's worth, then replacing what breaks,
gets lost, or gets shorted out. The cost is recurring, not one-off, and it
scales linearly with every new class.

**2. There is no robotics teacher.** This is the harder constraint, and the
one most competitors ignore. A school can be given hardware and still have
nobody able to run the lesson. What schools do have is an informatics or
technology teacher — someone already comfortable with computers, already on
staff, and with no route into robotics.

**3. Theory never becomes practice.** Where robotics is taught without kit, it
is taught from a diagram. Students who can label a circuit have never wired
one, never got it wrong, and never had to find out why nothing happened.

**Arduinium answers all three, and the second one is the moat.** A simulator
alone answers (1) and (3) — and several exist. Pairing it with a
train-the-trainer track answers (2), which is what makes the product sellable
to an institution rather than to an individual hobbyist.

`[content pending]` — number of general schools in the target region, and an
estimate of how many currently run any robotics instruction. Needed for the
top of the funnel in any investor deck.

---

## 2. What is actually built

The differentiator is not the marketing site. It is the workshop underneath it,
and it is further along than a typical MVP:

- **Real physics.** The rover drives on Rapier (WASM). Weight distribution
  matters; a badly built robot tips. This is not a scripted animation.
- **Real wiring.** The full Arduino Uno Rev3 pinout, with leads the student
  drags pin to pin. A lead on the wrong pin produces a program that does not
  work — the same failure, and the same debugging, as on a bench.
- **A structural grammar.** Parts declare what they accept and what they offer.
  A wheel only seats on a motor shaft, so building the robot *wrongly* is not
  merely discouraged, it is impossible. Students spend their attention on the
  circuit and the code rather than on fighting the editor.
- **Blocks and C++ that cannot disagree.** One interpreter runs both. Blocks
  emit C++; that C++ parses back into the same block tree. A student who opens
  the code tab and switches back has not had their program silently rewritten.
- **Three languages** in the workshop (UZ / RU / EN), two on the site.

That is the asset. Everything in this roadmap is distribution around it.

---

## 3. Phasing

### Phase 1 — MVP (this pass) ✅

Landing page, registration, student area, lesson catalogue, the workshop
integrated with lesson context, video modules, community feed, pricing.
Bilingual throughout. No backend: everything persists to the browser.

**What it is for:** showing that the product exists end to end and that the
workshop is real. It is a demo, and it is honest about which parts are demo —
stubs say they are stubs, placeholder video says it is placeholder.

### Phase 2 — Persistence and accounts

The single largest open decision (see §5). Everything else is blocked on it:
saved builds, real progress, teacher visibility into a class, community
replies, anything that survives a browser reset.

Deliverables: auth, per-user progress, saved robot builds, community posts and
replies on a server.

### Phase 3 — The teacher product

This is where the business is, and it should not wait for polish elsewhere.

Deliverables: teacher dashboard, class rosters, assign-a-task, per-student
progress, downloadable lesson plans, and the certification track — a teacher
completes modules, is assessed, and receives something they can show their
school. `[content pending]` — whether certification needs accreditation from a
ministry or institute to carry weight locally, and what that process requires.

### Phase 4 — Schools as customers

School administrator panel, institution-level reporting, invoicing, and the
quote-to-contract flow that `/pricing` currently ends at with a form.

### Phase 5 — AI assistant

A helper inside the workshop that answers "why isn't my LED lighting?" by
reading the student's actual build and program rather than giving generic
advice. The hook exists in the sandbox chrome today as a visibly disabled
button. Deliberately late: it is only valuable once there is enough real
student work to know what students actually get stuck on, and it is the
easiest feature to ship badly.

### Phase 6 — Hardware marketplace

Individual sales and wholesale. The strategic bet is that a student who has
built a rover in simulation is a qualified buyer of a real kit, and a school
that has trained a teacher is a qualified buyer of thirty. This phase is why
"Xarid qilmoqchiman" is one of the four registration roles from day one —
collecting that intent early costs nothing and it is the demand signal that
tells us whether the bet is real.

---

## 4. Sequencing logic

The order is chosen so each phase makes the next one sellable:

```
workshop exists            → a student can learn something today   (done)
  ↓ accounts
progress persists          → a teacher can see a class is working
  ↓ teacher product
teachers are trained       → a school has someone to run the lesson
  ↓ school product
schools can buy            → recurring institutional revenue
  ↓ marketplace
trained users want kit     → hardware margin on a warm audience
```

Building the marketplace before the teacher product would be selling hardware
to schools that still have nobody to teach with it — which is the exact
failure the product exists to fix.

---

## 5. Open decisions

These are unresolved and should not be guessed at:

1. **Backend and persistence.** Supabase / Firebase / custom API. Affects auth,
   progress, saved builds, community, and the shape of Phase 2. Everything the
   MVP saves currently runs through one hook, so the migration is contained.
2. **Video hosting.** Self-hosted files, a CDN, or unlisted YouTube embeds.
   Bandwidth cost and offline/low-bandwidth classroom access are the deciding
   factors, and the second may matter more than the first here.
3. **Certification standing.** Whether the teacher track is a private
   certificate or needs institutional recognition to be worth a teacher's time.
4. **School pricing model.** Per-seat, per-class, or per-institution annual.
   `/pricing` says "on request", which is honest and buys time — but a model
   is needed before the first contract, not after.
5. **Russian on the site.** The workshop already has it; the site has UZ/EN.
   Adding it is cheap (one dictionary file) and the decision is about audience,
   not effort.
