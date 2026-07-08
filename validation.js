/* validation.js — Eingabe-Validierung & Plausi-Hinweise
 * ==========================================================================
 * GRUNDSATZ (siehe CLAUDE.md): Diese App gibt KEINE medizinischen Bewertungen
 * und KEINE Zielwerte. Hier wird ausschließlich die *Dateneingabe* geprüft:
 *
 *   - errors[]   : blockieren das Speichern. Nur logisch unmögliche oder sicher
 *                  falsche Eingaben (z. B. sys <= dia, negatives Gewicht,
 *                  Geburtsdatum in der Zukunft).
 *   - warnings[] : blockieren NICHT. Reine Hinweise bei Tippfehler-Verdacht
 *                  (Wert weit außerhalb eines plausiblen Bandes) oder der
 *                  methodische Hinweis bei sehr dicken Hautfalten.
 *
 * Die Plausi-Bänder unten sind BEWUSST WEIT gewählt — sie fangen Tippfehler ab
 * (z. B. "1200" statt "120"), sind aber KEINE medizinischen Schwellen. Wer sie
 * anpasst, ändert nur die Tippfehler-Erkennung, nicht irgendeine Bewertung.
 *
 * Eingaben sind bereits geparst (Zahl oder null). null bedeutet "nicht erfasst"
 * -> für dieses Feld wird nichts geprüft (Teil-Einträge sind ausdrücklich erlaubt).
 *
 * DUAL-ENVIRONMENT (kein Build-Schritt): im Browser als window.GTValidate, in
 * Node per require() für die Tests. Siehe Export-Konstrukt am Dateiende.
 * ========================================================================== */
(function (global) {
  'use strict';

  /* Plausi-Bänder [min, max] — Tippfehler-Schutz, KEINE medizinischen Grenzen.
   * Werte innerhalb gelten als "normal eingegeben", außerhalb -> Warnung. */
  const BANDS = {
    sys: [50, 300],      // mmHg
    dia: [30, 200],      // mmHg
    pulse: [20, 250],    // Schläge/min
    med_mg: [0, 5000],   // mg je Dosis
    weight_kg: [20, 400],// kg
    fold_mm: [2, 100],   // mm je Hautfalte
    steps: [0, 60000],   // Schritte/Tag (0 erlaubt; darüber Tippfehler-Verdacht)
  };

  // Plausibles Band für Schlafdauer in Stunden. Außerhalb -> nur Hinweis
  // (sehr kurz/lang ist ungewöhnlich, aber nicht unmöglich). 0..24 h ist die
  // harte Grenze (siehe validateDaily).
  const SLEEP_BAND = [3, 14]; // Stunden

  // Schwelle, ab der eine einzelne Hautfalte als "sehr dick" gilt. Laut CLAUDE.md
  // liegt man bei >40-50 mm ggf. außerhalb des validierten Jackson-Pollock-Bereichs.
  const FOLD_VALIDATED_MAX = 40; // mm

  /* ---------- kleine Helfer ---------- */
  const erfasst = (x) => x !== null && x !== undefined; // wurde ein Wert eingegeben?

  // Prüft ein einzelnes Messfeld auf "muss positiv sein" (Fehler) und
  // "innerhalb des Plausi-Bandes" (sonst Warnung). Schreibt in errors/warnings.
  function pruefeMesswert(wert, band, label, errors, warnings) {
    if (!erfasst(wert)) return;
    if (wert <= 0) {
      errors.push(`${label}: muss größer als 0 sein.`);
      return; // weitere Bandprüfung sinnlos
    }
    if (wert < band[0] || wert > band[1]) {
      warnings.push(`${label}: ${zahl(wert)} wirkt unplausibel — bitte auf Tippfehler prüfen.`);
    }
  }

  // Zahl mit Dezimalkomma anzeigen (deutsche Schreibweise), passend zur App.
  function zahl(n) { return String(n).replace('.', ','); }

  /**
   * Validiert einen Tages-Datensatz (Heute-Screen).
   * @param {{sys, dia, pulse, medA_mg, medB_mg}} rec  Werte als Zahl oder null.
   * @returns {{errors: string[], warnings: string[]}}
   */
  function validateDaily(rec) {
    rec = rec || {};
    const errors = [];
    const warnings = [];

    pruefeMesswert(rec.sys, BANDS.sys, 'Systolisch', errors, warnings);
    pruefeMesswert(rec.dia, BANDS.dia, 'Diastolisch', errors, warnings);
    pruefeMesswert(rec.pulse, BANDS.pulse, 'Puls', errors, warnings);

    // Logik-Check: systolisch muss über diastolisch liegen. Gleich/kleiner deutet
    // auf vertauschte Felder oder Tippfehler hin -> harter Fehler.
    if (erfasst(rec.sys) && erfasst(rec.dia) && rec.sys <= rec.dia) {
      errors.push('Systolisch muss größer als diastolisch sein (Werte evtl. vertauscht).');
    }

    // Medikamenten-Dosen: 0 ist erlaubt (Dosis ausgelassen), negativ nicht.
    for (const [feld, label] of [['medA_mg', 'Dosis Med A'], ['medB_mg', 'Dosis Med B']]) {
      const w = rec[feld];
      if (!erfasst(w)) continue;
      if (w < 0) {
        errors.push(`${label}: darf nicht negativ sein.`);
      } else if (w < BANDS.med_mg[0] || w > BANDS.med_mg[1]) {
        warnings.push(`${label}: ${zahl(w)} mg wirkt unplausibel — bitte auf Tippfehler prüfen.`);
      }
    }

    // Abend-Blutdruck: gleiche Regeln wie morgens (Felder mit Suffix _e).
    pruefeMesswert(rec.sys_e, BANDS.sys, 'Systolisch (abends)', errors, warnings);
    pruefeMesswert(rec.dia_e, BANDS.dia, 'Diastolisch (abends)', errors, warnings);
    pruefeMesswert(rec.pulse_e, BANDS.pulse, 'Puls (abends)', errors, warnings);
    if (erfasst(rec.sys_e) && erfasst(rec.dia_e) && rec.sys_e <= rec.dia_e) {
      errors.push('Systolisch (abends) muss größer als diastolisch sein (Werte evtl. vertauscht).');
    }

    // Schritte: 0 ist erlaubt (Ruhetag), negativ nicht; sehr hoch -> Tippfehler-Hinweis.
    if (erfasst(rec.steps)) {
      if (rec.steps < 0) {
        errors.push('Schritte: dürfen nicht negativ sein.');
      } else if (rec.steps > BANDS.steps[1]) {
        warnings.push(`Schritte: ${zahl(rec.steps)} wirkt unplausibel — bitte auf Tippfehler prüfen.`);
      }
    }

    // Befinden Energie & Libido: subjektive Skala, ganze Zahl von 1 bis 10.
    for (const [feld, label] of [['energy', 'Energie'], ['libido', 'Libido']]) {
      const w = rec[feld];
      if (!erfasst(w)) continue;
      if (!Number.isInteger(w) || w < 1 || w > 10) {
        errors.push(`${label}: bitte einen ganzen Wert von 1 bis 10 angeben.`);
      }
    }

    // Schlafdauer in Stunden: 0..24 ist die harte Grenze, außerhalb 3..14 nur Hinweis.
    if (erfasst(rec.sleep_h)) {
      if (rec.sleep_h < 0 || rec.sleep_h > 24) {
        errors.push('Schlaf: bitte eine Dauer zwischen 0 und 24 Stunden angeben.');
      } else if (rec.sleep_h < SLEEP_BAND[0] || rec.sleep_h > SLEEP_BAND[1]) {
        warnings.push(`Schlaf: ${zahl(rec.sleep_h)} h wirkt ungewöhnlich — bitte prüfen.`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Validiert einen Wochen-Datensatz (Gewicht + Hautfalten).
   * @param {{weight_kg, chest_mm, abdomen_mm, thigh_mm}} rec  Zahl oder null.
   * @returns {{errors: string[], warnings: string[]}}
   */
  function validateWeekly(rec) {
    rec = rec || {};
    const errors = [];
    const warnings = [];

    pruefeMesswert(rec.weight_kg, BANDS.weight_kg, 'Gewicht', errors, warnings);

    const falten = [['chest_mm', 'Brust'], ['abdomen_mm', 'Bauch'], ['thigh_mm', 'Oberschenkel']];
    for (const [feld, label] of falten) {
      pruefeMesswert(rec[feld], BANDS.fold_mm, `Hautfalte ${label}`, errors, warnings);

      // Methodischer Hinweis (kein Fehler): sehr dicke Falte -> ggf. außerhalb des
      // validierten Bereichs. Wortlaut bewusst nah an CLAUDE.md (Trend bleibt robust).
      const w = rec[feld];
      if (erfasst(w) && w > FOLD_VALIDATED_MAX && w <= BANDS.fold_mm[1]) {
        warnings.push(
          `Hautfalte ${label}: ${zahl(w)} mm liegt evtl. außerhalb des validierten ` +
          `Bereichs — der absolute KFA ist mit Vorsicht zu lesen, der Trend bleibt aussagekräftig.`
        );
      }
    }

    return { errors, warnings };
  }

  /**
   * Validiert die Einstellungen (nur das datums-relevante Geburtsdatum).
   * @param {{birthdate: string}} cfg  birthdate als 'YYYY-MM-DD' oder ''.
   * @param {string} todayISO  heutiges Datum 'YYYY-MM-DD' (injiziert -> testbar).
   * @returns {{errors: string[], warnings: string[]}}
   */
  function validateConfig(cfg, todayISO) {
    cfg = cfg || {};
    const errors = [];
    const warnings = [];

    if (cfg.birthdate) {
      // Stringvergleich reicht bei ISO-Datumsformat (YYYY-MM-DD ist lexikografisch sortierbar).
      if (cfg.birthdate > todayISO) {
        errors.push('Geburtsdatum darf nicht in der Zukunft liegen.');
      }
    }

    // Standard-Dosis je Medikament (Vorbelegung fürs Tagesformular): 0 erlaubt,
    // negativ nicht; sehr hoch -> nur Tippfehler-Hinweis. null/leer = nicht gesetzt.
    for (const [feld, label] of [['medA_dose', 'Standard-Dosis Med A'], ['medB_dose', 'Standard-Dosis Med B']]) {
      const w = cfg[feld];
      if (!erfasst(w)) continue;
      if (w < 0) {
        errors.push(`${label}: darf nicht negativ sein.`);
      } else if (w < BANDS.med_mg[0] || w > BANDS.med_mg[1]) {
        warnings.push(`${label}: ${zahl(w)} mg wirkt unplausibel — bitte auf Tippfehler prüfen.`);
      }
    }

    return { errors, warnings };
  }

  /* ---- Öffentliche Schnittstelle in beiden Umgebungen ---- */
  const api = { validateDaily, validateWeekly, validateConfig, BANDS, FOLD_VALIDATED_MAX };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api; // Node (Tests)
  } else {
    global.GTValidate = api; // Browser (klassisches <script>)
  }
})(typeof window !== 'undefined' ? window : globalThis);
