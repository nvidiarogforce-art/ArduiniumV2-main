# Arduinium — sitemap

Every route in the product, across all roles and phases, tagged by whether it
exists today.

| Tag | Meaning |
|---|---|
| **[MVP]** | Built and working in this pass |
| **[stub]** | Route exists and is reachable from navigation, but says plainly that it is not built yet |
| **[future]** | Not built, not routed to, not referenced in navigation |

Written after the build rather than before it, so this describes what is
actually there. Where a row says [MVP], the file that implements it is named.

---

## 0. Entry and identity

```
/                          [MVP]   Landing page                    app/page.tsx
/register                  [MVP]   Role picker + role field sets   app/register/page.tsx
/account                   [stub]  Profile only, no billing        app/account/page.tsx
```

### 0.1 Registration fields per role

The role chosen at registration decides the default interface. One account will
be able to hold several roles later; today the choice is single and stored
locally (`lib/account.ts`).

| Role | Uzbek label | Fields asked | Lands on |
|---|---|---|---|
| Student | O‘quvchiman | name, age, grade, school, city | `/learn` |
| Teacher | O‘qituvchiman | name, school, city, subject taught, robotics experience, phone | `/teach` |
| School rep | Maktab vakiliman | organisation, contact name, position, city, number of students, phone, email | `/pricing` |
| Buyer | Xarid qilmoqchiman | name, city, phone, email, area of interest | `/pricing` |

Robotics experience is a three-way select — *none at all* / *a little* /
*experienced* — because it is the field that decides which teacher-training
track someone is pointed at, and a free-text answer cannot be routed on.

**No authentication exists.** There is no password field anywhere, nothing is
sent to a server, and the form says so. Auth arrives with the backend decision
(see `strategy-roadmap.md`, Phase 2).

---

## 1. Student area

```
/learn                     [MVP]   Dashboard: progress, next lesson, 4 entries
/learn/lessons             [MVP]   Text lesson catalogue
/learn/lessons/:slug       [MVP]   Lesson detail, links into the sandbox
/learn/simulator           [MVP]   The 3D workshop  ← the product
/learn/simulator?lesson=   [MVP]   ...with lesson context + mark-complete
/learn/videos              [MVP]   Video catalogue (student track)
/learn/videos?track=teacher[MVP]   Video catalogue (teacher track)
/learn/videos/:slug        [MVP]   Player + optional self-check
/learn/achievements        [future] Badges, streaks, certificates
/learn/projects            [future] Student's own saved builds, shareable
```

### Lessons shipped

| Slug | Title | Sandbox task | State |
|---|---|---|---|
| `arduino-nima` | What is Arduino? | — | written |
| `led-yoqish` | Blinking an LED | yes | written |
| `tugma-va-kirish` | Buttons & Digital Input | yes | written |
| `sensorlar` | Sensors | — | announced, honest placeholder |
| `servo-motorlar` | Servo Motors | — | announced, honest placeholder |

The last two render as locked cards, not as clickable pages with invented
filler. A catalogue that promises five lessons and delivers three real ones is
recoverable; one that delivers five pages of padding is not.

---

## 2. Teacher area

```
/teach                     [stub]  Dashboard: classes, rosters, activity
/teach/training            [stub]  Certification catalogue
/teach/training/:id        [future] Course detail, progress, certificate
/teach/classes/:id         [future] One class: roster, per-student progress
/teach/assignments         [future] Set a sandbox task for a class
/teach/plans               [future] Downloadable lesson plans
```

Both stubs route onward to `/learn/videos?track=teacher`, which is real and
usable today. A "coming soon" page with no exit is how a demo loses its
audience, and the teacher video track is the one thing a teacher can actually
use in this phase.

---

## 3. Community

```
/community                 [MVP]   Feed, tag filter, new-post form
/community/:id             [future] Single post + replies
/community/profile/:id     [future] A member's posts and projects
```

Tags are `Savol` (question), `G‘oya` (idea), `Muvaffaqiyat hikoyasi` (success
story). Posts written by the reader live in `localStorage` above the seed
content. No replies, no notifications, no moderation yet — all three arrive
with the backend.

---

## 4. Commercial

```
/pricing                   [MVP]   Two tiers; also embedded on the landing page
/shop                      [future] Hardware marketplace
/shop/:sku                 [future] Product detail
/wholesale                 [future] Bulk / distributor pricing
```

Two tiers only: **Individual** (free, permanently, for students) and
**School / Classroom** (quote-based). The school tier deliberately carries no
number — pricing for schools in this market is negotiated per institution, and
printing a fixed figure would be a fabrication that has to be walked back in
the first sales conversation.

---

## 5. Platform / future

```
/ai                        [future] Standalone AI assistant
                                    (a disabled placeholder button exists in
                                     the sandbox chrome, clearly marked)
/admin                     [future] School administrator panel
/admin/schools/:id         [future] Institution overview
/admin/reports             [future] Usage and outcome reporting
/api/*                     [future] Public API
```

---

## 6. Cross-cutting

**Language.** Every MVP route supports UZ/EN, default Uzbek, switchable from
the header and persisted. The 3D workshop additionally carries Russian — it
has its own three-language dictionary — and the site drives its locale, so the
two never disagree.

**Persistence.** Everything the MVP "saves" — lesson progress, community posts,
registration answers — goes through one hook (`lib/useLocalState.ts`). That is
deliberate: no backend has been chosen, and this way the migration is one
file's body rather than a hunt through the codebase.

**Navigation.** Header links: Sandbox · Lessons · Video lessons · Community ·
For teachers · Pricing. `[future]` routes appear nowhere.
