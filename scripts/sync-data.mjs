#!/usr/bin/env node
// sync-data.mjs — Single Source of Truth für die Inline-Datenarrays der Klimaspirale.
//
// Die Monatswerte leben kanonisch in data/*.json. Dieses Skript generiert daraus die
// Inline-Arrays in den 4 spiral-*/index.html-Dateien und in klimaspirale_interaktiv.html,
// sodass die HTML-Dateien nie mehr von Hand editiert werden müssen (Finding F4/F7).
//
// Aufruf:
//   node scripts/sync-data.mjs           schreibt (idempotent) alle Ziele aus data-map.json
//   node scripts/sync-data.mjs --check   schreibt nichts; exit 1 bei Abweichung Inline<->Quelle
//
// Keine npm-Dependencies (Node >= 18). Serialisierung reproduziert den Inline-Stand
// byte-genau: Zahlen via String(v) (z. B. -0.1 bleibt "-0.1", 2.4 bleibt "2.4").

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MAP_PATH = join(__dirname, "data-map.json");
const META_PATH = join(ROOT, "data", "meta.json");

const CHECK = process.argv.includes("--check");

// ---- Datenstand-Injektion (Abrufdatum der Quelle) ----------------------------------------
// data/meta.json trägt pro Quelle das Datum, an dem die Reihe zuletzt gegen die Quelle
// abgeglichen wurde ({ "<meta-key>": { "retrieved": "YYYY-MM-DD" } }).
// Ziele bekommen dieses Datum in einen eigenen Marker injiziert
//   const DATA_RETRIEVED = "YYYY-MM-DD";
// wenn sie INTERACTIVE sind ODER in data-map.json "dateStamp": true bzw. einen eigenen
// "dateMarker" tragen (Default-Name ist DATA_RETRIEVED). Aktuell:
// die interaktive HTML + die 4 globalen HyperFrames-Varianten (spiral-portrait[-en],
// spiral-square[-en]), deren Quellzeile den lokalisierten Datenstand zur Laufzeit daraus
// ableitet und die für den Phase-3-Re-Render vorbereitet werden.
// Datums-Marker ist pro Quelle benennbar (DATA_RETRIEVED fuer die Temperatur, CO2_RETRIEVED fuer CO2).
export function dateRe(name) {
  return new RegExp('(const ' + name + ' = ")(\\d{4}-\\d{2}-\\d{2})(";)');
}
// Ein Ziel kann mehrere Quellen haben. Alte Form {src,format,dateStamp} bleibt gueltig.
export function sourcesOf(cfg) {
  return Array.isArray(cfg.sources) ? cfg.sources : [cfg];
}

// Der effektive Marker-Name einer Quelle — oder null, wenn sie gar keinen Datenstand bekommt.
// Gate und Name leben bewusst an EINER Stelle: die Kollisionsprüfung unten und die tatsächliche
// Injektion in main() müssen exakt dieselbe Menge an Quellen sehen, sonst prüft der Guard etwas
// anderes als geschrieben wird.
export function markerOf(s) {
  if (s.format === "INTERACTIVE" || s.dateStamp || s.dateMarker) return s.dateMarker || "DATA_RETRIEVED";
  return null;
}

// Zwei Quellen desselben Ziels dürfen sich keinen Marker-Namen teilen. .match() findet nur das
// ERSTE Vorkommen: die zweite Quelle würde sonst still den Stempel der ersten überschreiben —
// oder scheinbar erfolgreich das falsche Datum schreiben. Realistischer Auslöser: jemand ergänzt
// eine zweite Quelle und vergisst den "dateMarker", der dann auf DATA_RETRIEVED zurückfällt.
// Dieselbe Klasse still-falscher Ausgabe, gegen die die Parser in fetch-co2.mjs absichern.
export function assertUniqueMarkers(key, sources) {
  const seen = new Set();
  for (const s of sources) {
    const marker = markerOf(s);
    if (marker === null) continue;
    if (seen.has(marker)) {
      throw new Error(
        `data-map.json: Ziel '${key}' hat zwei Quellen mit dem Datums-Marker '${marker}'. ` +
        `Jede Quelle mit Datenstand braucht einen eigenen "dateMarker" — sonst überschreibt ` +
        `die zweite Quelle stillschweigend den Stempel der ersten.`
      );
    }
    seen.add(marker);
  }
}
// meta-Key aus dem Quellpfad: basename ohne .json (z. B. data/global_gistemp.json -> global_gistemp)
function metaKeyForSrc(srcRel) {
  return srcRel.replace(/^.*[/\\]/, "").replace(/\.json$/, "");
}

// ---- Ziel-Datei je Manifest-Key auflösen -------------------------------------------------
// spiral-* -> <key>/index.html ; ein Key mit .html ist bereits ein Dateiname.
function targetFile(key) {
  return key.endsWith(".html") ? key : `${key}/index.html`;
}

// ---- Quelle laden + normalisieren zu [[y,m,...], ...] ------------------------------------
// data/global_gistemp.json ist [{y,m,v}]; die anderen JSONs sind [[y,m,...]].
// Die Spaltenzahl bleibt erhalten — CO2 traegt [y,m,trend,raw].
export function loadRows(srcRel) {
  const raw = JSON.parse(readFileSync(join(ROOT, srcRel), "utf8"));
  if (raw.length === 0) return [];
  if (Array.isArray(raw[0])) return raw.map((t) => t.slice());
  return raw.map((o) => [o.y, o.m, o.v]);
}

// ---- Serialisierer (byte-genau zum heutigen Inline-Stand) --------------------------------
function serializeV(triples) {
  // Validierung: das V-Format trägt keine Datumsachse, also MUSS die Quelle
  // lückenlos monatlich ab 1880-01 sein, sonst verschiebt sich der Index.
  let y = 1880, m = 1;
  for (let i = 0; i < triples.length; i++) {
    const [ty, tm] = triples[i];
    if (ty !== y || tm !== m) {
      throw new Error(
        `V-Format verlangt lückenlose Monatsreihe ab 1880-01: bei Index ${i} ` +
        `erwartet ${y}-${String(m).padStart(2, "0")}, gefunden ${ty}-${String(tm).padStart(2, "0")}.`
      );
    }
    m++; if (m > 12) { m = 1; y++; }
  }
  return triples.map((t) => String(t[2])).join(",");
}

function serializeDATA(triples) {
  return triples.map((t) => `[${String(t[0])},${String(t[1])},${String(t[2])}]`).join(",");
}

function serializeINTERACTIVE(triples) {
  return "[[" + triples.map((t) => `${String(t[0])},${String(t[1])},${String(t[2])}`).join("],[") + "]]";
}

// CO2 traegt vier Spalten: [y, m, trend, raw].
export function serializeCO2(rows) {
  return "[[" + rows.map((r) => `${String(r[0])},${String(r[1])},${String(r[2])},${String(r[3])}`).join("],[") + "]]";
}

// ---- Regex je Format: der Inhalt zwischen den eckigen Klammern wird ersetzt ---------------
// Capture-Gruppe 1 = Prefix (bleibt), Gruppe 2 = alter Inhalt, Gruppe 3 = Suffix (bleibt).
const PATTERNS = {
  V:           { re: /(const V = \[)([\s\S]*?)(\];)/,        build: serializeV },
  DATA:        { re: /(const DATA = \[)([\s\S]*?)(\];)/,     build: serializeDATA },
  INTERACTIVE: { re: /(global:\s*\{[\s\S]*?data:\s*)(\[\[[\s\S]*?\]\])(\s*\})/, build: serializeINTERACTIVE },
  CO2:         { re: /(const CO2 = )(\[\[[\s\S]*?\]\])(;)/,  build: serializeCO2 },
};

// Für V/DATA ersetzen wir nur den Klammerinhalt; für INTERACTIVE das ganze [[...]].
function currentInline(fmt, html) {
  const p = PATTERNS[fmt];
  const m = html.match(p.re);
  if (!m) throw new Error(`Inline-Array (${fmt}) nicht gefunden.`);
  return { match: m, inline: fmt === "INTERACTIVE" ? m[2] : m[2] };
}

function rebuild(fmt, html, generated) {
  const p = PATTERNS[fmt];
  return html.replace(p.re, (_all, pre, _old, post) =>
    fmt === "INTERACTIVE" ? `${pre}${generated}${post}` : `${pre}${generated}${post}`
  );
}

// INTERACTIVE und CO2 fangen das komplette [[...]]-Literal ein, V/DATA nur den Klammerinhalt —
// für die Diff-Summary muss letzteres erst wieder in Klammern gesetzt werden.
function inlineAsJson(fmt, inline) {
  return fmt === "INTERACTIVE" || fmt === "CO2" ? inline : "[" + inline + "]";
}

// Letzter Datenpunkt (für Diff-Summary), aus einem Inline-String je Format.
function lastPointFromInline(fmt, inline) {
  if (fmt === "V") {
    const parts = inline.split(",");
    return parts[parts.length - 1];
  }
  const arr = JSON.parse(inlineAsJson(fmt, inline));
  return JSON.stringify(arr[arr.length - 1]);
}
function countFromInline(fmt, inline) {
  if (fmt === "V") return inline.split(",").length;
  return JSON.parse(inlineAsJson(fmt, inline)).length;
}

// -----------------------------------------------------------------------------------------
function main() {
  const map = JSON.parse(readFileSync(MAP_PATH, "utf8"));
  const meta = JSON.parse(readFileSync(META_PATH, "utf8"));

  let mismatches = 0;
  let wrote = 0;
  const okLines = [];

  for (const [key, cfg] of Object.entries(map)) {
    const file = targetFile(key);
    const abs = join(ROOT, file);
    const html = readFileSync(abs, "utf8");
    let next = html;

    const sources = sourcesOf(cfg);
    assertUniqueMarkers(key, sources);

    // INVARIANTE (tragend, sobald ein Ziel mehr als eine Quelle hat): die Edits aller Quellen
    // laufen nacheinander in dasselbe `next`. Das ist nur korrekt, solange jede Quelle eine
    // Region trifft, die keine andere Quelle desselben Ziels anfasst — also: das Format-Regex
    // aus PATTERNS und der Datums-Marker jeder Quelle müssen disjunkt zu denen aller anderen
    // Quellen sein. Überlappen sie, zerstören die sequenziellen Ersetzungen einander (und der
    // zweite Treffer läse bereits ersetzten Text). Für die Marker erzwingt das
    // assertUniqueMarkers oben; für die Datenarrays hält es heute, weil V/DATA/INTERACTIVE/CO2
    // je an einer eigenen, wörtlich verschiedenen Deklaration hängen. Wer ein Format ergänzt,
    // prüft das mit.
    for (const s of sources) {
      const rows = loadRows(s.src);
      const generated = PATTERNS[s.format].build(rows);
      const { inline } = currentInline(s.format, next);

      // ---- Aspekt 1: das Inline-Datenarray ----
      if (inline === generated) {
        okLines.push(`OK  ${file}  (${s.format}, N=${rows.length})`);
      } else {
        const srcLast = JSON.stringify(rows[rows.length - 1]);
        const inlineLast = lastPointFromInline(s.format, inline);
        const inlineN = countFromInline(s.format, inline);
        if (CHECK) {
          mismatches++;
          console.error(
            `DIFF ${file}  (${s.format})\n` +
            `      inline: N=${inlineN}, last=${inlineLast}\n` +
            `      source: N=${rows.length}, last=${srcLast}  [${s.src}]`
          );
        } else {
          next = rebuild(s.format, next, generated);
        }
      }

      // ---- Aspekt 2: der Datenstand-Marker ----
      const marker = markerOf(s);
      if (marker) {
        const mkey = metaKeyForSrc(s.src);
        const retrieved = meta[mkey] && meta[mkey].retrieved;
        if (!retrieved || !/^\d{4}-\d{2}-\d{2}$/.test(retrieved)) {
          throw new Error(`data/meta.json: retrieved-Datum für '${mkey}' fehlt oder ist kein ISO YYYY-MM-DD.`);
        }
        const RE = dateRe(marker);
        const dm = next.match(RE);
        if (!dm) throw new Error(`Marker 'const ${marker}' nicht gefunden in ${file}.`);
        if (dm[2] === retrieved) {
          okLines.push(`OK  ${file}  (${marker}, ${mkey}=${retrieved})`);
        } else if (CHECK) {
          mismatches++;
          console.error(
            `DIFF ${file}  (${marker})\n` +
            `      inline: ${dm[2]}\n` +
            `      source: ${retrieved}  [data/meta.json:${mkey}]`
          );
        } else {
          next = next.replace(RE, (_a, pre, _old, post) => `${pre}${retrieved}${post}`);
        }
      }
    }

    // ---- einmal schreiben, wenn sich etwas geändert hat (idempotent) ----
    if (!CHECK && next !== html) {
      writeFileSync(abs, next);
      wrote++;
      console.log(`WROTE ${file}`);
    }
  }

  if (CHECK) {
    if (mismatches > 0) {
      console.error(`\n${mismatches} Abweichung(en) — Inline weicht von der Quelle ab. Lauf 'node scripts/sync-data.mjs' zum Synchronisieren.`);
      process.exit(1);
    }
    console.log(okLines.join("\n"));
    console.log(`\nOK — alle ${okLines.length} Ziele stimmen mit ihren Quellen überein.`);
    process.exit(0);
  } else {
    console.log(`\nFertig — ${wrote} Datei(en) geschrieben, ${okLines.length} bereits aktuell.`);
  }
}

// argv[1] fehlt, wenn das Modul importiert statt direkt ausgeführt wird (z.B. vom Test) —
// pathToFileURL(undefined) würde sonst mit ERR_INVALID_ARG_TYPE werfen, bevor der Vergleich
// überhaupt stattfindet.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
