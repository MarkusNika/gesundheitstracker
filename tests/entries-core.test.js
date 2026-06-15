/* tests/entries-core.test.js
 * --------------------------------------------------------------------------
 * Tests für die reine Logik der Eintrags-Listen (entries-core.js).
 * Ausführen:  node --test     (im Projektordner)
 *
 * Hintergrund: Der Screen "Heute" (daily) und "Woche" (weekly) bekommen je eine
 * Liste der bisherigen Einträge. Die DOM-Darstellung liegt in app.js; hier wird
 * nur die testbare Logik geprüft:
 *   - formatDateDE   : ISO-Datum 'YYYY-MM-DD' -> deutsche Anzeige 'TT.MM.JJJJ'
 *   - sortByDateDesc : Liste nach Datum absteigend (neueste zuerst), ohne Mutation
 *   - summarizeDaily : kurze Vorschauzeile für einen Tages-Datensatz
 *   - summarizeWeekly: kurze Vorschauzeile für einen Wochen-Datensatz
 *
 * Grundsatz (siehe CLAUDE.md): keine medizinische Bewertung — die Zusammenfassung
 * zeigt nur die erfassten Rohwerte als Gedächtnisstütze in der Liste.
 * -------------------------------------------------------------------------- */

const test = require('node:test');
const assert = require('node:assert/strict');
const e = require('../entries-core.js');

/* ===================== formatDateDE ===================== */
test('formatDateDE: ISO-Datum wird deutsch formatiert', () => {
  assert.equal(e.formatDateDE('2026-06-15'), '15.06.2026');
  assert.equal(e.formatDateDE('2025-01-01'), '01.01.2025');
  assert.equal(e.formatDateDE('1999-12-31'), '31.12.1999');
});

test('formatDateDE: leere/ungültige Eingabe wird unverändert zurückgegeben', () => {
  assert.equal(e.formatDateDE(''), '');
  assert.equal(e.formatDateDE(null), '');
  assert.equal(e.formatDateDE('Quatsch'), 'Quatsch');     // kein ISO-Format -> unverändert
  assert.equal(e.formatDateDE('2026-6-5'), '2026-6-5');   // nicht nullgepolstert -> unverändert
});

/* ===================== sortByDateDesc ===================== */
test('sortByDateDesc: neueste zuerst', () => {
  const input = [
    { date: '2026-01-10' },
    { date: '2026-03-01' },
    { date: '2026-02-15' },
  ];
  const out = e.sortByDateDesc(input);
  assert.deepEqual(out.map((r) => r.date), ['2026-03-01', '2026-02-15', '2026-01-10']);
});

test('sortByDateDesc: verändert die Eingabe-Liste nicht (keine Mutation)', () => {
  const input = [{ date: '2026-01-01' }, { date: '2026-02-02' }];
  const before = input.map((r) => r.date);
  e.sortByDateDesc(input);
  assert.deepEqual(input.map((r) => r.date), before, 'Original-Reihenfolge muss erhalten bleiben');
});

test('sortByDateDesc: leere Liste bleibt leer', () => {
  assert.deepEqual(e.sortByDateDesc([]), []);
});

/* ===================== summarizeDaily ===================== */
test('summarizeDaily: vollständiger Datensatz zeigt RR, Puls und Notiz-Marker', () => {
  const s = e.summarizeDaily({
    date: '2026-06-15', sys: 120, dia: 80, pulse: 65,
    medA_mg: 5, medB_mg: 0, food: 'Salat', protocol: 'gut geschlafen',
  });
  assert.match(s, /120\/80/);
  assert.match(s, /Puls 65/);
  assert.match(s, /Notiz/);
});

test('summarizeDaily: nur Blutdruck (Puls fehlt)', () => {
  const s = e.summarizeDaily({ sys: 130, dia: 85, pulse: null });
  assert.match(s, /130\/85/);
  assert.doesNotMatch(s, /Puls/);
  assert.doesNotMatch(s, /Notiz/);
});

test('summarizeDaily: nur eine Notiz vorhanden', () => {
  const s = e.summarizeDaily({ sys: null, dia: null, pulse: null, food: '', protocol: 'Kopfschmerzen' });
  assert.match(s, /Notiz/);
});

test('summarizeDaily: komplett leerer Datensatz', () => {
  const s = e.summarizeDaily({ sys: null, dia: null, pulse: null, food: '', protocol: '' });
  assert.equal(s, '(leer)');
});

/* ===================== summarizeWeekly ===================== */
test('summarizeWeekly: Gewicht und KFA mit deutschem Dezimalkomma', () => {
  const s = e.summarizeWeekly({ weight_kg: 95.5, bf_pct: 22.3, sum_mm: 60 });
  assert.match(s, /95,5\s*kg/);
  assert.match(s, /22,3\s*%/);
});

test('summarizeWeekly: nur Gewicht (keine Falten)', () => {
  const s = e.summarizeWeekly({ weight_kg: 88, bf_pct: null, sum_mm: null });
  assert.match(s, /88\s*kg/);
  assert.doesNotMatch(s, /%/);
});

test('summarizeWeekly: Falten ohne KFA zeigen die Summe', () => {
  const s = e.summarizeWeekly({ weight_kg: null, bf_pct: null, sum_mm: 48 });
  assert.match(s, /48\s*mm/);
});

test('summarizeWeekly: komplett leerer Datensatz', () => {
  const s = e.summarizeWeekly({ weight_kg: null, bf_pct: null, sum_mm: null });
  assert.equal(s, '(leer)');
});
