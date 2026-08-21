// scripts/fetch-co2.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMlo, parseLawDome, annualToMonthly, spliceSeries, maxOverlapDiff, seamStep } from "./fetch-co2.mjs";

const MLO_FIXTURE = `# comment line
# another
year,month,decimal date,average,deseasonalized,ndays,sdev,unc
1958,3,1958.2027,315.71,314.44,-1,-9.99,-0.99
1958,4,1958.2877,317.45,315.16,-1,-9.99,-0.99
1958,5,1958.3699,-99.99,314.69,-1,-9.99,-0.99
1959,1,1959.0411,315.58,315.52,-1,-9.99,-0.99
`;

const LAW_FIXTURE = `Some header text
Column 5: Year AD
Column 6: CO2 Spline (ppm)
YearAD CH4spl  GrwthRt NOAA04      YearAD  CO2spl  GrwthRt     YearAD  N2Ospl  GrwthRt
1879    640.0    -0.5   648.3      1879.0   289.6     0.0      1879.0   263.4     0.0
1880    641.0    -0.5   648.8      1880.0   289.8     0.1      1880.0   263.5     0.0
1881    642.0    -0.5   649.8      1881.0   290.9     0.1      1881.0   263.6     0.0
`;

test("parseMlo liest year/month/average/deseasonalized und wirft Sentinel-Zeilen weg", () => {
  const rows = parseMlo(MLO_FIXTURE);
  assert.equal(rows.length, 3);                       // 1958-05 hat average=-99.99 -> raus
  assert.deepEqual(rows[0], { y: 1958, m: 3, raw: 315.71, trend: 314.44 });
  assert.deepEqual(rows[2], { y: 1959, m: 1, raw: 315.58, trend: 315.52 });
});

test("parseMlo wirft, wenn die erwartete Kopfzeile fehlt (Format hat sich verschoben)", () => {
  // Kopfzeile absichtlich verändert — ein umsortiertes/erweitertes CSV wäre sonst plausibel,
  // aber falsch geparst worden, ohne dass irgendein Fehler auffliegt.
  const shifted = MLO_FIXTURE.replace(
    "year,month,decimal date,average,deseasonalized",
    "year,month,decimal_date,avg,deseas"
  );
  assert.throws(() => parseMlo(shifted), /Kopfzeile|Spaltenlayout/i);
});

test("parseLawDome liest Spalte 5/6 als Jahr->ppm", () => {
  const map = parseLawDome(LAW_FIXTURE);
  assert.equal(map.get(1880), 289.8);
  assert.equal(map.get(1881), 290.9);
  assert.equal(map.size, 3);
});

test("parseLawDome wirft, wenn die Spaltenbeschriftungen fehlen (Format hat sich verschoben)", () => {
  const shifted = LAW_FIXTURE.replace("Column 5: Year AD", "Col 5: YearAD").replace(
    "Column 6: CO2 Spline (ppm)",
    "Col 6: CO2spl (ppm)"
  );
  assert.throws(() => parseLawDome(shifted), /Spaltenbeschriftungen|Spaltenlayout/i);
});

test("annualToMonthly interpoliert linear zwischen Jahresmitten (Monat 6.5)", () => {
  const map = new Map([[1880, 290], [1881, 302]]);
  const rows = annualToMonthly(map, 1880, 7, 1881, 7);
  assert.equal(rows.length, 13);
  // Der Anker ist die Jahresmitte (Monat 6.5), nicht Monat 7 — jeder ganzzahlige Monat liegt
  // also einen halben Monat neben dem Anker. 1880-07 ist einen halben Monat NACH t=1880,
  // deshalb 290.5 statt exakt 290.
  assert.deepEqual(rows[0], { y: 1880, m: 7, raw: 290.5, trend: 290.5 });
  // 1881-07 ist einen halben Monat NACH t=1881, also hinter dem letzten Anker -> geklemmt auf 302.
  assert.deepEqual(rows[12], { y: 1881, m: 7, raw: 302, trend: 302 });
  assert.equal(rows[6].y, 1881);                                        // ein halbes Jahr weiter
  assert.equal(rows[6].m, 1);
  // 1881-01 liegt bei t=1880+6.5/12, also selbst wieder einen halben Monat neben der
  // rechnerischen Mitte zwischen den beiden Ankern (1880.5) -> 296.5, nicht exakt 296.
  assert.ok(Math.abs(rows[6].trend - 296.5) < 1e-9);
});

test("annualToMonthly extrapoliert vor der ersten Jahresmitte flach", () => {
  const map = new Map([[1880, 290], [1881, 302]]);
  const rows = annualToMonthly(map, 1880, 1, 1880, 7);
  assert.equal(rows[0].trend, 290);   // Januar 1880 liegt vor der Jahresmitte -> geklemmt
});

test("spliceSeries nimmt Law Dome bis Feb 1958 und Mauna Loa ab März 1958", () => {
  const law = [
    { y: 1958, m: 1, raw: 314.0, trend: 314.0 },
    { y: 1958, m: 2, raw: 314.1, trend: 314.1 },
    { y: 1958, m: 3, raw: 314.2, trend: 314.2 },   // wird verworfen
  ];
  const mlo = [
    { y: 1958, m: 3, raw: 315.71, trend: 314.44 },
    { y: 1958, m: 4, raw: 317.45, trend: 315.16 },
  ];
  const out = spliceSeries(law, mlo);
  assert.deepEqual(out, [
    [1958, 1, 314.0, 314.0],
    [1958, 2, 314.1, 314.1],
    [1958, 3, 314.44, 315.71],
    [1958, 4, 315.16, 317.45],
  ]);
});

test("spliceSeries verlangt eine lückenlose Monatsreihe", () => {
  const law = [{ y: 1958, m: 1, raw: 314, trend: 314 }];
  const mlo = [{ y: 1958, m: 4, raw: 317, trend: 315 }];   // Februar/März fehlen
  assert.throws(() => spliceSeries(law, mlo), /lückenlos|Lücke/i);
});

test("maxOverlapDiff misst die größte Trendabweichung im gemeinsamen Zeitraum", () => {
  const law = [{ y: 1958, m: 3, trend: 314.0 }, { y: 1958, m: 4, trend: 315.0 }];
  const mlo = [{ y: 1958, m: 3, trend: 314.44 }, { y: 1958, m: 4, trend: 315.16 }];
  const d = maxOverlapDiff(law, mlo);
  assert.ok(Math.abs(d.max - 0.44) < 1e-9);
  assert.equal(d.n, 2);
});

test("maxOverlapDiff schließt mit maxLawYear Monate jenseits der echten Law-Dome-Abdeckung aus", () => {
  // 2005 steht hier für einen Monat, in dem `law` nur noch der flach extrapolierte Wert des
  // letzten echten Jahres (2004) ist — annualToMonthly klemmt jenseits des letzten Ankers.
  // Ohne Cutoff würde eine riesige, aber bedeutungslose Abweichung mitgezählt.
  const law = [
    { y: 2003, m: 6, trend: 375.0 },
    { y: 2004, m: 6, trend: 377.0 },
    { y: 2005, m: 6, trend: 377.0 },   // extrapoliert/geklemmt, keine echte Law-Dome-Messung
  ];
  const mlo = [
    { y: 2003, m: 6, trend: 375.5 },
    { y: 2004, m: 6, trend: 377.6 },
    { y: 2005, m: 6, trend: 382.0 },   // reale Mauna-Loa-Messung, weit vom eingefrorenen Law-Dome-Wert
  ];

  const withoutCutoff = maxOverlapDiff(law, mlo);
  assert.equal(withoutCutoff.n, 3);
  assert.ok(Math.abs(withoutCutoff.max - 5.0) < 1e-9);   // 382.0 - 377.0 — Artefakt, faelschlich gezaehlt

  const withCutoff = maxOverlapDiff(law, mlo, 2004);
  assert.equal(withCutoff.n, 2);                          // 2005 ausgeschlossen
  assert.ok(Math.abs(withCutoff.max - 0.6) < 1e-9);        // 377.6 - 377.0, echte Ueberlappung
});

test("seamStep misst den Sprung an der Naht, nicht die Abweichung über den ganzen Zeitraum", () => {
  const rows = [
    [1958, 1, 314.0, 314.0],
    [1958, 2, 315.01, 315.01],
    [1958, 3, 314.44, 315.71],
    [1958, 4, 315.16, 317.45],
  ];
  const s = seamStep(rows);
  assert.deepEqual(s.before, [1958, 2, 315.01, 315.01]);
  assert.deepEqual(s.after, [1958, 3, 314.44, 315.71]);
  assert.ok(Math.abs(s.step - 0.57) < 1e-9);
});
