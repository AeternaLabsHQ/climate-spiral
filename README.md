# Climate Spiral

*[Deutsche Version: README.de.md](README.de.md)*

An animated 3D climate spiral that puts 146 years of global warming into a single picture. It
starts out flat and ends as a **funnel** that flares open toward the present, because the recent
years are the warmest in the record.

![Climate Spiral: 3D funnel of the global temperature anomaly 1880-2026](docs/media/screenshot.png)

## ▶ Live Demo

**<https://climate.aeternalabs.io>**

It runs in the browser, no download needed. You can rotate the spiral freely, play or scrub
through the timeline, and switch on a CO₂ curve and a Paris-target overlay.

---

## What this is

Every month from 1880 to today adds one short step to the spiral. How far a step sits from the
center depends on that month's temperature anomaly, meaning how far the global temperature was
above or below a long-term average. Warm months land further out, cool months further in. Seen
from above, that traces a flat spiral.

At the end the camera tilts into a 3D view and the coils lift apart. The funnel appears because
the most recent anomalies are the largest, so the outermost coils are also the widest.

The design follows NASA's visualization [SVS #4975](https://svs.gsfc.nasa.gov/4975) and renders
deterministically, so the same input always produces the same frames. The data here runs through
2026 instead of 2021.

The interactive web version is available in **9 languages** (de en fr es pt zh ja ru uk). Its
"Baseline & Paris Targets" overlay explains which average the anomalies are measured against.
This project uses the years 1951-1980, the baseline of the GISTEMP dataset. The Paris climate
targets are counted from the pre-industrial period 1850-1900 instead, and 1951-1980 was already
about **+0.19 °C** warmer than that. That is why the Paris rings in the image sit correspondingly
further inward than the identically named 1.5/2 °C rings of the GISTEMP scale.

The video versions are rendered with [HyperFrames](https://hyperframes.heygen.com), which turns
HTML into MP4 frame by frame, using a [Three.js](https://threejs.org) scene. For the mapping, the
data pipeline, and the render setup, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Quickstart

The interactive version needs no build step, but it does need its `vendor/` and `fonts/`
folders next to it, so clone the repo first, do not download the single HTML file alone.

```bash
git clone https://github.com/AeternaLabsHQ/climate-spiral.git
```

Then open `klimaspirale_interaktiv.html` in a browser. If you only grab that one file and open
it on its own, you get a black page, the file loads Three.js and its fonts from the `vendor/`
and `fonts/` folders that ship next to it in the repo.

Alternatively, serve the folder with any static server and open it via localhost, for example:

```bash
python -m http.server
# or
npx serve
```

For development and data sync:

```bash
npm test          # test suite
npm run sync       # sync data from data/*.json into all HTML compositions
npm run sync:check # check only whether inline data has drifted from the source (exit 1 on drift)
```

To render the HyperFrames video compositions (`spiral-*/`), see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#rendering-and-reproducing).

---

## Data sources & attribution

| Series | Source |
|---|---|
| Global temperature | NASA **GISTEMP v4** (`GLB.Ts+dSST`), baseline 1951-1980 |
| CO₂ concentration | **Law Dome** ice core (through 1958) + **NOAA GML Mauna Loa** (from 1958) |

Details, schema, and update process: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#data).

---

## License

- **Code** in this repository: [MIT](LICENSE).
- **Media** (videos, poster stills, the interactive visualization): **CC BY 4.0**. You may use it
  freely, including commercially and in derivative works, as long as you credit the source. For
  details and a sample attribution line, see [LICENSE-media.md](LICENSE-media.md).
- **Third-party code** (three.js, GSAP, fonts) and its respective licenses: [THIRD-PARTY.md](THIRD-PARTY.md).

Contributions are welcome, see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Further documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): project structure, data pipeline, visual mapping, Three.js/HyperFrames implementation
- [docs/OPERATIONS.md](docs/OPERATIONS.md): workflow for updating the data
- [docs/](docs/README.md): full documentation index

*Note: the project language is English, and issues and PRs are welcome in either language (see
[CONTRIBUTING.md](CONTRIBUTING.md)). A German version of this README is at
[README.de.md](README.de.md).*
