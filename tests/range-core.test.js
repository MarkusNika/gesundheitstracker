/* tests/range-core.test.js
 * --------------------------------------------------------------------------
 * Tests für den Chart-Zeitraumfilter (range-core.js).
 * Ausführen:  node --test     (im Projektordner)
 *
 * Hintergrund (Roadmap): Die Verlauf-Charts zeigen bisher immer ALLE Daten.
 * Es soll ein Filter "letzte 4 / 12 Wochen / alles" möglich sein.
 *
 * Reine, DOM-freie Logik:
 *   - cutoffISO     : Stichtag = heutiges Datum minus N Wochen (oder null = alles)
 *   - filterByRange : behält nur Datensätze ab dem Stichtag (Datum inklusive)
 *
 * Datumsrechnung läuft über UTC, damit Zeitzonen/Sommerzeit nichts verschieben.
 * -------------------------------------------------------------------------- */

const test = require('node:test');
const assert = require('node:assert/strict');
const r = require('../range-core.js');

/* ===================== cutoffISO ===================== */
test('cutoffISO: 4 Wochen = 28 Tage zurück', () => {
  assert.equal(r.cutoffISO('2026-06-15', 4), '2026-05-18');
});

test('cutoffISO: 12 Wochen = 84 Tage zurück', () => {
  assert.equal(r.cutoffISO('2026-06-15', 12), '2026-03-23');
});

test('cutoffISO: rechnet über Jahresgrenzen korrekt', () => {
  assert.equal(r.cutoffISO('2026-01-10', 4), '2025-12-13');
});

test('cutoffISO: 0 oder null bedeutet "alles" (kein Stichtag)', () => {
  assert.equal(r.cutoffISO('2026-06-15', 0), null);
  assert.equal(r.cutoffISO('2026-06-15', null), null);
});

/* ===================== filterByRange ===================== */
const ROWS = [
  { date: '2026-05-01' },
  { date: '2026-06-10' },
  { date: '2026-06-15' },
];

test('filterByRange: behält nur Datensätze ab dem Stichtag', () => {
  const out = r.filterByRange(ROWS, '2026-05-18');
  assert.deepEqual(out.map((x) => x.date), ['2026-06-10', '2026-06-15']);
});

test('filterByRange: Stichtag ist inklusive (Gleichheit zählt dazu)', () => {
  const out = r.filterByRange(ROWS, '2026-06-10');
  assert.deepEqual(out.map((x) => x.date), ['2026-06-10', '2026-06-15']);
});

test('filterByRange: null als Stichtag gibt alles zurück', () => {
  assert.deepEqual(r.filterByRange(ROWS, null).map((x) => x.date),
    ['2026-05-01', '2026-06-10', '2026-06-15']);
});

test('filterByRange: verändert die Eingabe-Liste nicht', () => {
  const before = ROWS.map((x) => x.date);
  r.filterByRange(ROWS, '2026-06-10');
  assert.deepEqual(ROWS.map((x) => x.date), before);
});

test('filterByRange: leere Liste bleibt leer', () => {
  assert.deepEqual(r.filterByRange([], '2026-01-01'), []);
});
