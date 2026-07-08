/* import-core.js — reine, testbare Logik für den JSON-Backup-Import
 * ==========================================================================
 * WARUM eine eigene Datei?
 *   Die eigentliche Import-Orchestrierung in app.js hängt an DOM und IndexedDB
 *   und lässt sich schlecht automatisiert testen. Die "denkende" Logik
 *   (Struktur prüfen, Base64 dekodieren, Foto-Duplikate erkennen) ist dagegen
 *   pur (keine Seiteneffekte) und damit gut testbar. Sie liegt deshalb hier.
 *
 * DUAL-ENVIRONMENT (kein Build-Schritt!):
 *   - Im Browser wird die Datei per klassischem <script src="import-core.js">
 *     geladen und stellt die Funktionen unter window.GTImport bereit.
 *   - In Node (Tests) wird sie per require() geladen und exportiert dieselben
 *     Funktionen über module.exports.
 *   Beide Wege nutzen denselben Code — siehe das Export-Konstrukt am Dateiende.
 *
 * ABHÄNGIGKEITEN: nur Web-Standard-APIs (atob, Uint8Array, Blob). Diese gibt es
 *   sowohl im Browser als auch in modernem Node (>=18), daher keine Polyfills.
 * ========================================================================== */
(function (global) {
  'use strict';

  /* Die vier Pflicht-Stores, die eine Vollsicherung immer enthält. Reihenfolge
   * egal, aber alle müssen als Array vorliegen (so schreibt sie exportBackup()). */
  const STORES = ['daily', 'weekly', 'settings', 'photos'];

  /* Später ergänzte Stores. Dürfen in älteren Backups fehlen (Rückwärts-
   * kompatibilität), müssen aber ein Array sein, wenn sie vorhanden sind. */
  const OPTIONAL_STORES = ['training'];

  /**
   * Prüft, ob ein eingelesenes JSON-Objekt eine gültige Vollsicherung ist.
   *
   * Bewusst defensiv: Ein halb-gültiges Backup darf NICHT teilweise importiert
   * werden (sonst landen kaputte Daten in der DB). Lieber klar ablehnen.
   *
   * @param {*} obj  Das Ergebnis von JSON.parse(dateiинhalt).
   * @returns {{ok: boolean, errors: string[], counts: object}}
   *          ok=true nur, wenn keine Fehler. counts zählt die Datensätze je
   *          Store (nur sinnvoll, wenn ok=true).
   */
  function validateBackup(obj) {
    const errors = [];

    // 1) Grundtyp: muss ein "echtes" Objekt sein (kein null, Array, Primitive).
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
      return { ok: false, errors: ['Datei enthält kein Backup-Objekt.'], counts: {} };
    }

    // 2) Versionsstempel. Aktuell kennt der Export nur version === 1.
    //    Andere Versionen lehnen wir ab, statt zu raten.
    if (obj.version !== 1) {
      errors.push('Unbekannte oder fehlende Backup-Version (erwartet: 1).');
    }

    // 3) Jeder Pflicht-Store muss als Array vorhanden sein.
    const counts = {};
    for (const store of STORES) {
      if (!Array.isArray(obj[store])) {
        errors.push(`Feld "${store}" fehlt oder ist kein Array.`);
      } else {
        counts[store] = obj[store].length;
      }
    }

    // 4) Optionale Stores: erst später eingeführt, dürfen in alten Backups fehlen.
    //    Wenn vorhanden, müssen sie aber ein Array sein.
    for (const store of OPTIONAL_STORES) {
      if (store in obj) {
        if (!Array.isArray(obj[store])) {
          errors.push(`Feld "${store}" ist kein Array.`);
        } else {
          counts[store] = obj[store].length;
        }
      }
    }

    return { ok: errors.length === 0, errors, counts };
  }

  /**
   * Dekodiert einen Base64-String in einen Blob.
   * Gegenstück zu blobToBase64() in app.js (dort wird beim Export kodiert).
   *
   * @param {string} b64   Base64-Daten OHNE "data:"-Präfix (so legt sie der Export ab).
   * @param {string} [type] MIME-Typ des späteren Blobs (z. B. "image/jpeg").
   * @returns {Blob}
   */
  function base64ToBlob(b64, type) {
    // atob() liefert einen "Binär-String": ein Zeichen pro Byte (Codepoint 0..255).
    const binaer = atob(b64);
    const bytes = new Uint8Array(binaer.length);
    for (let i = 0; i < binaer.length; i++) {
      bytes[i] = binaer.charCodeAt(i);
    }
    return new Blob([bytes], { type: type || 'application/octet-stream' });
  }

  /**
   * Eindeutiger Schlüssel eines Fotos für die Duplikat-Erkennung.
   * Zwei Fotos gelten als gleich, wenn Monat UND Erstellzeitpunkt übereinstimmen.
   * (Die DB-eigene autoIncrement-id taugt NICHT, weil sie pro Gerät neu vergeben
   *  wird und nach einem Import auf einem anderen Gerät anders aussieht.)
   */
  function photoKey(photo) {
    return `${photo.month}|${photo.created}`;
  }

  /**
   * Teilt die zu importierenden Fotos in "neu übernehmen" und "übersprungen".
   * Übersprungen wird, was bereits in der DB existiert ODER innerhalb des
   * Imports doppelt vorkommt (mehrfacher Import derselben Datei).
   *
   * @param {Array} existingPhotos Bereits in der DB vorhandene Fotos ({month, created, ...}).
   * @param {Array} importedPhotos Fotos aus dem Backup ({month, created, data, type, ...}).
   * @returns {{toAdd: Array, skipped: number}}
   */
  function partitionPhotos(existingPhotos, importedPhotos) {
    // Set aller bereits bekannten Schlüssel — schnelle Nachschlage-Prüfung.
    const gesehen = new Set((existingPhotos || []).map(photoKey));
    const toAdd = [];
    let skipped = 0;

    for (const foto of importedPhotos || []) {
      const key = photoKey(foto);
      if (gesehen.has(key)) {
        skipped++; // schon in DB oder schon weiter oben im Import gesehen
      } else {
        gesehen.add(key); // ab jetzt bekannt -> fängt Duplikate innerhalb des Imports
        toAdd.push(foto);
      }
    }
    return { toAdd, skipped };
  }

  /* ---- Öffentliche Schnittstelle in beiden Umgebungen bereitstellen ---- */
  const api = { validateBackup, base64ToBlob, photoKey, partitionPhotos, STORES, OPTIONAL_STORES };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api; // Node (Tests)
  } else {
    global.GTImport = api; // Browser (klassisches <script>)
  }
})(typeof window !== 'undefined' ? window : globalThis);
