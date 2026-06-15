/* tests/bodyfat-core.test.js
 * --------------------------------------------------------------------------
 * Tests für die Körperfett-Berechnung (bodyfat-core.js).
 * Ausführen:  node --test     (im Projektordner)
 *
 * Zwei validierte Jackson-Pollock-3-Punkt-Protokolle (Siri-Umrechnung):
 *   - Männer (1978): Brust + Bauch + Oberschenkel
 *   - Frauen  (1980, Jackson/Pollock/Ward): Trizeps + Suprailiac + Oberschenkel
 *
 * WICHTIG (CLAUDE.md): Formeln nicht ohne Quelle ändern. Die Referenz-Erwartungen
 * unten wurden UNABHÄNGIG von bodyfat-core.js (separat ausgerechnet) gesetzt, damit
 * der Test die Implementierung nicht gegen sich selbst prüft.
 *   Quelle Frauen: Jackson, Pollock & Ward (1980), Med. Sci. Sports Exerc. 12(3), 175-181.
 * -------------------------------------------------------------------------- */

const test = require('node:test');
const assert = require('node:assert/strict');
const bf = require('../bodyfat-core.js');

/* ===================== Männer (Bestandsformel, jetzt abgesichert) ===================== */
test('male: Referenzwerte (unabhängig berechnet)', () => {
  assert.equal(bf.male(60, 40), 19.1);
  assert.equal(bf.male(120, 45), 34.5);
});

/* ===================== Frauen (Jackson-Pollock-Ward 1980) ===================== */
test('female: Referenzwerte (unabhängig berechnet)', () => {
  assert.equal(bf.female(60, 40), 24.8);
  assert.equal(bf.female(90, 35), 33.5);
  assert.equal(bf.female(45, 30), 19.1);
});

test('female: mehr Hautfalte -> höherer KFA (monoton steigend)', () => {
  assert.ok(bf.female(50, 40) < bf.female(80, 40));
});

/* ===================== Dispatch nach Geschlecht ===================== */
test('bySex: female nutzt die Frauen-, sonst die Männer-Formel', () => {
  assert.equal(bf.bySex('female', 60, 40), 24.8);
  assert.equal(bf.bySex('male', 60, 40), 19.1);
});

test('bySex: unbekanntes/leeres Geschlecht fällt auf Männer zurück (Bestandsverhalten)', () => {
  assert.equal(bf.bySex(undefined, 60, 40), 19.1);
  assert.equal(bf.bySex('', 60, 40), 19.1);
});

/* ===================== Robustheit / ungültige Eingaben ===================== */
test('male/female: fehlende oder nicht-positive Eingaben ergeben null', () => {
  assert.equal(bf.male(null, 40), null);
  assert.equal(bf.male(60, null), null);
  assert.equal(bf.male(0, 40), null);
  assert.equal(bf.female(-5, 40), null);
  assert.equal(bf.female(undefined, undefined), null);
});
