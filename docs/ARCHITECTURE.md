# Architecture

Technical foundation of the Climate Spiral: project structure, data pipeline, render mapping, and
the Three.js/HyperFrames implementation. For operations (updating the data) see
[OPERATIONS.md](OPERATIONS.md).

---

## Project Structure

```
gistemp/
├── README.md                          # public showcase (en)
├── README.de.md                       # German version
├── docs/                              # architecture and operations documents
│   ├── ARCHITECTURE.md                # this document
│   ├── OPERATIONS.md                  # operations runbook
│   └── media/screenshot.png           # README screenshot
├── data/                              # canonical source data (JSON)
│   ├── global_gistemp.json            # NASA GISTEMP v4, baseline 1951–1980
│   ├── co2_lawdome_mlo.json           # CO2 1880-present (Law Dome + Mauna Loa)
│   └── meta.json                      # data snapshot metadata
├── scripts/                           # sync and fetch tooling (Node, no build step)
│   ├── sync-data.mjs                  # single source of truth: data/*.json → inline arrays
│   ├── fetch-co2.mjs                  # builds co2_lawdome_mlo.json from the two sources
│   └── data-map.json                  # manifest: which file gets which inline data
├── spiral_reference.py                # matplotlib 2D reference render (color/ring logic)
├── klimaspirale_interaktiv.html       # interactive web version (OrbitControls, play/scrub, 9 languages)
├── spiral-square/    spiral-square-en/    # HyperFrames project: global, square,   DE/EN
├── spiral-portrait/  spiral-portrait-en/  # HyperFrames project: global, portrait, DE/EN
├── vendor/                            # vendored three.js/GSAP copy for the interactive version
├── fonts/                             # web fonts (SIL OFL) for the interactive version
├── skills-lock.json                   # lockfile of the installed HyperFrames skills
├── LICENSE / LICENSE-media.md / THIRD-PARTY.md / CONTRIBUTING.md / CITATION.cff
└── .github/workflows/ci.yml           # CI: npm test
```

Every `spiral-*` directory is a **standalone HyperFrames composition project** with an identical
layout:

```
spiral-<variant>/
├── index.html        # the complete composition (Three.js + overlays + data inline)
├── package.json      # npm scripts -> hyperframes CLI (version 0.4.43)
├── hyperframes.json  # HyperFrames project config (paths, registry)
├── meta.json          # project ID + name
├── AGENTS.md          # short conventions for AI agents
├── CLAUDE.md          # detailed HyperFrames rules/skill overview
├── vendor/            # own three.js/GSAP copy (HyperFrames serves only the project folder)
└── snapshots/         # individual PNG frames for visual review
```

---

## Data

**Schema** (chronologically sorted array, one object per month):

```json
[{ "y": 1880, "m": 1, "v": -0.19 }, { "y": 1880, "m": 2, "v": -0.25 }, ...]
```

- `y` = year, `m` = month (1-12), `v` = temperature anomaly in °C
- **Baseline (reference period):** 1951-1980 (GISTEMP standard)
- **Global dataset:** ~1752+ months, min/max around -0.82 / +1.48 °C
  (peak value September 2023, +1.48 °C)
- Verified against NASA `GLB.Ts+dSST`

In the render `index.html` files, the monthly values are **embedded inline** as a plain JS array
`V[]` (index `i` → year `1880 + floor(i/12)`, month `(i%12)+1`). The `*.json` files are the
source/exchange form of the data.

### Data Sources per Variant

| Variant | Source |
|---|---|
| Global | NASA **GISTEMP v4** (`GLB.Ts+dSST`) |

> Note on updates: NASA `data.giss.nasa.gov` blocks automated fetches. The mirror used is
> `datasets/global-temp` (datahub) → `data/monthly.csv`, rows `Source=GISTEMP`.

### Single Source of Truth: `scripts/sync-data.mjs`

The canonical monthly values live in `data/*.json` (`global_gistemp.json`);
the inline arrays in the 4 `spiral-*/index.html` files and in `klimaspirale_interaktiv.html` are
**generated** from them and never hand-edited again. Before every render, check:
`node scripts/sync-data.mjs --check` (exit 1 on drift between inline and source). After a data
update, synchronize: `node scripts/sync-data.mjs`. Manifest: `scripts/data-map.json`.

### CO₂ Curve

The interactive version runs a second curve next to the year axis: atmospheric CO₂ concentration
(ppm), assembled from two sources because no single series covers 1880–2026 — Law Dome ice core
(Antarctica) through February 1958, then NOAA GML Mauna Loa. The seam at 1958 is shown, not
hidden: the ice-core part is dashed, the Mauna Loa part solid. `raw` (monthly value with seasonal
cycle) and `trend` (deseasonalized) come as finished columns directly from the NOAA file
(`average`/`deseasonalized`) — nothing is smoothed locally. The series is built by
`scripts/fetch-co2.mjs` into `data/co2_lawdome_mlo.json` (`[y, m, trend, raw]`, monthly with no
gaps) and injected inline into `klimaspirale_interaktiv.html` from there via `sync-data.mjs`, just
like the temperature series. The curve exists **only** in the interactive version; the rendered
video clips deliberately do not show it.

---

## Visual Specification and Mapping

Per month `i` with month index `m_i` and anomaly `a_i`:

- **Angle:** `θ = -((m-1)/12 · 2π)` → January at the top, clockwise
- **Radius:** `ρ(a) = a + OFFSET` with `OFFSET = 1.2` (negative anomalies stay in the center,
  positive ones move outward)
- **Height (3D):** `y = (i / (N-1)) · HFUN` with `HFUN = 8.0` → 1880 at the bottom, present at the
  top
- **Color:** diverging colormap **by temperature value** (not by time): cold = blue, 0 °C =
  near-white, warm = red. The cold blue core spirals outward into red.

### Scale Rings

Reference circles at 0.5 / 1 / 1.5 / 2 °C. **1.5 °C and 2 °C** (dashed highlight; **not** the
Paris thresholds — on this 1951-1980 scale those sit at +1.31 / +1.81 °C on a pre-industrial
basis, see the interactive overlay), labels in the empty upper area (north), arc-length-fanned to
avoid overlap. In the 3D phase they become translucent **guide cylinders**, against which the
widening of the funnel can be read off.

### Camera and Transition

A single `PerspectiveCamera`. The 2D→3D "tilt" runs through **one** tilt parameter `k`: the camera
elevation interpolates from ~88° (straight down from above, reads as the flat spiral) to ~30-36°
(oblique over the horizon). No camera cut, a seamless transition. At the end, an optional slow
rotation of the funnel (hold phase).

---

## Beat Timeline (60 s)

Everything is a pure function of normalized time `t ∈ [0,1]`:

| Time | t-range | Content |
|---|---|---|
| 0-2 s | 0.00-0.03 | Empty field, rings + month labels + title fade in |
| 2-48 s | 0.03-0.80 | 2D spiral builds up month by month (`BUILD_DECAY = 1.7`: the most recent years run slower), year counter counts along |
| 48-52 s | 0.80-0.87 | **Tilt:** camera tilts, coils rise apart → funnel |
| 52-60 s | 0.87-1.00 | Hold on the 3D funnel, slow rotation, closing label (final value + peak value) |

Key constants in `index.html`: `T_INTRO = 0.03`, `T_BUILD_END = 0.80`, `T_TILT_END = 0.87`.

---

## Architecture (Three.js)

- **Geometry is built once** (flat, `y=0`); the build-up runs via the number of visible segments
  (draw range / `instanceCount`), not by rebuilding per frame.
- **Lines** as `Line2`/`LineMaterial` (thick, colored spiral line with vertex colors).
- **Rings:** flat line loops on the floor, or open `CylinderGeometry` (guide walls) in 3D.
- **Funnel:** `y_i(k) = k · y_i^full` – all coils start flat and spread out with `k`.
- **Overlays** (title, subtitle, year counter, end label) are DOM elements whose opacity is
  driven by a single paused **GSAP timeline** (registered on `window.__timelines["main"]`).

### Determinism (critical)

The entire frame state is derived purely from time. HyperFrames sets the virtual clock and fires
an `hf-seek` event:

```js
window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
renderAt(window.__hfThreeTime || 0);
```

**Forbidden:** `Date.now()`, unseeded `Math.random()`, network fetches, state depending on
`requestAnimationFrame` timing. Otherwise frame drift results. Every frame must be identically
reproducible on every render.

### Localization and Dynamic Text

The interactive version supports **9 languages** (de en fr es pt zh ja ru uk); language via
`data-lang`, region/source via `data-region-*` and `data-source-*` on the root element. Title,
subtitle, decimal separator (`,` vs. `.`), month names, final and peak value labels are computed
from the data at runtime and written into the DOM. The rendered HyperFrames clips exist
separately per variant as DE/EN composition pairs (`spiral-*` / `spiral-*-en`).

---

## Rendering and Reproducing

Prerequisite: Node.js (the `npx` calls pull `hyperframes@0.4.43` automatically) and, once, the
HyperFrames skills:

```bash
npx skills add heygen-com/hyperframes
```

Per variant, in the respective `spiral-*` directory:

```bash
npm run dev       # preview in the browser (Studio editor)
npm run check     # lint + validate + inspect  (always run after changes)
npm run render    # render to MP4
npm run publish   # publish + share link
```

`npm run check` must pass cleanly before every render. HyperFrames rules enforced by the linter
(see `CLAUDE.md` in each project):

1. Every timed element needs `data-start`, `data-duration`, `data-track-index`.
2. Visible timed elements need `class="clip"`.
3. Timelines paused and registered on `window.__timelines`.
4. Deterministic logic only (no `Date.now()`/`Math.random()`/fetches).

---

## Reference Implementation

`spiral_reference.py` is a matplotlib 2D render (polar projection, growing spiral, comet head,
year counter) and served as the template for the color, ring, and mapping logic. It is
**deliberately not** a starting point for 3D (matplotlib polar cannot handle the tilt cleanly);
the production solution is the Three.js/HyperFrames variant.

```bash
python spiral_reference.py   # requires numpy, matplotlib, ffmpeg
```

---

## Known Pitfalls (HyperFrames + Three.js)

- Load Three.js as a **UMD build** (no ESM `import` in the inline `<script>`).
- **three.js/GSAP live locally, not on a CDN.** The libraries are checked in under `vendor/`
  (three.js 0.147.0 + the five `Lines` example modules, GSAP 3.14.2, plus `OrbitControls.js` for
  the interactive variant) — exactly the versions that previously came from cdn.jsdelivr.net,
  nothing upgraded. This way the render needs no network connection. HyperFrames only serves the
  respective project folder as the web root and does not load `../` paths beyond it, so **every
  `spiral-*` project has its own `vendor/` copy** (`src="vendor/…"`); the repo-root `vendor/`
  serves `klimaspirale_interaktiv.html`. When updating a version, pull all copies in sync.
- On repeated seeking, don't call `geometry.setPositions(...)` on every frame — that can freeze;
  build the geometry once and vary only the visible range/height.
- `AdditiveBlending` only works as expected on a dark background.

---

## Further Documentation

- HyperFrames docs: <https://hyperframes.heygen.com/introduction>
  (machine index for AI tools: <https://hyperframes.heygen.com/llms.txt>)
- Operations (updating the data): [OPERATIONS.md](OPERATIONS.md)
