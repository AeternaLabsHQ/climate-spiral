// scripts/sync-data.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { sourcesOf, dateRe, serializeCO2, markerOf, assertUniqueMarkers } from "./sync-data.mjs";

test("sourcesOf laesst die alte Einquellen-Form unveraendert", () => {
  const cfg = { src: "data/global_gistemp.json", format: "V", dateStamp: true };
  assert.deepEqual(sourcesOf(cfg), [cfg]);
});

test("sourcesOf faltet die neue Mehrquellen-Form auf", () => {
  const cfg = { sources: [{ src: "a.json", format: "V" }, { src: "b.json", format: "CO2" }] };
  assert.equal(sourcesOf(cfg).length, 2);
  assert.equal(sourcesOf(cfg)[1].format, "CO2");
});

test("dateRe trifft den benannten Marker und nur den", () => {
  const html = 'const DATA_RETRIEVED = "2026-07-20";\nconst CO2_RETRIEVED = "2026-07-25";';
  assert.equal(html.match(dateRe("DATA_RETRIEVED"))[2], "2026-07-20");
  assert.equal(html.match(dateRe("CO2_RETRIEVED"))[2], "2026-07-25");
});

test("serializeCO2 schreibt Quadrupel ohne Leerzeichen", () => {
  assert.equal(serializeCO2([[1880, 1, 289.8, 289.8], [1880, 2, 289.9, 289.9]]),
               "[[1880,1,289.8,289.8],[1880,2,289.9,289.9]]");
});

test("markerOf kennt die drei Wege zum Stempel — und den Fall ohne", () => {
  assert.equal(markerOf({ format: "INTERACTIVE", src: "a.json" }), "DATA_RETRIEVED");
  assert.equal(markerOf({ format: "V", dateStamp: true }), "DATA_RETRIEVED");
  assert.equal(markerOf({ format: "CO2", dateMarker: "CO2_RETRIEVED" }), "CO2_RETRIEVED");
  assert.equal(markerOf({ format: "DATA", src: "example.json" }), null);
});

test("assertUniqueMarkers laesst kollisionsfreie Ziele durch", () => {
  assert.doesNotThrow(() => assertUniqueMarkers("klimaspirale_interaktiv.html", [
    { src: "data/global_gistemp.json", format: "INTERACTIVE", dateMarker: "DATA_RETRIEVED" },
    { src: "data/co2_lawdome_mlo.json", format: "CO2", dateMarker: "CO2_RETRIEVED" },
  ]));
  // Quellen ohne Stempel koennen gar nicht kollidieren, auch wenn es mehrere sind.
  assert.doesNotThrow(() => assertUniqueMarkers("x.html", [
    { src: "a.json", format: "DATA" },
    { src: "b.json", format: "DATA" },
  ]));
});

test("assertUniqueMarkers faengt den vergessenen dateMarker", () => {
  // Zweite Quelle ohne "dateMarker" faellt auf DATA_RETRIEVED zurueck und kollidiert.
  assert.throws(
    () => assertUniqueMarkers("klimaspirale_interaktiv.html", [
      { src: "data/global_gistemp.json", format: "INTERACTIVE" },
      { src: "data/co2_lawdome_mlo.json", format: "CO2", dateStamp: true },
    ]),
    (e) => e.message.includes("klimaspirale_interaktiv.html") && e.message.includes("DATA_RETRIEVED")
  );
});
