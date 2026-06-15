/* range-core.js — reine Logik für den Chart-Zeitraumfilter
 * ==========================================================================
 * Die Verlauf-Charts sollen wahlweise nur die letzten 4 oder 12 Wochen zeigen
 * (oder alles). Diese Datei enthält die DOM-freie, testbare Logik:
 *   - cutoffISO     : Stichtag = heutiges Datum minus N Wochen (oder null = alles)
 *   - filterByRange : behält nur Datensätze mit date >= Stichtag (inklusive)
 *
 * Die Datumsrechnung läuft bewusst über UTC (Date.UTC / getUTC*), damit lokale
 * Zeitzonen und Sommer-/Winterzeit den Stichtag nicht um einen Tag verschieben.
 * ISO-Datumsstrings 'YYYY-MM-DD' sind lexikografisch vergleichbar -> der Filter
 * braucht nur String-Vergleiche.
 *
 * DUAL-ENVIRONMENT (kein Build-Schritt): im Browser als window.GTRange, in Node
 * per require() für die Tests. Siehe Export-Konstrukt am Dateiende.
 * ========================================================================== */
(function (global) {
  'use strict';

  /**
   * Stichtag = `todayISO` minus `weeks` Wochen, als 'YYYY-MM-DD'.
   * `weeks` 0/null/undefined bedeutet "kein Filter" -> Rückgabe null.
   * @param {string} todayISO  heutiges Datum 'YYYY-MM-DD' (injiziert -> testbar)
   * @param {number} weeks     Anzahl Wochen rückwärts
   * @returns {string|null}
   */
  function cutoffISO(todayISO, weeks) {
    if (!weeks || weeks <= 0) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(todayISO || ''));
    if (!m) return null;
    // In UTC rechnen, damit kein Zeitzonen-Versatz entsteht.
    const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const d = new Date(ms - weeks * 7 * 24 * 60 * 60 * 1000);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * Behält aus `rows` nur die Datensätze, deren `date` >= `cutoff` ist
   * (Stichtag inklusive). `cutoff` null/leer -> alle Datensätze. Gibt eine
   * NEUE Liste zurück; die Eingabe bleibt unverändert.
   * @param {Array<{date: string}>} rows
   * @param {string|null} cutoff  'YYYY-MM-DD' oder null
   * @returns {Array}
   */
  function filterByRange(rows, cutoff) {
    if (!cutoff) return (rows || []).slice();
    return (rows || []).filter((row) => String(row.date) >= cutoff);
  }

  /* ---- Öffentliche Schnittstelle in beiden Umgebungen ---- */
  const api = { cutoffISO, filterByRange };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api; // Node (Tests)
  } else {
    global.GTRange = api; // Browser (klassisches <script>)
  }
})(typeof window !== 'undefined' ? window : globalThis);
