/* tests/import-core.test.js
 * --------------------------------------------------------------------------
 * Automatisierte Tests für die reine Import-Logik (import-core.js).
 *
 * Ausführen:  node --test           (im Projektordner)
 * Es wird NUR der eingebaute Test-Runner von Node genutzt (node:test + assert)
 * — keine externen Pakete, kein Build-Schritt. Damit bleibt die App selbst
 * weiterhin framework-frei (PWA-first); Tests sind reines Dev-Werkzeug und
 * werden nicht ausgeliefert.
 *
 * Getestet wird der "Vertrag" der Funktionen in import-core.js:
 *   - validateBackup()  : prüft Struktur/Version einer Backup-Datei
 *   - base64ToBlob()    : dekodiert Base64 (Gegenstück zu blobToBase64 in app.js)
 *   - partitionPhotos() : trennt zu importierende Fotos von Duplikaten
 * -------------------------------------------------------------------------- */

const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../import-core.js');

/* ---------- Hilfen: ein minimales, gültiges Backup-Objekt bauen ---------- */
function gueltigesBackup(overrides = {}) {
  return Object.assign(
    {
      version: 1,
      exportedAt: '2026-06-15T10:00:00.000Z',
      daily: [{ date: '2026-06-14', sys: 120, dia: 80 }],
      weekly: [{ date: '2026-06-14', weight_kg: 95 }],
      settings: [{ key: 'config', sex: 'male' }],
      photos: [],
    },
    overrides
  );
}

/* ===================== validateBackup ===================== */
test('validateBackup akzeptiert ein gültiges Backup und zählt die Datensätze', () => {
  const r = core.validateBackup(gueltigesBackup({ daily: [{ date: 'a' }, { date: 'b' }] }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, []);
  assert.equal(r.counts.daily, 2);
  assert.equal(r.counts.weekly, 1);
  assert.equal(r.counts.settings, 1);
  assert.equal(r.counts.photos, 0);
});

test('validateBackup lehnt Nicht-Objekte ab (null, String, Array)', () => {
  for (const bad of [null, undefined, 'text', 42, []]) {
    const r = core.validateBackup(bad);
    assert.equal(r.ok, false, `sollte ${JSON.stringify(bad)} ablehnen`);
    assert.ok(r.errors.length > 0);
  }
});

test('validateBackup lehnt falsche/fehlende version ab', () => {
  assert.equal(core.validateBackup(gueltigesBackup({ version: 2 })).ok, false);
  const ohne = gueltigesBackup();
  delete ohne.version;
  assert.equal(core.validateBackup(ohne).ok, false);
});

test('validateBackup verlangt, dass daily/weekly/settings/photos Arrays sind', () => {
  for (const feld of ['daily', 'weekly', 'settings', 'photos']) {
    const b = gueltigesBackup({ [feld]: { kein: 'array' } });
    const r = core.validateBackup(b);
    assert.equal(r.ok, false, `${feld} als Nicht-Array sollte fehlschlagen`);
    assert.ok(r.errors.some((e) => e.includes(feld)), `Fehlermeldung sollte ${feld} nennen`);
  }
});

test('validateBackup sammelt mehrere Fehler gleichzeitig', () => {
  const r = core.validateBackup({ version: 1, daily: 'x', weekly: 'y' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.length >= 2);
});

test('validateBackup: fehlendes optionales "training" ist ok (altes Backup)', () => {
  const r = core.validateBackup(gueltigesBackup()); // ohne training-Feld
  assert.equal(r.ok, true);
  assert.equal(r.counts.training, undefined); // nicht gezählt, weil nicht vorhanden
});

test('validateBackup: vorhandenes "training" wird geprüft und gezählt', () => {
  const r = core.validateBackup(gueltigesBackup({ training: [{ date: '2026-07-06', exercises: [] }] }));
  assert.equal(r.ok, true);
  assert.equal(r.counts.training, 1);
});

test('validateBackup: "training" als Nicht-Array ist Fehler', () => {
  const r = core.validateBackup(gueltigesBackup({ training: { kein: 'array' } }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('training')));
});

/* ===================== base64ToBlob ===================== */
test('base64ToBlob erzeugt einen Blob mit korrekter Größe und Typ', async () => {
  // "Hi" -> Base64 "SGk="
  const blob = core.base64ToBlob('SGk=', 'text/plain');
  assert.equal(blob.size, 2);
  assert.equal(blob.type, 'text/plain');
  const text = await blob.text();
  assert.equal(text, 'Hi');
});

test('base64ToBlob nutzt einen Standard-MIME-Typ, wenn keiner angegeben ist', () => {
  const blob = core.base64ToBlob('SGk=');
  assert.equal(blob.type, 'application/octet-stream');
});

test('base64ToBlob ist exaktes Gegenstück zu Base64 binärer Daten', async () => {
  // Bytes 0,1,2,253,254,255 -> Base64
  const bytes = Uint8Array.from([0, 1, 2, 253, 254, 255]);
  const b64 = Buffer.from(bytes).toString('base64');
  const blob = core.base64ToBlob(b64, 'application/octet-stream');
  const back = new Uint8Array(await blob.arrayBuffer());
  assert.deepEqual(Array.from(back), Array.from(bytes));
});

/* ===================== partitionPhotos ===================== */
test('partitionPhotos: ohne vorhandene Fotos werden alle übernommen', () => {
  const imported = [
    { month: '2026-05', created: 1000, data: 'a' },
    { month: '2026-06', created: 2000, data: 'b' },
  ];
  const r = core.partitionPhotos([], imported);
  assert.equal(r.toAdd.length, 2);
  assert.equal(r.skipped, 0);
});

test('partitionPhotos überspringt Fotos, die (month+created) schon existieren', () => {
  const existing = [{ month: '2026-05', created: 1000 }];
  const imported = [
    { month: '2026-05', created: 1000, data: 'dup' }, // Duplikat -> skip
    { month: '2026-05', created: 1001, data: 'neu' }, // gleicher Monat, andere Zeit -> add
  ];
  const r = core.partitionPhotos(existing, imported);
  assert.equal(r.skipped, 1);
  assert.equal(r.toAdd.length, 1);
  assert.equal(r.toAdd[0].data, 'neu');
});

test('partitionPhotos entfernt auch Duplikate INNERHALB des Imports', () => {
  const imported = [
    { month: '2026-05', created: 1000, data: 'erst' },
    { month: '2026-05', created: 1000, data: 'nochmal' }, // identischer Key -> skip
  ];
  const r = core.partitionPhotos([], imported);
  assert.equal(r.toAdd.length, 1);
  assert.equal(r.skipped, 1);
});
