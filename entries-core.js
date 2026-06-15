/* entries-core.js — reine Logik für die Listen vergangener Einträge
 * ==========================================================================
 * Der Screen "Heute" (Tages-Einträge) und "Woche" (Wochen-Einträge) bekommen
 * je eine Liste der bisher gespeicherten Datensätze. Damit kommt man an alte
 * Einträge heran, ohne das Datum von Hand zu raten (bisher nur Datumswahl).
 *
 * Diese Datei enthält NUR die testbare, DOM-freie Logik:
 *   - formatDateDE   : ISO-Datum 'YYYY-MM-DD' -> deutsche Anzeige 'TT.MM.JJJJ'
 *   - sortByDateDesc : Liste nach Datum absteigend (neueste zuerst), ohne Mutation
 *   - summarizeDaily : kurze Vorschauzeile für einen Tages-Datensatz
 *   - summarizeWeekly: kurze Vorschauzeile für einen Wochen-Datensatz
 *
 * Das eigentliche Anzeigen/Bearbeiten/Löschen passiert in app.js. Bewusst hier
 * getrennt, damit es (wie validation.js / import-core.js) automatisiert testbar
 * bleibt.
 *
 * GRUNDSATZ (siehe CLAUDE.md): keine medizinische Bewertung. Die Zusammenfassung
 * zeigt ausschließlich die erfassten Rohwerte als Gedächtnisstütze in der Liste.
 *
 * DUAL-ENVIRONMENT (kein Build-Schritt): im Browser als window.GTEntries, in
 * Node per require() für die Tests. Siehe Export-Konstrukt am Dateiende.
 * ========================================================================== */
(function (global) {
  'use strict';

  /* ---------- kleine Helfer ---------- */

  // "wurde ein Wert erfasst?" — null/undefined bedeutet "nicht eingegeben".
  const erfasst = (x) => x !== null && x !== undefined;

  // Zahl mit deutschem Dezimalkomma anzeigen, passend zum Rest der App.
  const zahl = (n) => String(n).replace('.', ',');

  // Hat ein Textfeld (food/protocol) echten Inhalt? (leer/Whitespace zählt nicht)
  const hatText = (s) => typeof s === 'string' && s.trim() !== '';

  /**
   * Formatiert ein ISO-Datum 'YYYY-MM-DD' als deutsches 'TT.MM.JJJJ'.
   * Alles, was nicht exakt diesem Muster entspricht (leer, null, Tippmüll,
   * nicht nullgepolstert), wird unverändert zurückgegeben — robust statt
   * "schlau", damit nie eine kaputte Anzeige entsteht.
   * @param {string} iso
   * @returns {string}
   */
  function formatDateDE(iso) {
    if (!iso || typeof iso !== 'string') return iso || '';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return iso;
    return `${m[3]}.${m[2]}.${m[1]}`;
  }

  /**
   * Sortiert eine Liste von Datensätzen mit Feld `date` ('YYYY-MM-DD')
   * absteigend (neueste zuerst). Gibt eine NEUE Liste zurück; die übergebene
   * Liste bleibt unverändert (keine Seiteneffekte für den Aufrufer).
   * ISO-Datumsstrings sind lexikografisch sortierbar -> localeCompare reicht.
   * @param {Array<{date: string}>} list
   * @returns {Array}
   */
  function sortByDateDesc(list) {
    return (list || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  /**
   * Baut die Kurz-Vorschau für einen Tages-Datensatz (Liste im Heute-Screen).
   * Zeigt Blutdruck (RR sys/dia), Puls und einen "Notiz"-Marker, falls Essen
   * oder Protokoll Text enthalten. Nur erfasste Felder erscheinen.
   * @param {object} rec
   * @returns {string}  z. B. "RR 120/80 · Puls 65 · Notiz"  oder "(leer)"
   */
  function summarizeDaily(rec) {
    rec = rec || {};
    const parts = [];

    if (erfasst(rec.sys) && erfasst(rec.dia)) {
      parts.push(`RR ${rec.sys}/${rec.dia}`);
    } else if (erfasst(rec.sys)) {
      parts.push(`Sys ${rec.sys}`);
    } else if (erfasst(rec.dia)) {
      parts.push(`Dia ${rec.dia}`);
    }

    if (erfasst(rec.pulse)) parts.push(`Puls ${rec.pulse}`);

    if (hatText(rec.food) || hatText(rec.protocol)) parts.push('Notiz');

    return parts.length ? parts.join(' · ') : '(leer)';
  }

  /**
   * Baut die Kurz-Vorschau für einen Wochen-Datensatz (Liste im Woche-Screen).
   * Zeigt Gewicht und Körperfett (KFA). Liegt noch kein KFA vor, aber eine
   * Faltensumme, wird ersatzweise die Summe in mm gezeigt. Deutsches Komma.
   * @param {object} rec
   * @returns {string}  z. B. "95,5 kg · KFA 22,3 %"  oder "(leer)"
   */
  function summarizeWeekly(rec) {
    rec = rec || {};
    const parts = [];

    if (erfasst(rec.weight_kg)) parts.push(`${zahl(rec.weight_kg)} kg`);

    if (erfasst(rec.bf_pct)) {
      parts.push(`KFA ${zahl(rec.bf_pct)} %`);
    } else if (erfasst(rec.sum_mm)) {
      parts.push(`Falten ${zahl(rec.sum_mm)} mm`);
    }

    return parts.length ? parts.join(' · ') : '(leer)';
  }

  /* ---- Öffentliche Schnittstelle in beiden Umgebungen ---- */
  const api = { formatDateDE, sortByDateDesc, summarizeDaily, summarizeWeekly };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api; // Node (Tests)
  } else {
    global.GTEntries = api; // Browser (klassisches <script>)
  }
})(typeof window !== 'undefined' ? window : globalThis);
