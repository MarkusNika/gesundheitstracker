/* app.js — UI-Logik, Berechnung, Charts, Export
 * Abhängigkeiten: db.js (window.DB), Chart.js (global Chart, via CDN in index.html)
 */

/* ---------- Helfer ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}
function thisMonth() {
  return todayISO().slice(0, 7); // YYYY-MM
}
function num(v) {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function ageAt(dateISO, birthdate) {
  if (!birthdate) return null;
  const b = new Date(birthdate);
  const d = new Date(dateISO);
  let a = d.getFullYear() - b.getFullYear();
  const m = d.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && d.getDate() < b.getDate())) a--;
  return a;
}

/* ---------- Körperfett ----------
 * Die Formeln (Jackson-Pollock Männer 1978 / Frauen 1980, Siri-Umrechnung) liegen
 * im getesteten Modul bodyfat-core.js (window.GTBodyFat). Welches Protokoll gilt,
 * entscheidet das in den Einstellungen gewählte Geschlecht (cfg.sex) ->
 * GTBodyFat.bySex(sex, summe, alter).
 */

// Hautfalten-Beschriftung an das Protokoll anpassen. Die DB-Felder heißen aus
// Bestandsgründen chest_mm/abdomen_mm/thigh_mm; im Frauen-Protokoll stehen dort
// fachlich Trizeps/Suprailiac/Oberschenkel. Die App ist für EINE Person mit
// festem Protokoll, daher ist die Mehrfachnutzung derselben Felder unkritisch.
function applyProtocolLabels(sex) {
  const female = sex === 'female';
  $('#fold1-label').textContent = female ? 'Trizeps' : 'Brust';
  $('#fold2-label').textContent = female ? 'Suprailiac' : 'Bauch';
}

/* ---------- Navigation ---------- */
function showView(id) {
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === id));
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === id));
  if (id === 'view-verlauf') renderCharts();
  if (id === 'view-fotos') renderPhotos();
}

/* ---------- Tagesformular (Heute) ---------- */
async function loadDaily() {
  const date = $('#daily-date').value || todayISO();
  $('#daily-date').value = date;
  const cfg = await DB.getConfig();
  $('#medA-label').textContent = cfg.medA || 'Medikament A';
  $('#medB-label').textContent = cfg.medB || 'Medikament B';
  const rec = await DB.get('daily', date);
  // Blutdruck morgens (Bestandsfelder sys/dia/pulse) + abends (…_e)
  $('#sys').value = rec?.sys ?? '';
  $('#dia').value = rec?.dia ?? '';
  $('#pulse').value = rec?.pulse ?? '';
  $('#sys-e').value = rec?.sys_e ?? '';
  $('#dia-e').value = rec?.dia_e ?? '';
  $('#pulse-e').value = rec?.pulse_e ?? '';
  // Medikamente: Dosis (mg) + je zwei "genommen"-Checkboxen (morgens/abends)
  $('#medA').value = rec?.medA_mg ?? '';
  $('#medB').value = rec?.medB_mg ?? '';
  $('#medA-am').checked = !!rec?.medA_am;
  $('#medA-pm').checked = !!rec?.medA_pm;
  $('#medB-am').checked = !!rec?.medB_am;
  $('#medB-pm').checked = !!rec?.medB_pm;
  // Schritte & Befinden
  $('#steps').value = rec?.steps ?? '';
  $('#energy').value = rec?.energy ?? '';
  $('#libido').value = rec?.libido ?? '';
  $('#sleep').value = rec?.sleep_h ?? '';
  $('#food').value = rec?.food ?? '';
  $('#protocol').value = rec?.protocol ?? '';
}
async function saveDaily() {
  const date = $('#daily-date').value || todayISO();
  const rec = {
    date,
    // Blutdruck morgens (Bestandsfelder) + abends
    sys: num($('#sys').value),
    dia: num($('#dia').value),
    pulse: num($('#pulse').value),
    sys_e: num($('#sys-e').value),
    dia_e: num($('#dia-e').value),
    pulse_e: num($('#pulse-e').value),
    // Medikamente: Dosis + Einnahme-Checkboxen (true = genommen)
    medA_mg: num($('#medA').value),
    medB_mg: num($('#medB').value),
    medA_am: $('#medA-am').checked,
    medA_pm: $('#medA-pm').checked,
    medB_am: $('#medB-am').checked,
    medB_pm: $('#medB-pm').checked,
    // Schritte & Befinden
    steps: num($('#steps').value),
    energy: num($('#energy').value),
    libido: num($('#libido').value),
    sleep_h: num($('#sleep').value),
    food: $('#food').value.trim(),
    protocol: $('#protocol').value.trim(),
  };

  // Validierung: Fehler blockieren das Speichern, Hinweise (warnings) nicht.
  const check = GTValidate.validateDaily(rec);
  if (check.errors.length) {
    flash('#daily-status', '⚠ ' + check.errors.join(' '), 8000, 'error');
    return; // NICHT speichern
  }

  await DB.put('daily', rec);
  await renderDailyList(); // Liste mit dem neuen/aktualisierten Eintrag auffrischen
  // Bei Hinweisen wird trotzdem gespeichert, der Hinweis aber sichtbar gemacht.
  if (check.warnings.length) {
    flash('#daily-status', 'Gespeichert ✓ — Hinweis: ' + check.warnings.join(' '), 8000, 'warn');
  } else {
    flash('#daily-status', 'Gespeichert ✓');
  }
}

/* ---------- Wochenformular (Gewicht + Hautfalten) ---------- */
async function loadWeekly() {
  const date = $('#weekly-date').value || todayISO();
  $('#weekly-date').value = date;
  const rec = await DB.get('weekly', date);
  $('#weight').value = rec?.weight_kg ?? '';
  $('#chest').value = rec?.chest_mm ?? '';
  $('#abdomen').value = rec?.abdomen_mm ?? '';
  $('#thigh').value = rec?.thigh_mm ?? '';
  updateWeeklyPreview();
}
async function updateWeeklyPreview() {
  const cfg = await DB.getConfig();
  const date = $('#weekly-date').value || todayISO();
  const c = num($('#chest').value), a = num($('#abdomen').value), t = num($('#thigh').value);
  const age = ageAt(date, cfg.birthdate);
  if (c != null && a != null && t != null) {
    const sum = c + a + t;
    const bf = GTBodyFat.bySex(cfg.sex, sum, age);
    $('#weekly-preview').textContent =
      `Summe: ${sum} mm` + (age != null ? `, Alter: ${age}` : ', Alter: – (Geburtsdatum fehlt)') +
      (bf != null ? `, KFA: ${bf.toString().replace('.', ',')} %` : '');
  } else {
    $('#weekly-preview').textContent = 'KFA wird berechnet, sobald alle drei Falten erfasst sind.';
  }
}
async function saveWeekly() {
  const cfg = await DB.getConfig();
  const date = $('#weekly-date').value || todayISO();
  const c = num($('#chest').value), a = num($('#abdomen').value), t = num($('#thigh').value);
  const sum = c != null && a != null && t != null ? c + a + t : null;
  const age = ageAt(date, cfg.birthdate);
  const rec = {
    date,
    weight_kg: num($('#weight').value),
    chest_mm: c, abdomen_mm: a, thigh_mm: t,
    sum_mm: sum,
    age: age,
    bf_pct: sum != null ? GTBodyFat.bySex(cfg.sex, sum, age) : null,
  };

  // Validierung: Fehler blockieren, Hinweise (z. B. sehr dicke Falten) nicht.
  const check = GTValidate.validateWeekly(rec);
  if (check.errors.length) {
    flash('#weekly-status', '⚠ ' + check.errors.join(' '), 8000, 'error');
    return; // NICHT speichern
  }

  await DB.put('weekly', rec);
  await renderWeeklyList(); // Liste mit dem neuen/aktualisierten Eintrag auffrischen
  if (check.warnings.length) {
    flash('#weekly-status', 'Gespeichert ✓ — Hinweis: ' + check.warnings.join(' '), 9000, 'warn');
  } else {
    flash('#weekly-status', 'Gespeichert ✓');
  }
}

/* ---------- Listen vergangener Einträge ----------
 * Zeigt unter dem Tages- bzw. Wochenformular alle bisher gespeicherten
 * Datensätze (neueste zuerst). So kommt man an alte Einträge heran, ohne das
 * Datum von Hand zu erraten.
 *   - "Bearbeiten" (Klick auf die Zeile): lädt den Eintrag ins Formular darüber
 *     und scrollt nach oben — Speichern läuft dann über die bestehende Logik.
 *   - "Löschen": entfernt den Eintrag nach Rückfrage.
 * Reine Logik (Sortierung, Datumsformat, Kurz-Zusammenfassung) liegt in
 * entries-core.js (window.GTEntries) und ist dort automatisiert getestet.
 */
async function renderDailyList() {
  const rows = GTEntries.sortByDateDesc(await DB.getAll('daily'));
  renderEntryList($('#daily-list'), rows, GTEntries.summarizeDaily, 'daily');
}
async function renderWeeklyList() {
  const rows = GTEntries.sortByDateDesc(await DB.getAll('weekly'));
  renderEntryList($('#weekly-list'), rows, GTEntries.summarizeWeekly, 'weekly');
}

// Gemeinsame Darstellung der Listen. `kind` ('daily'|'weekly'|'training') steuert,
// welches Datumsfeld und welche Lade-Funktion beim Bearbeiten/Löschen benutzt werden.
// Bewusst über textContent statt innerHTML aufgebaut: die Trainings-Zusammenfassung
// enthält freien Übungstext -> so kann kein eingegebenes Markup ausgeführt werden.
function renderEntryList(box, rows, summarize, kind) {
  box.innerHTML = '';
  if (!rows.length) {
    box.innerHTML = '<li class="muted entry-empty">Noch keine Einträge.</li>';
    return;
  }
  for (const rec of rows) {
    const li = document.createElement('li');
    li.className = 'entry';

    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'entry-main';
    const datum = document.createElement('span');
    datum.className = 'entry-date';
    datum.textContent = GTEntries.formatDateDE(rec.date);
    const summe = document.createElement('span');
    summe.className = 'entry-sum';
    summe.textContent = summarize(rec);
    main.append(datum, summe);
    main.addEventListener('click', () => editEntry(kind, rec.date));

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'entry-del';
    del.textContent = 'löschen';
    del.addEventListener('click', () => deleteEntry(kind, rec.date));

    li.append(main, del);
    box.appendChild(li);
  }
}

async function editEntry(kind, date) {
  if (kind === 'daily') {
    $('#daily-date').value = date;
    await loadDaily();
  } else if (kind === 'weekly') {
    $('#weekly-date').value = date;
    await loadWeekly();
  } else if (kind === 'training') {
    $('#training-date').value = date;
    await loadTraining();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteEntry(kind, date) {
  const label = GTEntries.formatDateDE(date);
  if (!confirm(`Eintrag vom ${label} wirklich löschen? Das lässt sich nicht rückgängig machen.`)) return;
  await DB.remove(kind, date); // Store-Name == kind ('daily' / 'weekly' / 'training')
  // Liste neu zeichnen; war der gelöschte Datensatz gerade im Formular geladen,
  // Formular ebenfalls neu laden (zeigt dann leere Felder für dieses Datum).
  if (kind === 'daily') {
    await renderDailyList();
    if ($('#daily-date').value === date) await loadDaily();
  } else if (kind === 'weekly') {
    await renderWeeklyList();
    if ($('#weekly-date').value === date) await loadWeekly();
  } else if (kind === 'training') {
    await renderTrainingList();
    if ($('#training-date').value === date) await loadTraining();
  }
}

/* ---------- Training ----------
 * Ein Trainings-Datensatz pro Tag (Store 'training', keyPath 'date') hält eine
 * Liste von Übungen. Der Nutzer stellt die Übungsliste für einen Tag zusammen
 * (hinzufügen/entfernen) und speichert sie dann als Ganzes. Reine Logik
 * (formatExercise, summarizeSession, validateExercise, Presets) liegt im
 * getesteten Modul training-core.js (window.GTTraining).
 */
let trainingDraft = []; // Übungen des aktuell bearbeiteten Tages (vor dem Speichern)

async function loadTraining() {
  const date = $('#training-date').value || todayISO();
  $('#training-date').value = date;
  const rec = await DB.get('training', date);
  trainingDraft = rec && Array.isArray(rec.exercises) ? rec.exercises.slice() : [];
  $('#training-note').value = rec?.note ?? '';
  renderExerciseDraft();
}

// Zeigt die aktuell zusammengestellten Übungen (noch nicht zwingend gespeichert).
// Über textContent aufgebaut, weil der Übungsname freier Nutzertext ist.
function renderExerciseDraft() {
  const box = $('#training-exercises');
  box.innerHTML = '';
  if (!trainingDraft.length) {
    box.innerHTML = '<li class="muted entry-empty">Noch keine Übung hinzugefügt.</li>';
    return;
  }
  trainingDraft.forEach((ex, i) => {
    const li = document.createElement('li');
    li.className = 'ex-item';
    const span = document.createElement('span');
    span.textContent = GTTraining.formatExercise(ex);
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'entry-del';
    del.textContent = 'entfernen';
    del.addEventListener('click', () => { trainingDraft.splice(i, 1); renderExerciseDraft(); });
    li.append(span, del);
    box.appendChild(li);
  });
}

// Übung aus den Eingabefeldern zur Entwurfsliste hinzufügen (mit Validierung).
function addExercise() {
  const ex = {
    name: $('#ex-name').value.trim(),
    sets: num($('#ex-sets').value),
    reps: num($('#ex-reps').value),
    duration_min: num($('#ex-duration').value),
    difficulty: num($('#ex-difficulty').value),
  };
  const check = GTTraining.validateExercise(ex);
  if (check.errors.length) {
    flash('#ex-status', '⚠ ' + check.errors.join(' '), 6000, 'error');
    return; // NICHT hinzufügen
  }
  trainingDraft.push(ex);
  renderExerciseDraft();
  if (check.warnings.length) {
    flash('#ex-status', 'Hinzugefügt — Hinweis: ' + check.warnings.join(' '), 6000, 'warn');
  } else {
    flash('#ex-status', 'Hinzugefügt ✓');
  }
  // Eingabefelder leeren, Fokus zurück aufs Namensfeld für die nächste Übung.
  ['#ex-name', '#ex-sets', '#ex-reps', '#ex-duration', '#ex-difficulty'].forEach((s) => { $(s).value = ''; });
  $('#ex-name').focus();
}

async function saveTraining() {
  const date = $('#training-date').value || todayISO();
  const rec = { date, exercises: trainingDraft, note: $('#training-note').value.trim() };
  await DB.put('training', rec);
  await renderTrainingList();
  flash('#training-status', 'Gespeichert ✓');
}

async function renderTrainingList() {
  const rows = GTEntries.sortByDateDesc(await DB.getAll('training'));
  renderEntryList($('#training-list'), rows, GTTraining.summarizeSession, 'training');
}

/* ---------- Fotos (monatlich) ----------
 * Foto wird einem wählbaren Monat zugeordnet (#photo-month, Nachtragen möglich)
 * und vor dem Speichern verkleinert, damit die IndexedDB nicht von großen
 * Handy-Bildern volläuft. Reine Logik (Zielmaße, Monatsprüfung) in photo-core.js.
 */
const PHOTO_MAX_EDGE = 1280; // px — längste Kante nach dem Verkleinern
const PHOTO_QUALITY = 0.8;   // JPEG-Qualität (0..1)

// Verkleinert ein Bild über ein <canvas> und gibt es als JPEG-Blob zurück.
// Lässt sich das Bild nicht dekodieren (exotisches Format) oder liefert toBlob
// nichts, wird die Originaldatei unverändert zurückgegeben — lieber groß
// speichern als das Foto zu verlieren.
function compressImage(file, maxEdge, quality) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const { width, height } = GTPhoto.computeResize(img.naturalWidth, img.naturalHeight, maxEdge);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

async function addPhoto(file) {
  if (!file) return;
  // Monat aus dem Eingabefeld; bei leer/ungültig auf den aktuellen Monat zurückfallen.
  let month = $('#photo-month').value;
  if (!GTPhoto.isValidMonth(month)) month = thisMonth();
  const blob = await compressImage(file, PHOTO_MAX_EDGE, PHOTO_QUALITY);
  await DB.put('photos', { month, blob, created: Date.now() });
  renderPhotos();
}
async function renderPhotos() {
  const box = $('#photo-list');
  box.innerHTML = '';
  const photos = (await DB.getAll('photos')).sort((a, b) => b.created - a.created);
  if (!photos.length) { box.innerHTML = '<p class="muted">Noch keine Fotos.</p>'; return; }
  for (const p of photos) {
    const url = URL.createObjectURL(p.blob);
    const fig = document.createElement('figure');
    fig.innerHTML = `<img src="${url}" alt="Foto ${p.month}"><figcaption>${p.month}` +
      `<button data-id="${p.id}" class="del-photo">löschen</button></figcaption>`;
    box.appendChild(fig);
  }
  $$('.del-photo').forEach((b) =>
    b.addEventListener('click', async () => { await DB.remove('photos', Number(b.dataset.id)); renderPhotos(); }));
}

/* ---------- Charts ---------- */
let charts = {};
function makeChart(canvasId, datasets, labels) {
  if (charts[canvasId]) charts[canvasId].destroy();
  charts[canvasId] = new Chart($('#' + canvasId), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      scales: { x: { ticks: { maxRotation: 0, autoSkip: true } } },
    },
  });
}
// Aktuell gewählter Zeitraum in Wochen (0 = alles). Liest das Auswahlfeld aus.
function selectedRangeWeeks() {
  const sel = $('#range-select');
  const v = sel ? Number(sel.value) : 0;
  return Number.isFinite(v) ? v : 0;
}
async function renderCharts() {
  // Zeitraumfilter: Stichtag aus "heute minus N Wochen"; 0/null -> alles.
  const cutoff = GTRange.cutoffISO(todayISO(), selectedRangeWeeks());
  const daily = GTRange.filterByRange(await DB.getAll('daily'), cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));
  const weekly = GTRange.filterByRange(await DB.getAll('weekly'), cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Blutdruck: morgens durchgezogen, abends gestrichelt (gleiche Farbe je Größe).
  // Einzelne Linien lassen sich über die Chart.js-Legende ein-/ausblenden.
  const bpLabels = daily.map((d) => d.date);
  const dash = [5, 4];
  makeChart('chart-bp', [
    { label: 'Sys morgens', data: daily.map((d) => d.sys), borderColor: '#dc2626', tension: 0.2, spanGaps: true },
    { label: 'Sys abends', data: daily.map((d) => d.sys_e), borderColor: '#dc2626', borderDash: dash, tension: 0.2, spanGaps: true },
    { label: 'Dia morgens', data: daily.map((d) => d.dia), borderColor: '#2563eb', tension: 0.2, spanGaps: true },
    { label: 'Dia abends', data: daily.map((d) => d.dia_e), borderColor: '#2563eb', borderDash: dash, tension: 0.2, spanGaps: true },
    { label: 'Puls morgens', data: daily.map((d) => d.pulse), borderColor: '#16a34a', tension: 0.2, spanGaps: true },
    { label: 'Puls abends', data: daily.map((d) => d.pulse_e), borderColor: '#16a34a', borderDash: dash, tension: 0.2, spanGaps: true },
  ], bpLabels);

  // Gewicht
  const wLabels = weekly.map((d) => d.date);
  makeChart('chart-weight', [
    { label: 'Gewicht (kg)', data: weekly.map((d) => d.weight_kg), borderColor: '#7c3aed', tension: 0.2, spanGaps: true },
  ], wLabels);

  // KFA
  makeChart('chart-bf', [
    { label: 'Körperfett (%)', data: weekly.map((d) => d.bf_pct), borderColor: '#ea580c', tension: 0.2, spanGaps: true },
  ], wLabels);
}

/* ---------- Export ---------- */
const SEP = ';'; // deutsches Excel-Format
function deNum(v) { return v == null ? '' : String(v).replace('.', ','); }
// Boolean fürs Arzt-CSV: 'ja'/'nein'; leer, wenn nie erfasst (z. B. Altdaten).
function jaNein(v) { return v == null ? '' : (v ? 'ja' : 'nein'); }
function download(filename, text, mime) {
  const blob = new Blob(['\uFEFF' + text], { type: (mime || 'text/csv') + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
}
async function exportBP() {
  const rows = (await DB.getAll('daily')).sort((a, b) => a.date.localeCompare(b.date));
  const cfg = await DB.getConfig();
  const mA = cfg.medA || 'MedA';
  const mB = cfg.medB || 'MedB';
  const head = [
    'Datum',
    'Sys_morgens', 'Dia_morgens', 'Puls_morgens',
    'Sys_abends', 'Dia_abends', 'Puls_abends',
    'Schritte',
    `Dosis_${mA}_mg`, `${mA}_morgens`, `${mA}_abends`,
    `Dosis_${mB}_mg`, `${mB}_morgens`, `${mB}_abends`,
  ];
  const lines = [head.join(SEP)];
  for (const r of rows)
    lines.push([
      r.date,
      deNum(r.sys), deNum(r.dia), deNum(r.pulse),
      deNum(r.sys_e), deNum(r.dia_e), deNum(r.pulse_e),
      deNum(r.steps),
      deNum(r.medA_mg), jaNein(r.medA_am), jaNein(r.medA_pm),
      deNum(r.medB_mg), jaNein(r.medB_am), jaNein(r.medB_pm),
    ].join(SEP));
  download(`blutdruck_${todayISO()}.csv`, lines.join('\r\n'));
}
async function exportBodyComp() {
  const rows = (await DB.getAll('weekly')).sort((a, b) => a.date.localeCompare(b.date));
  // Site-Spalten passend zum Protokoll benennen, damit der Arzt sie richtig liest.
  const cfg = await DB.getConfig();
  const female = cfg.sex === 'female';
  const s1 = female ? 'Trizeps_mm' : 'Brust_mm';
  const s2 = female ? 'Suprailiac_mm' : 'Bauch_mm';
  const head = ['Datum', 'Gewicht_kg', s1, s2, 'Oberschenkel_mm', 'Summe_mm', 'Alter', 'KFA_Prozent'];
  const lines = [head.join(SEP)];
  for (const r of rows)
    lines.push([r.date, deNum(r.weight_kg), deNum(r.chest_mm), deNum(r.abdomen_mm), deNum(r.thigh_mm),
      deNum(r.sum_mm), deNum(r.age), deNum(r.bf_pct)].join(SEP));
  download(`koerperfett_gewicht_${todayISO()}.csv`, lines.join('\r\n'));
}
async function exportBackup() {
  const daily = await DB.getAll('daily');
  const weekly = await DB.getAll('weekly');
  const settings = await DB.getAll('settings');
  const training = await DB.getAll('training');
  const photosRaw = await DB.getAll('photos');
  const photos = [];
  for (const p of photosRaw) {
    const b64 = await blobToBase64(p.blob);
    photos.push({ id: p.id, month: p.month, created: p.created, type: p.blob.type, data: b64 });
  }
  const dump = { version: 1, exportedAt: new Date().toISOString(), daily, weekly, settings, photos, training };
  download(`backup_${todayISO()}.json`, JSON.stringify(dump, null, 2), 'application/json');
}
function blobToBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

/* ---------- Import / Wiederherstellen ----------
 * Gegenstück zu exportBackup(). Liest eine backup_*.json und schreibt sie in
 * die IndexedDB. Die reine Logik (Validierung, Base64->Blob, Foto-Dedup) liegt
 * in import-core.js (window.GTImport) und ist dort automatisiert getestet.
 *
 * Zwei Modi (per Radio-Button im Export-Screen gewählt):
 *   'merge'   - vorhandene Daten bleiben; gleiche Datums-Keys werden überschrieben.
 *   'replace' - Stores werden vorher geleert; exakte 1:1-Wiederherstellung.
 */
async function importBackup(file) {
  const mode = (document.querySelector('input[name="import-mode"]:checked') || {}).value || 'merge';

  // 1) Datei einlesen + parsen. Fehler hier -> klarer Abbruch, NICHTS wird geschrieben.
  let obj;
  try {
    const text = await file.text();
    obj = JSON.parse(text);
  } catch (e) {
    flash('#import-status', 'Fehler: Datei ist kein gültiges JSON.');
    return;
  }

  // 2) Struktur prüfen. Bei Problemen abbrechen, bevor irgendetwas geschrieben wird.
  const check = GTImport.validateBackup(obj);
  if (!check.ok) {
    flash('#import-status', 'Ungültiges Backup: ' + check.errors.join(' '), 6000);
    return;
  }

  // 3) Sicherheitsabfrage beim destruktiven Modus.
  if (mode === 'replace') {
    const ok = confirm(
      'Modus "Komplett ersetzen": Alle aktuell gespeicherten Daten auf diesem ' +
      'Gerät werden gelöscht und durch das Backup ersetzt. Fortfahren?'
    );
    if (!ok) { flash('#import-status', 'Abgebrochen.'); return; }

    // Reihenfolge egal; jeder Store wird komplett geleert (inkl. optionaler Stores).
    for (const store of GTImport.STORES) await DB.clear(store);
    for (const store of GTImport.OPTIONAL_STORES) await DB.clear(store);
  }

  // 4) Datensätze schreiben. daily/weekly/settings haben feste keyPaths
  //    ('date' bzw. 'key') -> put() überschreibt gleiche Schlüssel von selbst.
  for (const rec of obj.daily) await DB.put('daily', rec);
  for (const rec of obj.weekly) await DB.put('weekly', rec);
  for (const rec of obj.settings) await DB.put('settings', rec);
  // Training: optionaler Store, kann in älteren Backups fehlen (dann leeres Array).
  for (const rec of (obj.training || [])) await DB.put('training', rec);

  // 5) Fotos gesondert: Base64 -> Blob, und Duplikate (month+created) überspringen.
  //    Im 'replace'-Modus sind die Stores leer -> nichts gilt als Duplikat.
  const existing = await DB.getAll('photos');
  const { toAdd, skipped } = GTImport.partitionPhotos(existing, obj.photos);
  for (const p of toAdd) {
    const blob = GTImport.base64ToBlob(p.data, p.type);
    // id NICHT übernehmen: 'photos' nutzt autoIncrement, sonst Kollisionsgefahr.
    await DB.put('photos', { month: p.month, blob, created: p.created });
  }

  // 6) Sichtbare Views neu laden, damit die importierten Daten sofort erscheinen.
  await loadSettings();
  await loadDaily();
  await loadWeekly();
  await loadTraining();
  await renderDailyList();
  await renderWeeklyList();
  await renderTrainingList();

  const skipHinweis = skipped > 0 ? `, ${skipped} Foto(s) übersprungen` : '';
  const trainingN = (obj.training || []).length;
  flash(
    '#import-status',
    `Wiederhergestellt: ${obj.daily.length} Tage, ${obj.weekly.length} Wochen, ` +
    `${trainingN} Training(s), ${toAdd.length} Foto(s)${skipHinweis} ✓`,
    6000
  );
}

/* ---------- Einstellungen ---------- */
async function loadSettings() {
  const cfg = await DB.getConfig();
  $('#set-sex').value = cfg.sex || 'male';
  $('#set-birthdate').value = cfg.birthdate || '';
  $('#set-medA').value = cfg.medA || '';
  $('#set-medB').value = cfg.medB || '';
  applyProtocolLabels(cfg.sex); // Hautfalten-Beschriftung passend zum Protokoll
}
async function saveSettings() {
  const cfg = {
    sex: $('#set-sex').value,
    birthdate: $('#set-birthdate').value,
    medA: $('#set-medA').value.trim() || 'Medikament A',
    medB: $('#set-medB').value.trim() || 'Medikament B',
  };

  // Validierung: Geburtsdatum darf nicht in der Zukunft liegen (würde Alter/KFA verfälschen).
  const check = GTValidate.validateConfig(cfg, todayISO());
  if (check.errors.length) {
    flash('#set-status', '⚠ ' + check.errors.join(' '), 8000, 'error');
    return; // NICHT speichern
  }

  await DB.saveConfig(cfg);
  flash('#set-status', 'Gespeichert ✓');
  applyProtocolLabels(cfg.sex); // geänderte Protokoll-Beschriftung sofort übernehmen
  updateWeeklyPreview();        // KFA-Vorschau mit der jetzt gültigen Formel neu rechnen
  loadDaily();
}

/* ---------- UI-Kleinkram ---------- */
/* Statusmeldung kurz anzeigen.
 * type: 'ok' (grün, Standard) | 'warn' (gelb) | 'error' (rot) -> setzt CSS-Klasse.
 * ms:   Anzeigedauer; 0 = dauerhaft stehen lassen (bis zur nächsten Meldung). */
function flash(sel, msg, ms, type) {
  const el = $(sel);
  el.textContent = msg;
  el.className = 'status' + (type && type !== 'ok' ? ' ' + type : '');
  if (ms !== 0) {
    const dauer = ms || 2000;
    setTimeout(() => { el.textContent = ''; el.className = 'status'; }, dauer);
  }
}

/* ---------- Init ---------- */
async function init() {
  // Persistenten Speicher anfragen (verhindert ungewolltes Löschen)
  if (navigator.storage && navigator.storage.persist) {
    try { await navigator.storage.persist(); } catch (e) {}
  }
  // Service Worker
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('sw.js'); } catch (e) {}
  }

  $$('.tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));

  $('#daily-date').value = todayISO();
  $('#weekly-date').value = todayISO();
  $('#photo-month').value = GTPhoto.defaultPhotoMonth(todayISO());
  $('#training-date').value = todayISO();
  // Übungs-Vorschläge (Presets) in die datalist des Namensfeldes einhängen.
  const preDl = $('#ex-presets');
  GTTraining.PRESET_EXERCISES.forEach((n) => { const o = document.createElement('option'); o.value = n; preDl.appendChild(o); });
  await loadSettings();
  await loadDaily();
  await loadWeekly();
  await loadTraining();
  await renderDailyList();
  await renderWeeklyList();
  await renderTrainingList();

  $('#daily-date').addEventListener('change', loadDaily);
  $('#save-daily').addEventListener('click', saveDaily);

  $('#weekly-date').addEventListener('change', loadWeekly);
  $('#save-weekly').addEventListener('click', saveWeekly);
  ['#chest', '#abdomen', '#thigh'].forEach((s) => $(s).addEventListener('input', updateWeeklyPreview));

  $('#photo-input').addEventListener('change', (e) => addPhoto(e.target.files[0]));

  // Training: Datumswechsel lädt den Tag, Buttons für Übung-Hinzufügen/Speichern.
  $('#training-date').addEventListener('change', loadTraining);
  $('#add-exercise').addEventListener('click', addExercise);
  $('#save-training').addEventListener('click', saveTraining);

  // Zeitraumfilter der Charts: bei Auswahländerung neu zeichnen.
  $('#range-select').addEventListener('change', renderCharts);

  $('#export-bp').addEventListener('click', exportBP);
  $('#export-body').addEventListener('click', exportBodyComp);
  $('#export-backup').addEventListener('click', exportBackup);

  // Backup-Import: nach Auswahl einer Datei importieren, dann input zurücksetzen,
  // damit dieselbe Datei bei Bedarf erneut gewählt werden kann (change feuert sonst nicht).
  $('#import-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) await importBackup(file);
    e.target.value = '';
  });

  $('#save-settings').addEventListener('click', saveSettings);

  showView('view-heute');
}
document.addEventListener('DOMContentLoaded', init);
