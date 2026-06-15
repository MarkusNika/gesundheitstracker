/* bodyfat-core.js — Körperfett-Berechnung (Jackson-Pollock 3-Punkt, Siri)
 * ==========================================================================
 * Zwei validierte 3-Punkt-Protokolle. Beide rechnen erst die Körperdichte und
 * setzen sie dann per Siri-Gleichung in den Körperfettanteil um:
 *
 *   Körperfett %  = 495 / Körperdichte - 450        (Siri)
 *
 * MÄNNER — Jackson & Pollock (1978), Sites: Brust + Bauch + Oberschenkel (mm)
 *   Quelle: British Journal of Nutrition, 40, 497-504.
 *   Dichte = 1.10938 - 0.0008267*S + 0.0000016*S^2 - 0.0002574*Alter
 *
 * FRAUEN — Jackson, Pollock & Ward (1980), Sites: Trizeps + Suprailiac + Oberschenkel (mm)
 *   Quelle: Medicine & Science in Sports & Exercise, 12(3), 175-181.
 *   Dichte = 1.0994921 - 0.0009929*S + 0.0000023*S^2 - 0.0001392*Alter
 *
 * NICHT ohne Quelle ändern (siehe CLAUDE.md). Hinweis: bei sehr dicken Falten
 * (>40-50 mm) liegt man ggf. außerhalb des validierten Bereichs -> absoluter
 * Wert vorsichtig interpretieren, der Trend bleibt robust.
 *
 * DUAL-ENVIRONMENT (kein Build-Schritt): im Browser als window.GTBodyFat, in
 * Node per require() für die Tests. Siehe Export-Konstrukt am Dateiende.
 * ========================================================================== */
(function (global) {
  'use strict';

  // Siri-Umrechnung Dichte -> KFA %, auf 1 Nachkommastelle gerundet. Liefert
  // null bei unbrauchbarer Dichte (<= 0 würde negative/unsinnige Werte geben).
  function siri(dichte) {
    if (!(dichte > 0)) return null;
    return Math.round((495 / dichte - 450) * 10) / 10;
  }

  // Gemeinsame Eingabeprüfung: Summe und Alter müssen erfasst sein, Summe > 0.
  function gueltig(sumMM, age) {
    return sumMM != null && age != null && sumMM > 0;
  }

  /**
   * Männer-Protokoll (Brust/Bauch/Oberschenkel).
   * @param {number} sumMM Summe der drei Hautfalten in mm
   * @param {number} age   Alter in Jahren
   * @returns {number|null} KFA % (1 Nachkommastelle) oder null
   */
  function male(sumMM, age) {
    if (!gueltig(sumMM, age)) return null;
    const d = 1.10938 - 0.0008267 * sumMM + 0.0000016 * sumMM * sumMM - 0.0002574 * age;
    return siri(d);
  }

  /**
   * Frauen-Protokoll (Trizeps/Suprailiac/Oberschenkel).
   * @param {number} sumMM Summe der drei Hautfalten in mm
   * @param {number} age   Alter in Jahren
   * @returns {number|null} KFA % (1 Nachkommastelle) oder null
   */
  function female(sumMM, age) {
    if (!gueltig(sumMM, age)) return null;
    const d = 1.0994921 - 0.0009929 * sumMM + 0.0000023 * sumMM * sumMM - 0.0001392 * age;
    return siri(d);
  }

  /**
   * Wählt das Protokoll nach Geschlecht. 'female' -> Frauen-Formel, alles andere
   * (inkl. leer/unbekannt) -> Männer-Formel (Bestandsverhalten der App).
   * @param {string} sex   'male' | 'female'
   * @param {number} sumMM
   * @param {number} age
   * @returns {number|null}
   */
  function bySex(sex, sumMM, age) {
    return sex === 'female' ? female(sumMM, age) : male(sumMM, age);
  }

  /* ---- Öffentliche Schnittstelle in beiden Umgebungen ---- */
  const api = { male, female, bySex };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api; // Node (Tests)
  } else {
    global.GTBodyFat = api; // Browser (klassisches <script>)
  }
})(typeof window !== 'undefined' ? window : globalThis);
