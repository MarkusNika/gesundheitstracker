/* tests/training-core.test.js
 * --------------------------------------------------------------------------
 * Tests für die reine Logik des Trainings-Logs (training-core.js).
 * Ausführen:  node --test     (im Projektordner)
 *
 * Ein Trainings-Eintrag pro Tag hält eine Liste von Übungen:
 *   { date, exercises: [ { name, sets, reps, duration_min, difficulty } ], note }
 *
 * Getestet wird nur die DOM-freie Logik:
 *   - formatExercise   : eine Übung als kurze Zeile ("Rückenheben: 3×12, Stufe 6")
 *   - summarizeSession : Kurzfassung eines Tages für die Liste
 *   - validateExercise : Plausibilität einer einzelnen Übung (Name Pflicht,
 *                        Zahlen positiv, Schwierigkeit 1..10)
 *   - PRESET_EXERCISES : die drei Standard-Heimübungen als Startauswahl
 * -------------------------------------------------------------------------- */

const test = require('node:test');
const assert = require('node:assert/strict');
const t = require('../training-core.js');

/* ===================== PRESET_EXERCISES ===================== */
test('PRESET_EXERCISES: enthält die drei Standard-Heimübungen', () => {
  assert.ok(Array.isArray(t.PRESET_EXERCISES));
  assert.equal(t.PRESET_EXERCISES.length, 3);
  assert.ok(t.PRESET_EXERCISES.every((s) => typeof s === 'string' && s.length > 0));
});

/* ===================== formatExercise ===================== */
test('formatExercise: Sätze × Wiederholungen', () => {
  assert.equal(t.formatExercise({ name: 'Rückenheben', sets: 3, reps: 12 }), 'Rückenheben: 3×12');
});

test('formatExercise: reine Haltedauer in Minuten', () => {
  assert.equal(t.formatExercise({ name: 'Baum-Umarmung', duration_min: 5 }), 'Baum-Umarmung: 5 min');
});

test('formatExercise: mit Schwierigkeitsstufe', () => {
  assert.equal(t.formatExercise({ name: 'Beinheben', sets: 3, reps: 10, difficulty: 6 }), 'Beinheben: 3×10, Stufe 6');
});

test('formatExercise: nur Wiederholungen bzw. nur Sätze', () => {
  assert.equal(t.formatExercise({ name: 'A', reps: 15 }), 'A: 15 Wdh.');
  assert.equal(t.formatExercise({ name: 'B', sets: 4 }), 'B: 4 Sätze');
});

test('formatExercise: Nachkommastelle mit deutschem Komma', () => {
  assert.equal(t.formatExercise({ name: 'Plank', duration_min: 1.5 }), 'Plank: 1,5 min');
});

test('formatExercise: nur Name (keine Zahlen)', () => {
  assert.equal(t.formatExercise({ name: 'Dehnen' }), 'Dehnen');
  assert.equal(t.formatExercise({}), 'Übung');
});

/* ===================== summarizeSession ===================== */
test('summarizeSession: mehrere Übungen mit Anzahl und Namen', () => {
  const s = t.summarizeSession({ exercises: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] });
  assert.equal(s, '3 Übungen: A, B, C');
});

test('summarizeSession: eine Übung -> Singular', () => {
  assert.equal(t.summarizeSession({ exercises: [{ name: 'A' }] }), '1 Übung: A');
});

test('summarizeSession: leeres/fehlendes Training', () => {
  assert.equal(t.summarizeSession({ exercises: [] }), '(kein Training)');
  assert.equal(t.summarizeSession({}), '(kein Training)');
});

/* ===================== validateExercise ===================== */
test('validateExercise: vollständige Übung ist gültig', () => {
  const r = t.validateExercise({ name: 'Beinheben', sets: 3, reps: 12, difficulty: 6 });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test('validateExercise: Name ist Pflicht', () => {
  assert.ok(t.validateExercise({ name: '' }).errors.length > 0);
  assert.ok(t.validateExercise({ name: '   ' }).errors.length > 0);
});

test('validateExercise: nur Name ist gültig (Zahlen optional)', () => {
  assert.deepEqual(t.validateExercise({ name: 'Dehnen' }).errors, []);
});

test('validateExercise: nicht-positive/ungültige Zahlen sind Fehler', () => {
  assert.ok(t.validateExercise({ name: 'A', sets: 0 }).errors.length > 0);
  assert.ok(t.validateExercise({ name: 'A', reps: -5 }).errors.length > 0);
  assert.ok(t.validateExercise({ name: 'A', sets: 2.5 }).errors.length > 0);
  assert.ok(t.validateExercise({ name: 'A', duration_min: 0 }).errors.length > 0);
});

test('validateExercise: Schwierigkeit muss ganze Zahl 1..10 sein', () => {
  assert.deepEqual(t.validateExercise({ name: 'A', difficulty: 1 }).errors, []);
  assert.ok(t.validateExercise({ name: 'A', difficulty: 0 }).errors.length > 0);
  assert.ok(t.validateExercise({ name: 'A', difficulty: 11 }).errors.length > 0);
  assert.ok(t.validateExercise({ name: 'A', difficulty: 5.5 }).errors.length > 0);
});

test('validateExercise: unplausibel hohe Zahlen warnen nur', () => {
  const r = t.validateExercise({ name: 'A', sets: 100, reps: 5000 });
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.length > 0);
});
