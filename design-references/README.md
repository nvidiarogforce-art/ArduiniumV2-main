# design-references

The reference material the original build specification refers to. None of these
files existed when the site was built, so they were written afterwards from
the spec's own constraints and from what actually shipped.

**The code is the source of truth.** These describe the product; they do not
define it. Where a document and the app disagree, the app is right and the
document is stale.

| File | What it is | Drifts? |
|---|---|---|
| `sitemap.md` | Every route, tagged MVP / stub / future, plus the per-role registration fields | Only when routes change |
| `strategy-roadmap.md` | Why the product is shaped this way, and what order the rest arrives in | Slowly |
| `design-system.html` | Live, self-contained reference for the palette, type, buttons, cards, inputs, texture and motion. Double-click it | **Yes** — tokens are copied from `app/globals.css` |
| `gradient-background-brief.txt` | The brief behind the animated hero/registration background | No — intent, not implementation |

## Where the standalone landing page went

This folder briefly held a `landing.html` — a hand-written snapshot of the
React landing page, made to fill the gap left by the reference file the build
spec kept pointing at. That reference has since turned up (it was a `.docx`
renamed `.md`), and it specifies a **different** design: dark hero band,
marquee ticker, inline-SVG mascot, hash router, canvas pixel-ripple, and its
own register and app-stub pages.

It is built, to spec, at **`prototype/index.html`** — one self-contained file,
no build, no framework. `tools/proto-test.mjs` is its gate. The snapshot was
deleted rather than kept alongside it: two files both claiming to be "the
standalone landing page" is precisely the drift this README warns about.

`design-system.html` references `../public/brand/` for the logo and mascot, so
keep it in this folder. Its webfonts are linked rather than embedded — opened
offline it falls back to the system stack, which is fine for a reference
sheet. The shipped app self-hosts its fonts through `next/font`.

## What is deliberately not here

- **Market sizing, user counts, revenue projections.** Nothing in this repo
  quotes a number that has not been measured. `strategy-roadmap.md` marks the
  places one belongs as `[content pending]`.
- **A logo or mascot source file.** Both are user-supplied final assets in
  `public/brand/` and were not regenerated.
