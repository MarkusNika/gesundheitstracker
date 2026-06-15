/* photo-core.js — reine Logik rund um Fotos (Monatszuordnung + Verkleinern)
 * ==========================================================================
 * Zwei Roadmap-Wünsche bei den Fotos:
 *   (a) Ein Foto soll einem frei wählbaren Monat zugeordnet werden (Nachtragen),
 *       nicht immer dem aktuellen.
 *   (b) Vor dem Speichern soll das Bild verkleinert werden, damit große
 *       Handy-Fotos die IndexedDB nicht zumüllen.
 *
 * Das eigentliche Verkleinern (Bild dekodieren, auf <canvas> zeichnen, als
 * JPEG-Blob ausgeben) ist Browser-/DOM-Arbeit und steckt in app.js. HIER liegt
 * nur die DOM-freie, testbare Rechen- und Prüflogik:
 *   - computeResize     : Zielmaße bei Begrenzung der längsten Kante
 *   - defaultPhotoMonth : Vorbelegung des Monatsfeldes
 *   - isValidMonth      : Plausibilität eines 'YYYY-MM'-Strings
 *
 * DUAL-ENVIRONMENT (kein Build-Schritt): im Browser als window.GTPhoto, in Node
 * per require() für die Tests. Siehe Export-Konstrukt am Dateiende.
 * ========================================================================== */
(function (global) {
  'use strict';

  /**
   * Rechnet die Zielmaße eines Bildes aus, wenn die LÄNGSTE Kante auf `maxEdge`
   * Pixel begrenzt wird. Das Seitenverhältnis bleibt erhalten. Bilder, die schon
   * kleiner/gleich sind, werden NICHT hochskaliert (Qualität nie verschlechtern).
   * Unsinnige Eingaben (<= 0) werden unverändert zurückgegeben.
   * @param {number} w        Quellbreite in px
   * @param {number} h        Quellhöhe in px
   * @param {number} maxEdge  Maximale Kantenlänge in px
   * @returns {{width: number, height: number}} ganzzahlige Zielmaße
   */
  function computeResize(w, h, maxEdge) {
    if (!(w > 0) || !(h > 0) || !(maxEdge > 0)) return { width: w, height: h };
    const longest = Math.max(w, h);
    if (longest <= maxEdge) return { width: w, height: h }; // kein Hochskalieren
    const scale = maxEdge / longest;
    return { width: Math.round(w * scale), height: Math.round(h * scale) };
  }

  /**
   * Vorbelegung des Monatsfeldes: der Monat des übergebenen ISO-Datums.
   * @param {string} todayISO  'YYYY-MM-DD'
   * @returns {string} 'YYYY-MM'
   */
  function defaultPhotoMonth(todayISO) {
    return String(todayISO || '').slice(0, 7);
  }

  /**
   * Prüft, ob ein String ein plausibler Monat im Format 'YYYY-MM' ist
   * (Monat 01–12, nullgepolstert). Schützt vor leeren/kaputten Eingaben.
   * @param {string} s
   * @returns {boolean}
   */
  function isValidMonth(s) {
    if (typeof s !== 'string') return false;
    const m = /^(\d{4})-(\d{2})$/.exec(s);
    if (!m) return false;
    const monat = Number(m[2]);
    return monat >= 1 && monat <= 12;
  }

  /* ---- Öffentliche Schnittstelle in beiden Umgebungen ---- */
  const api = { computeResize, defaultPhotoMonth, isValidMonth };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api; // Node (Tests)
  } else {
    global.GTPhoto = api; // Browser (klassisches <script>)
  }
})(typeof window !== 'undefined' ? window : globalThis);
