#!/usr/bin/env node
// fetch-co2.mjs — baut data/co2_lawdome_mlo.json aus zwei Quellen.
//
// Quelle A (ab 1958-03): NOAA GML, Mauna Loa, Monatswerte.
//   https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv
//   Spalten: year,month,decimal date,average,deseasonalized,ndays,sdev,unc
//   -> "average" ist der rohe Monatswert (mit Jahresgang), "deseasonalized" der Trend.
//      Wir glätten also nichts selbst.
//
// Quelle B (1880-01 bis 1958-02): Law-Dome-Spline (Etheridge et al. / MacFarling Meure et al.),
//   Jahreswerte 1..2004, über NOAA NCEI Paleoclimatology.
//   https://www.ncei.noaa.gov/pub/data/paleo/icecore/antarctica/law/law2006.txt
//   Spalte 5 = Year AD, Spalte 6 = CO2 Spline (ppm).
//   Der Spline dämpft laut Dateikopf Variationen unter 20 Jahren um 50 % — er kann
//   per Konstruktion keinen Jahresgang zeigen. Deshalb raw == trend vor 1958.
//
// Ausgabe: [[y, m, trend, raw], ...] — lückenlos monatlich, Start START_Y/START_M.
//
// Aufruf:
//   node scripts/fetch-co2.mjs            holt, baut, schreibt data/co2_lawdome_mlo.json
//   node scripts/fetch-co2.mjs --dry-run  holt und baut, schreibt nichts, meldet Kennzahlen

import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

export const MLO_URL = "https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv";
export const LAW_URL = "https://www.ncei.noaa.gov/pub/data/paleo/icecore/antarctica/law/law2006.txt";
export const START_Y = 1880, START_M = 1;
export const SPLICE_Y = 1958, SPLICE_M = 3;   // erster Monat, der aus Mauna Loa kommt

// ---- Parser -----------------------------------------------------------------------------

// NOAA-Sentinels für fehlende Werte sind negativ (-99.99 / -9.99). CO2 ist nie <= 0.
export function parseMlo(text) {
  // Positionelle Spalten allein sind zu blind: wenn NOAA das CSV umsortiert oder eine Spalte
  // einfügt, wären die Zahlen weiterhin plausibel, aber falsch zugeordnet — genau der Fehler,
  // den die Sentinel-Prüfung unten nicht abfängt. Deshalb hart auf den bekannten Header prüfen.
  if (!text.includes("year,month,decimal date,average,deseasonalized")) {
    throw new Error(
      `Mauna-Loa-CSV (${MLO_URL}) hat nicht mehr die erwartete Kopfzeile ` +
      `"year,month,decimal date,average,deseasonalized,..." — Spaltenlayout hat sich geändert, ` +
      `Parser muss geprüft werden, bevor weiter gebaut wird.`
    );
  }
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const f = line.split(",");
    if (f.length < 5) continue;
    const y = Number(f[0]), m = Number(f[1]), raw = Number(f[3]), trend = Number(f[4]);
    if (!Number.isInteger(y) || !Number.isInteger(m)) continue;   // Kopfzeile
    if (!(raw > 0) || !(trend > 0)) continue;                     // Sentinel-Zeilen
    out.push({ y, m, raw, trend });
  }
  return out;
}

// Der Law-Dome-Block hat 10 Spalten; uns interessieren 5 (Year AD) und 6 (CO2 Spline).
export function parseLawDome(text) {
  // Wie bei parseMlo: positionelle Spalten sind blind gegen ein umsortiertes oder erweitertes
  // Format. Beide Spaltenbeschriftungen aus dem Dateikopf müssen wörtlich vorkommen.
  if (!text.includes("Column 5: Year AD") || !text.includes("Column 6: CO2 Spline")) {
    throw new Error(
      `Law-Dome-Datei (${LAW_URL}) trägt nicht mehr die erwarteten Spaltenbeschriftungen ` +
      `"Column 5: Year AD" / "Column 6: CO2 Spline" — Spaltenlayout hat sich geändert, ` +
      `Parser muss geprüft werden, bevor weiter gebaut wird.`
    );
  }
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    const f = line.trim().split(/\s+/);
    if (f.length < 7) continue;
    const y = Number(f[4]), ppm = Number(f[5]);
    if (!Number.isFinite(y) || !Number.isFinite(ppm)) continue;
    if (!Number.isInteger(y) && Math.abs(y - Math.round(y)) > 1e-9) continue;
    if (ppm < 150 || ppm > 500) continue;                          // CH4/N2O-Spalten ausschließen
    map.set(Math.round(y), ppm);
  }
  return map;
}

// ---- Jahres- -> Monatsreihe --------------------------------------------------------------

// Ein Jahreswert repräsentiert das Jahresmittel, liegt also auf der Jahresmitte (Monat 6.5).
// Zwischen zwei Jahresmitten wird linear interpoliert; außerhalb wird auf den Randwert geklemmt.
export function annualToMonthly(map, fromY, fromM, toY, toM) {
  const years = [...map.keys()].sort((a, b) => a - b);
  if (years.length === 0) throw new Error("Law-Dome-Reihe ist leer.");
  const out = [];
  // 6.5 ist die Jahresmitte in Monatseinheiten (zwischen Juni und Juli) — NICHT 7. Ein
  // Jahreswert sitzt exakt auf t=Y, jeder ganzzahlige Monat liegt also einen halben Monat
  // daneben. Nicht auf 7 "korrigieren" — das war schon einmal ein Bug (siehe Commit-History).
  for (let y = fromY, m = fromM; y < toY || (y === toY && m <= toM); m === 12 ? (m = 1, y++) : m++) {
    const t = y + (m - 6.5) / 12;                     // Bruchteiljahr auf der Jahresmitten-Achse
    let v;
    if (t <= years[0]) v = map.get(years[0]);
    else if (t >= years[years.length - 1]) v = map.get(years[years.length - 1]);
    else {
      let i = 0;
      while (i < years.length - 1 && years[i + 1] < t) i++;
      const a = years[i], b = years[i + 1];
      const va = map.get(a), vb = map.get(b);
      v = va + (vb - va) * ((t - a) / (b - a));
    }
    out.push({ y, m, raw: round2(v), trend: round2(v) });
  }
  return out;
}

function round2(v) { return Math.round(v * 100) / 100; }

// ---- Splice ------------------------------------------------------------------------------

// Vor SPLICE_Y/SPLICE_M gilt Law Dome, danach Mauna Loa. Ergebnis: [[y,m,trend,raw], ...].
export function spliceSeries(law, mlo) {
  const before = law.filter((r) => r.y < SPLICE_Y || (r.y === SPLICE_Y && r.m < SPLICE_M));
  const after = mlo.filter((r) => r.y > SPLICE_Y || (r.y === SPLICE_Y && r.m >= SPLICE_M));
  const rows = [...before, ...after].map((r) => [r.y, r.m, round2(r.trend), round2(r.raw)]);
  assertContiguous(rows);
  return rows;
}

// Das Inline-Format trägt keine eigene Datumsachse — eine Lücke würde alles verschieben.
export function assertContiguous(rows) {
  for (let i = 1; i < rows.length; i++) {
    const [py, pm] = rows[i - 1], [y, m] = rows[i];
    const expY = pm === 12 ? py + 1 : py, expM = pm === 12 ? 1 : pm + 1;
    if (y !== expY || m !== expM) {
      throw new Error(
        `CO2-Reihe muss lückenlos monatlich sein: nach ${py}-${String(pm).padStart(2, "0")} ` +
        `erwartet ${expY}-${String(expM).padStart(2, "0")}, gefunden ${y}-${String(m).padStart(2, "0")}.`
      );
    }
  }
}

// ---- Überlappungsprüfung ----------------------------------------------------------------

// Größte Trendabweichung in den Monaten, die beide Reihen abdecken.
//
// ERWARTETE GRÖSSENORDNUNG — ca. 1-4 ppm, wachsend über die Zeit. Das ist keine Anomalie:
// Mauna Loa liegt bei 19°N, der Law-Dome/Cape-Grim-Ast weit im Süden. CO2-Emissionen sind
// überwältigend auf der Nordhalbkugel konzentriert, darum liest der Norden systematisch höher
// (interhemisphärischer Gradient), und die Lücke wächst mit den globalen Emissionen — plus der
// Spline dämpft laut Dateikopf Variationen unter 20 Jahren um 50 %, was einen zusätzlichen Lag
// einbaut. Mauna Loa ist im Überlappungszeitraum (1958-2004) fast durchgehend höher als Law Dome.
// Falls hier später jemand einen 3-4 ppm-Ausschlag sieht: das ist Physik, kein Splice-Defekt.
// Entscheidung vom 2026-07-25: Herleitung der interhem. Gradientenerwartung (Vorzeichen, Trend über Jahrzehnte).
//
// WICHTIG bei der Aufrufstelle: `law` (lawMonthly) wird von annualToMonthly() über den GESAMTEN
// Zielzeitraum gebaut und jenseits des letzten echten Law-Dome-Jahres flach extrapoliert (geklemmt).
// Ein Vergleich ohne Cutoff würde also "echte Mauna-Loa-Werte von 2026" gegen einen seit Jahrzehnten
// eingefrorenen Law-Dome-Wert von ~2004 stellen — keine Überlappung, sondern ein Artefakt.
// `maxLawYear` (optional, Default: keine Grenze) muss darum von main() auf das tatsächliche letzte
// Law-Dome-Jahr gesetzt werden (Math.max(...lawMap.keys())), nicht hartkodiert.
export function maxOverlapDiff(law, mlo, maxLawYear = Infinity) {
  const key = (r) => `${r.y}-${r.m}`;
  const lawByKey = new Map(law.map((r) => [key(r), r.trend]));
  let max = 0, n = 0, at = null;
  for (const r of mlo) {
    if (r.y > maxLawYear) continue;   // jenseits davon ist "law" nur flach extrapoliert, kein echter Vergleich
    const lv = lawByKey.get(key(r));
    if (lv === undefined) continue;
    n++;
    const d = Math.abs(lv - r.trend);
    if (d > max) { max = d; at = key(r); }
  }
  return { max, n, at };
}

// ---- Nahtsprung ---------------------------------------------------------------------------

// Der Sprung an der Naht: |letzter Law-Dome-Trend vor SPLICE_Y/SPLICE_M - erster Mauna-Loa-Trend
// ab SPLICE_Y/SPLICE_M|. Anders als maxOverlapDiff (der den ganzen gemeinsamen Zeitraum misst,
// inklusive des jahrzehntelangen interhemisphärischen Gradienten) ist das die Zahl, die zeigt,
// ob die gezeichnete Kurve am Übergang sichtbar springt — die Zahl fürs Overlay/die Doku.
export function seamStep(rows) {
  const i = rows.findIndex(([y, m]) => y > SPLICE_Y || (y === SPLICE_Y && m >= SPLICE_M));
  if (i <= 0) return null;
  const before = rows[i - 1], after = rows[i];
  return { before, after, step: round2(Math.abs(after[2] - before[2])) };
}

// ---- main --------------------------------------------------------------------------------

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

async function main() {
  const dry = process.argv.includes("--dry-run");
  const [mloText, lawText] = await Promise.all([get(MLO_URL), get(LAW_URL)]);

  const mlo = parseMlo(mloText);
  const lawMap = parseLawDome(lawText);
  if (mlo.length === 0) throw new Error("Mauna-Loa-Reihe ist leer — Format geändert?");
  const last = mlo[mlo.length - 1];

  const lawMonthly = annualToMonthly(lawMap, START_Y, START_M, last.y, last.m);
  const rows = spliceSeries(lawMonthly, mlo);

  // Cutoff auf das tatsächliche letzte Law-Dome-Jahr — nicht hartkodiert, wächst mit der Quelle.
  const maxLawYear = Math.max(...lawMap.keys());
  const ov = maxOverlapDiff(lawMonthly, mlo, maxLawYear);
  const seam = seamStep(rows);

  console.log(`Mauna Loa : ${mlo.length} Monate, bis ${last.y}-${String(last.m).padStart(2, "0")}`);
  console.log(`Law Dome  : ${lawMap.size} Jahre, ${Math.min(...lawMap.keys())}..${maxLawYear}`);
  console.log(`Splice    : ${rows.length} Monate, ${rows[0][0]}-${String(rows[0][1]).padStart(2, "0")} .. ${last.y}-${String(last.m).padStart(2, "0")}`);
  console.log(`Überlappung: n=${ov.n} (bis ${maxLawYear}, echte Law-Dome-Abdeckung), max. Trendabweichung ${ov.max.toFixed(2)} ppm bei ${ov.at}`);
  if (seam) {
    console.log(
      `Naht      : ${seam.before[0]}-${String(seam.before[1]).padStart(2, "0")}=${seam.before[2]} (Law Dome) -> ` +
      `${seam.after[0]}-${String(seam.after[1]).padStart(2, "0")}=${seam.after[2]} (Mauna Loa), Sprung ${seam.step.toFixed(2)} ppm`
    );
  }

  if (dry) { console.log("--dry-run — nichts geschrieben."); return; }

  const outPath = join(ROOT, "data", "co2_lawdome_mlo.json");
  writeFileSync(outPath, JSON.stringify(rows) + "\n");
  console.log(`WROTE data/co2_lawdome_mlo.json`);

  const metaPath = join(ROOT, "data", "meta.json");
  const meta = JSON.parse(readFileSync(metaPath, "utf8"));
  meta.co2_lawdome_mlo = { retrieved: new Date().toISOString().slice(0, 10) };
  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
  console.log(`WROTE data/meta.json (co2_lawdome_mlo)`);
}

// argv[1] fehlt, wenn das Modul importiert statt direkt ausgeführt wird (z.B. `node -e`-Kontext
// oder ein anderes Skript, das nur die exportierten Funktionen nutzt) — pathToFileURL(undefined)
// würde sonst mit ERR_INVALID_ARG_TYPE werfen, bevor der Vergleich überhaupt stattfindet.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
