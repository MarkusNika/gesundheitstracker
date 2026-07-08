/* training-core.js — reine Logik für das Trainings-Log
 * ==========================================================================
 * Ein Trainings-Eintrag pro Tag hält eine Liste von Übungen. Damit lässt sich
 * die progressive Steigerung (mehr Sätze/Wdh./Dauer/Schwierigkeit) über die Zeit
 * dokumentieren.
 *
 * Datensatz-Form (Store 'training', keyPath 'date'):
 *   { date: 'YYYY-MM-DD',
 *     exercises: [ { name, sets, reps, duration_min, difficulty } ],
 *     note: '' }
 *
 * Hier liegt nur die DOM-freie, testbare Logik:
 *   - PRESET_EXERCISES : die drei Standard-Heimübungen als Startauswahl
 *   - formatExercise   : eine Übung als kurze Anzeigezeile
 *   - summarizeSession : Kurzfassung eines Tages (für die "Bisherige Trainings"-Liste)
 *   - validateExercise : Plausibilität einer einzelnen Übung
 *
 * DUAL-ENVIRONMENT (kein Build-Schritt): im Browser als window.GTTraining, in
 * Node per require() für die Tests. Siehe Export-Konstrukt am Dateiende.
 * ========================================================================== */
(function (global) {
  'use strict';

  // Die drei Heimübungen des Nutzers als Vorbelegung (frei erweiterbar im UI).
  // `type` steuert die Erfassungsart:
  //   'hold' = Halteübung (Haltezeit in Minuten wichtig)
  //   'reps' = Wiederholungsübung (Sätze × Wiederholungen)
  // Optionale Felder (z. B. duration_min) sind Startziele, die beim Auswählen der
  // Übung ins Formular vorgeschlagen werden. Für die Wiederholungsübungen sind
  // KEINE Zahlen hinterlegt (keine erfundenen Zielwerte) — der Nutzer trägt sie ein.
  const PRESET_EXERCISES = [
    { name: 'Umarmung des großen Baums', type: 'hold', duration_min: 5 }, // Startziel 5 min
    { name: 'Rückenheben aus Bauchlage', type: 'reps' },
    { name: 'Beine heben aus Rückenlage', type: 'reps' },
  ];

  /**
   * Sucht ein Preset per Name (Groß/Klein und Randleerzeichen egal).
   * @param {string} name
   * @returns {object|null} das Preset-Objekt oder null
   */
  function findPreset(name) {
    if (!name || typeof name !== 'string') return null;
    const key = name.trim().toLowerCase();
    if (!key) return null;
    return PRESET_EXERCISES.find((p) => p.name.toLowerCase() === key) || null;
  }

  /* ---------- kleine Helfer ---------- */
  const erfasst = (x) => x !== null && x !== undefined && x !== '';
  const zahl = (n) => String(n).replace('.', ','); // deutsches Dezimalkomma

  /**
   * Formatiert eine Übung als kurze Zeile, z. B. "Rückenheben: 3×12, Stufe 6".
   * Nur vorhandene Angaben erscheinen. Ohne Zahlen wird nur der Name gezeigt.
   * @param {object} ex { name, sets, reps, duration_min, difficulty }
   * @returns {string}
   */
  function formatExercise(ex) {
    ex = ex || {};
    const parts = [];
    if (erfasst(ex.sets) && erfasst(ex.reps)) parts.push(`${ex.sets}×${ex.reps}`);
    else if (erfasst(ex.reps)) parts.push(`${ex.reps} Wdh.`);
    else if (erfasst(ex.sets)) parts.push(`${ex.sets} Sätze`);
    if (erfasst(ex.duration_min)) parts.push(`${zahl(ex.duration_min)} min`);
    if (erfasst(ex.difficulty)) parts.push(`Stufe ${ex.difficulty}`);
    const name = (ex.name && String(ex.name).trim()) || 'Übung';
    return parts.length ? `${name}: ${parts.join(', ')}` : name;
  }

  /**
   * Kurzfassung eines Trainingstages für die Liste: Anzahl + Übungsnamen.
   * @param {object} rec { exercises: [...] }
   * @returns {string}
   */
  function summarizeSession(rec) {
    const list = (rec && rec.exercises) || [];
    if (!list.length) return '(kein Training)';
    const namen = list.map((e) => (e && e.name && String(e.name).trim()) || 'Übung');
    return `${list.length} ${list.length === 1 ? 'Übung' : 'Übungen'}: ${namen.join(', ')}`;
  }

  /**
   * Validiert eine einzelne Übung. Name ist Pflicht; Zahlen sind optional, müssen
   * aber sinnvoll sein (positiv, ganze Sätze/Wdh., Schwierigkeit 1..10). Sehr hohe
   * Werte blockieren nicht, sondern warnen nur (Tippfehler-Verdacht).
   * @param {object} ex
   * @returns {{errors: string[], warnings: string[]}}
   */
  function validateExercise(ex) {
    ex = ex || {};
    const errors = [];
    const warnings = [];

    if (!ex.name || !String(ex.name).trim()) {
      errors.push('Übung: bitte einen Namen angeben.');
    }

    // Ganzzahlige, positive Angaben mit oberer Plausi-Grenze.
    for (const [feld, label, max] of [['sets', 'Sätze', 50], ['reps', 'Wiederholungen', 1000]]) {
      const w = ex[feld];
      if (!erfasst(w)) continue;
      if (!Number.isInteger(w) || w <= 0) errors.push(`${label}: bitte eine ganze Zahl größer 0 angeben.`);
      else if (w > max) warnings.push(`${label}: ${w} wirkt unplausibel — bitte prüfen.`);
    }

    // Dauer in Minuten: positiv (Dezimal erlaubt), sehr lang -> Hinweis.
    if (erfasst(ex.duration_min)) {
      if (!(ex.duration_min > 0)) errors.push('Dauer: bitte eine Minutenzahl größer 0 angeben.');
      else if (ex.duration_min > 600) warnings.push(`Dauer: ${zahl(ex.duration_min)} min wirkt unplausibel — bitte prüfen.`);
    }

    // Schwierigkeit: subjektive Skala, ganze Zahl 1..10.
    if (erfasst(ex.difficulty)) {
      if (!Number.isInteger(ex.difficulty) || ex.difficulty < 1 || ex.difficulty > 10) {
        errors.push('Schwierigkeit: bitte einen ganzen Wert von 1 bis 10 angeben.');
      }
    }

    return { errors, warnings };
  }

  /* ---- Öffentliche Schnittstelle in beiden Umgebungen ---- */
  const api = { PRESET_EXERCISES, findPreset, formatExercise, summarizeSession, validateExercise };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api; // Node (Tests)
  } else {
    global.GTTraining = api; // Browser (klassisches <script>)
  }
})(typeof window !== 'undefined' ? window : globalThis);
