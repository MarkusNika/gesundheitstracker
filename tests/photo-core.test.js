/* tests/photo-core.test.js
 * --------------------------------------------------------------------------
 * Tests für die reine Logik rund um Fotos (photo-core.js).
 * Ausführen:  node --test     (im Projektordner)
 *
 * Hintergrund (Roadmap): Fotos sollen (a) einem frei wählbaren Monat zugeordnet
 * werden können (Nachtragen) und (b) vor dem Speichern verkleinert werden, damit
 * die IndexedDB nicht von großen Handy-Bildern volläuft.
 *
 * Das eigentliche Verkleinern passiert per <canvas> im Browser (app.js) und ist
 * nicht unit-testbar. Hier wird nur die DOM-freie Rechen-/Prüflogik getestet:
 *   - computeResize     : Zielmaße bei Begrenzung der längsten Kante (Seiten-
 *                         verhältnis bleibt, KEIN Hochskalieren kleiner Bilder)
 *   - defaultPhotoMonth : Vorbelegung des Monatsfeldes (aktueller Monat)
 *   - isValidMonth      : Plausibilität eines 'YYYY-MM'-Strings
 * -------------------------------------------------------------------------- */

const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../photo-core.js');

/* ===================== computeResize ===================== */
test('computeResize: großes Querformat wird auf die maximale Kante begrenzt', () => {
  assert.deepEqual(p.computeResize(4000, 3000, 1280), { width: 1280, height: 960 });
});

test('computeResize: großes Hochformat begrenzt die Höhe', () => {
  assert.deepEqual(p.computeResize(1000, 2000, 1280), { width: 640, height: 1280 });
});

test('computeResize: kleines Bild bleibt unverändert (kein Hochskalieren)', () => {
  assert.deepEqual(p.computeResize(800, 600, 1280), { width: 800, height: 600 });
});

test('computeResize: exakt auf der Grenze bleibt unverändert', () => {
  assert.deepEqual(p.computeResize(1280, 1280, 1280), { width: 1280, height: 1280 });
});

test('computeResize: rundet auf ganze Pixel', () => {
  assert.deepEqual(p.computeResize(3000, 4000, 1000), { width: 750, height: 1000 });
});

test('computeResize: unsinnige Maße werden unverändert zurückgegeben (robust)', () => {
  assert.deepEqual(p.computeResize(0, 0, 1280), { width: 0, height: 0 });
  assert.deepEqual(p.computeResize(-5, 100, 1280), { width: -5, height: 100 });
});

/* ===================== defaultPhotoMonth ===================== */
test('defaultPhotoMonth: liefert den Monat des übergebenen Datums', () => {
  assert.equal(p.defaultPhotoMonth('2026-06-15'), '2026-06');
  assert.equal(p.defaultPhotoMonth('2025-01-01'), '2025-01');
});

/* ===================== isValidMonth ===================== */
test('isValidMonth: korrektes YYYY-MM ist gültig', () => {
  assert.equal(p.isValidMonth('2026-06'), true);
  assert.equal(p.isValidMonth('1999-12'), true);
  assert.equal(p.isValidMonth('2026-01'), true);
});

test('isValidMonth: falsches Format oder unmöglicher Monat ist ungültig', () => {
  assert.equal(p.isValidMonth('2026-13'), false); // Monat > 12
  assert.equal(p.isValidMonth('2026-00'), false); // Monat 0
  assert.equal(p.isValidMonth('2026-6'), false);  // nicht nullgepolstert
  assert.equal(p.isValidMonth('2026-06-15'), false); // ist ein Tagesdatum
  assert.equal(p.isValidMonth(''), false);
  assert.equal(p.isValidMonth(null), false);
});
