/* tests/validation.test.js
 * --------------------------------------------------------------------------
 * Tests für die Eingabe-Validierung (validation.js).
 * Ausführen:  node --test     (im Projektordner)
 *
 * Grundsatz (siehe CLAUDE.md): KEINE medizinischen Bewertungen. Geprüft wird
 * nur Dateneingabe-Plausibilität:
 *   - errors[]   : blockieren das Speichern (logisch unmöglich / sicher falsch)
 *   - warnings[] : nur Hinweis (Tippfehler-Verdacht / methodischer Hinweis),
 *                  Speichern bleibt erlaubt.
 * Eingaben sind bereits geparst: Zahl oder null (null = nicht erfasst -> kein Check).
 * -------------------------------------------------------------------------- */

const test = require('node:test');
const assert = require('node:assert/strict');
const v = require('../validation.js');

/* ===================== validateDaily ===================== */
test('validateDaily: komplett leere Eingabe ist gültig (Teil-Einträge erlaubt)', () => {
  const r = v.validateDaily({ sys: null, dia: null, pulse: null, medA_mg: null, medB_mg: null });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test('validateDaily: normaler Blutdruck ist gültig', () => {
  const r = v.validateDaily({ sys: 120, dia: 80, pulse: 65, medA_mg: 5, medB_mg: 0 });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test('validateDaily: sys <= dia ist ein Fehler (vertauscht/unmöglich)', () => {
  assert.ok(v.validateDaily({ sys: 80, dia: 120 }).errors.some((e) => /[Ss]ystol/.test(e)));
  assert.ok(v.validateDaily({ sys: 100, dia: 100 }).errors.length > 0); // gleich -> auch Fehler
});

test('validateDaily: nicht-positive Messwerte sind Fehler', () => {
  assert.ok(v.validateDaily({ sys: -5 }).errors.length > 0);
  assert.ok(v.validateDaily({ pulse: 0 }).errors.length > 0);
});

test('validateDaily: Dosis 0 ist ok, negative Dosis ist Fehler', () => {
  assert.deepEqual(v.validateDaily({ medA_mg: 0 }).errors, []);
  assert.ok(v.validateDaily({ medB_mg: -1 }).errors.length > 0);
});

test('validateDaily: Werte außerhalb der Plausi-Bänder sind nur Warnungen', () => {
  const r = v.validateDaily({ sys: 1200, dia: 80 }); // klarer Tippfehler
  assert.deepEqual(r.errors, [], 'darf nicht blockieren');
  assert.ok(r.warnings.length > 0, 'sollte warnen');
});

test('validateDaily: unplausibel hohe Dosis warnt, blockiert aber nicht', () => {
  const r = v.validateDaily({ medA_mg: 99999 });
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.length > 0);
});

/* ---- Erweitertes Tages-Tracking: Abend-BP, Schritte, Befinden ---- */
test('validateDaily: Abend-Blutdruck sys_e <= dia_e ist Fehler', () => {
  assert.ok(v.validateDaily({ sys_e: 80, dia_e: 120 }).errors.some((e) => /abend/i.test(e)));
  assert.ok(v.validateDaily({ sys_e: 100, dia_e: 100 }).errors.length > 0);
});

test('validateDaily: nicht-positiver Abend-Messwert ist Fehler', () => {
  assert.ok(v.validateDaily({ sys_e: -1 }).errors.length > 0);
  assert.ok(v.validateDaily({ pulse_e: 0 }).errors.length > 0);
});

test('validateDaily: normaler Abend-Blutdruck ist gültig', () => {
  const r = v.validateDaily({ sys_e: 125, dia_e: 82, pulse_e: 68 });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test('validateDaily: unplausibler Abend-BP warnt, blockiert nicht', () => {
  const r = v.validateDaily({ sys_e: 1200, dia_e: 80 });
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.length > 0);
});

test('validateDaily: Schritte negativ ist Fehler, 0 ist ok', () => {
  assert.ok(v.validateDaily({ steps: -100 }).errors.length > 0);
  assert.deepEqual(v.validateDaily({ steps: 0 }).errors, []);
  assert.deepEqual(v.validateDaily({ steps: 7500 }).errors, []);
});

test('validateDaily: unplausibel hohe Schrittzahl warnt nur', () => {
  const r = v.validateDaily({ steps: 200000 });
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.length > 0);
});

test('validateDaily: Energie/Libido müssen ganze Zahl 1..10 sein', () => {
  assert.deepEqual(v.validateDaily({ energy: 7, libido: 3 }).errors, []);
  assert.ok(v.validateDaily({ energy: 0 }).errors.length > 0);
  assert.ok(v.validateDaily({ libido: 11 }).errors.length > 0);
  assert.ok(v.validateDaily({ energy: 5.5 }).errors.length > 0);
});

test('validateDaily: Schlafdauer außerhalb 0..24 h ist Fehler', () => {
  assert.ok(v.validateDaily({ sleep_h: -1 }).errors.length > 0);
  assert.ok(v.validateDaily({ sleep_h: 25 }).errors.length > 0);
  assert.deepEqual(v.validateDaily({ sleep_h: 7.5 }).errors, []);
});

test('validateDaily: ungewöhnliche (aber mögliche) Schlafdauer warnt nur', () => {
  const r = v.validateDaily({ sleep_h: 1 });
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.length > 0);
});

/* ===================== validateWeekly ===================== */
test('validateWeekly: leere Eingabe ist gültig', () => {
  const r = v.validateWeekly({ weight_kg: null, chest_mm: null, abdomen_mm: null, thigh_mm: null });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test('validateWeekly: normale Werte sind gültig', () => {
  const r = v.validateWeekly({ weight_kg: 95, chest_mm: 15, abdomen_mm: 25, thigh_mm: 20 });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test('validateWeekly: nicht-positives Gewicht / Falten sind Fehler', () => {
  assert.ok(v.validateWeekly({ weight_kg: -1 }).errors.length > 0);
  assert.ok(v.validateWeekly({ chest_mm: 0 }).errors.length > 0);
});

test('validateWeekly: unplausibles Gewicht warnt nur', () => {
  const r = v.validateWeekly({ weight_kg: 5 }); // zu niedrig -> Tippfehler-Verdacht
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.length > 0);
});

test('validateWeekly: sehr dicke Hautfalte erzeugt methodischen Hinweis (Warnung)', () => {
  const r = v.validateWeekly({ chest_mm: 45 }); // > validierter Bereich (~40-50mm)
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some((w) => /valid|Trend/i.test(w)));
});

/* ===================== validateConfig ===================== */
test('validateConfig: leeres Geburtsdatum ist ok', () => {
  assert.deepEqual(v.validateConfig({ birthdate: '' }, '2026-06-15').errors, []);
});

test('validateConfig: Geburtsdatum in der Zukunft ist Fehler', () => {
  assert.ok(v.validateConfig({ birthdate: '2030-01-01' }, '2026-06-15').errors.length > 0);
});

test('validateConfig: plausibles Geburtsdatum in der Vergangenheit ist ok', () => {
  assert.deepEqual(v.validateConfig({ birthdate: '1980-03-01' }, '2026-06-15').errors, []);
});

test('validateConfig: normale Standard-Dosen sind ok', () => {
  const r = v.validateConfig({ medA_dose: 5, medB_dose: 50 }, '2026-06-15');
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test('validateConfig: negative Standard-Dosis ist Fehler', () => {
  assert.ok(v.validateConfig({ medA_dose: -1 }, '2026-06-15').errors.length > 0);
});

test('validateConfig: unplausibel hohe Standard-Dosis warnt, blockiert nicht', () => {
  const r = v.validateConfig({ medB_dose: 99999 }, '2026-06-15');
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.length > 0);
});

test('validateConfig: fehlende Standard-Dosis (null) ist ok', () => {
  assert.deepEqual(v.validateConfig({ medA_dose: null, medB_dose: undefined }, '2026-06-15').errors, []);
});
