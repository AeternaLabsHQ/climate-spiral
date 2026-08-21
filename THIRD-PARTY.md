# Third-Party-Komponenten / Third-Party Notices

Dieses Repository enthält vendorten Code, Schriften und visualisiert Daten aus
externen Quellen. Diese Datei fasst zusammen, was wovon stammt und unter
welcher Lizenz es steht. Der Quellcode dieses Repositories selbst steht unter
der MIT-Lizenz — siehe [`LICENSE`](LICENSE).

This repository bundles third-party code, fonts, and visualizes data from
external sources. This file summarizes what comes from where and under which
license. The source code of this repository itself is MIT-licensed — see
[`LICENSE`](LICENSE).

## Übersicht / Overview

| Komponente | Version | Lizenz | Hinweis |
|---|---|---|---|
| [three.js](https://threejs.org/) (inkl. Line2/LineSegments2/LineGeometry/LineSegmentsGeometry/LineMaterial, OrbitControls) | r147 | MIT | Copyright © 2010-2022 three.js authors. Volltext in jeder `vendor/LICENSE-three.txt` (alle vendor-Kopien: `vendor/`, `spiral-portrait/vendor/`, `spiral-portrait-en/vendor/`, `spiral-square/vendor/`, `spiral-square-en/vendor/`). |
| [GSAP](https://gsap.com/) (GreenSock Animation Platform) | 3.14.2 | **GreenSock Standard License — NICHT Open Source, NICHT unter der Repo-Lizenz** | GSAP ist proprietär lizenziert von GreenSock/Webflow. Die Nutzung hier fällt unter die kostenlose "No Charge"-Nutzung der GreenSock Standard License (nicht-kommerzielle bzw. die dort erlaubten Fälle). Lizenztext: <https://gsap.com/standard-license>. Diese Datei stellt **keine** eigene Lizenzierung von GSAP dar — bei Weiterverwendung/Redistribution die GreenSock-Lizenzbedingungen eigenständig prüfen. |
| Fonts: DM Sans, Outfit, Fira Sans, IBM Plex Mono | diverse | SIL Open Font License 1.1 | Volltext + Copyright-Vermerke je Familie: [`fonts/LICENSES.md`](fonts/LICENSES.md). Kopien in `spiral-portrait/fonts/`, `spiral-portrait-en/fonts/`, `spiral-square/fonts/`, `spiral-square-en/fonts/` verweisen per `LICENSE.md` dorthin. |
| NASA GISTEMP v4 (`GLB.Ts+dSST`) | — | Gemeinfrei (public domain, US-Regierungswerk) | Zitiervorschlag: „NASA GISTEMP v4". Details in [`LICENSE-media.md`](LICENSE-media.md). |
| NOAA-Datensätze (Mauna-Loa-CO₂-Reihe der NOAA GML) | — | Gemeinfrei (public domain, US-Regierungswerk) | Zitiervorschlag: „NOAA GML". Details in [`LICENSE-media.md`](LICENSE-media.md). |
| Law-Dome-Eiskern-CO₂-Reihe | — | Wissenschaftliche Publikation, als solche zu zitieren (nicht unter dieser Lizenz weiterzugeben) | Siehe Zitierhinweis in [`LICENSE-media.md`](LICENSE-media.md). |
| HyperFrames | — | Render-Tooling (extern) | Wird für die Erzeugung der gerenderten Videos/Standbilder der Klimaspirale verwendet; genannt zur Nachvollziehbarkeit der Render-Pipeline. |

## Details

### three.js (MIT)

Vendored in mehreren Kopien dieses Repositories (siehe Tabelle oben). MIT-Lizenz,
Copyright © 2010-2022 three.js authors. Der vollständige Lizenztext liegt jeder
vendor-Kopie als `LICENSE-three.txt` bei.

### GSAP (GreenSock Standard License)

GSAP wird als vendorte Datei `gsap.min.js` in den Verzeichnissen `vendor/`,
`spiral-portrait/vendor/`, `spiral-portrait-en/vendor/`, `spiral-square/vendor/`,
`spiral-square-en/vendor/` mitgeliefert (Version 3.14.2). GSAP steht **nicht** unter einer Open-Source-Lizenz,
sondern unter der GreenSock Standard License — einer proprietären, aber für die
meisten Anwendungsfälle kostenlosen Lizenz mit eigenen Bedingungen (z. B.
Einschränkungen bei bestimmten SaaS-/Wiederverkaufs-Szenarien). Näheres:
<https://gsap.com/standard-license>. Wer dieses Repository forkt oder den Code
weiterverwendet, muss die GSAP-Lizenzbedingungen eigenständig prüfen — sie sind
**nicht** durch die MIT-Lizenz dieses Repositories abgedeckt.

### Fonts (SIL OFL 1.1)

Siehe [`fonts/LICENSES.md`](fonts/LICENSES.md) für den vollständigen Lizenztext
und die Copyright-Vermerke der einzelnen Schriftfamilien (DM Sans, Outfit,
Fira Sans, IBM Plex Mono).

### Daten

Die Klimaspirale visualisiert Messreihen aus externen, bereits offen
zugänglichen Quellen. Diese Daten werden zitiert, nicht durch dieses Repository
lizenziert:

- **NASA GISTEMP v4** und **NOAA**-Datensätze sind Werke der US-Bundesregierung
  bzw. -Behörden und stehen in den USA als amtliche Werke gemeinfrei (public
  domain) zur Verfügung.
- Die **Law-Dome-Eiskern-CO₂-Reihe** stammt aus einer wissenschaftlichen
  Veröffentlichung und ist als solche zu zitieren.

Ausführliche Zitierhinweise: [`LICENSE-media.md`](LICENSE-media.md).

### HyperFrames

HyperFrames wird als externes Render-Tooling zur Erzeugung der gerenderten
Klimaspirale-Videos und -Standbilder eingesetzt. Es ist kein im Repository
vendorter Code, wird hier aber als Teil der Render-Pipeline genannt.
