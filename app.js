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

/* ---------- Körperfett: Jackson-Pollock 3-Punkt (Männer) ----------
 * Sites: Brust + Bauch + Oberschenkel (mm)
 * Quelle: Jackson & Pollock (1978). British Journal of Nutrition, 40, 497-504.
 * Körperdichte = 1.10938 - 0.0008267*S + 0.0000016*S^2 - 0.0002574*Alter
 * Körperfett % (Siri) = (495 / Dichte) - 450
 * Hinweis: Bei sehr dicken Falten (>40-50 mm) liegt man ggf. außerhalb des
 * validierten Bereichs -> absoluter Wert vorsichtig interpretieren, Trend ist robust.
 */
function bodyFatMale(sumMM, age) {
  if (sumMM == null || age == null || sumMM <= 0) return null;
  const d = 1.10938 - 0.0008267 * sumMM + 0.0000016 * sumMM * sumMM - 0.0002574 * age;
  if (d <= 0) return null;
  const bf = 495 / d - 450;
  return Math.round(bf * 10) / 10;
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
  $('#sys').value = rec?.sys ?? '';
  $('#dia').value = rec?.dia ?? '';
  $('#pulse').value = rec?.pulse ?? '';
  $('#medA').value = rec?.medA_mg ?? '';
  $('#medB').value = rec?.medB_mg ?? '';
  $('#food').value = rec?.food ?? '';
  $('#protocol').value = rec?.protocol ?? '';
}
async function saveDaily() {
  const date = $('#daily-date').value || todayISO();
  const rec = {
    date,
    sys: num($('#sys').value),
    dia: num($('#dia').value),
    pulse: num($('#pulse').value),
    medA_mg: num($('#medA').value),
    medB_mg: num($('#medB').value),
    food: $('#food').value.trim(),
    protocol: $('#protocol').value.trim(),
  };
  await DB.put('daily', rec);
  flash('#daily-status', 'Gespeichert ✓');
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
    const bf = bodyFatMale(sum, age);
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
    bf_pct: sum != null ? bodyFatMale(sum, age) : null,
  };
  await DB.put('weekly', rec);
  flash('#weekly-status', 'Gespeichert ✓');
}

/* ---------- Fotos (monatlich) ---------- */
async function addPhoto(file) {
  if (!file) return;
  await DB.put('photos', { month: thisMonth(), blob: file, created: Date.now() });
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
async function renderCharts() {
  const daily = (await DB.getAll('daily')).sort((a, b) => a.date.localeCompare(b.date));
  const weekly = (await DB.getAll('weekly')).sort((a, b) => a.date.localeCompare(b.date));

  // Blutdruck
  const bpLabels = daily.map((d) => d.date);
  makeChart('chart-bp', [
    { label: 'Systolisch', data: daily.map((d) => d.sys), borderColor: '#dc2626', tension: 0.2, spanGaps: true },
    { label: 'Diastolisch', data: daily.map((d) => d.dia), borderColor: '#2563eb', tension: 0.2, spanGaps: true },
    { label: 'Puls', data: daily.map((d) => d.pulse), borderColor: '#16a34a', tension: 0.2, spanGaps: true },
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
  const head = ['Datum', 'Systolisch', 'Diastolisch', 'Puls', `Dosis_${(cfg.medA||'MedA')}_mg`, `Dosis_${(cfg.medB||'MedB')}_mg`];
  const lines = [head.join(SEP)];
  for (const r of rows)
    lines.push([r.date, deNum(r.sys), deNum(r.dia), deNum(r.pulse), deNum(r.medA_mg), deNum(r.medB_mg)].join(SEP));
  download(`blutdruck_${todayISO()}.csv`, lines.join('\r\n'));
}
async function exportBodyComp() {
  const rows = (await DB.getAll('weekly')).sort((a, b) => a.date.localeCompare(b.date));
  const head = ['Datum', 'Gewicht_kg', 'Brust_mm', 'Bauch_mm', 'Oberschenkel_mm', 'Summe_mm', 'Alter', 'KFA_Prozent'];
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
  const photosRaw = await DB.getAll('photos');
  const photos = [];
  for (const p of photosRaw) {
    const b64 = await blobToBase64(p.blob);
    photos.push({ id: p.id, month: p.month, created: p.created, type: p.blob.type, data: b64 });
  }
  const dump = { version: 1, exportedAt: new Date().toISOString(), daily, weekly, settings, photos };
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

/* ---------- Einstellungen ---------- */
async function loadSettings() {
  const cfg = await DB.getConfig();
  $('#set-sex').value = cfg.sex || 'male';
  $('#set-birthdate').value = cfg.birthdate || '';
  $('#set-medA').value = cfg.medA || '';
  $('#set-medB').value = cfg.medB || '';
}
async function saveSettings() {
  await DB.saveConfig({
    sex: $('#set-sex').value,
    birthdate: $('#set-birthdate').value,
    medA: $('#set-medA').value.trim() || 'Medikament A',
    medB: $('#set-medB').value.trim() || 'Medikament B',
  });
  flash('#set-status', 'Gespeichert ✓');
  loadDaily();
}

/* ---------- UI-Kleinkram ---------- */
function flash(sel, msg) {
  const el = $(sel);
  el.textContent = msg;
  setTimeout(() => { el.textContent = ''; }, 2000);
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
  await loadSettings();
  await loadDaily();
  await loadWeekly();

  $('#daily-date').addEventListener('change', loadDaily);
  $('#save-daily').addEventListener('click', saveDaily);

  $('#weekly-date').addEventListener('change', loadWeekly);
  $('#save-weekly').addEventListener('click', saveWeekly);
  ['#chest', '#abdomen', '#thigh'].forEach((s) => $(s).addEventListener('input', updateWeeklyPreview));

  $('#photo-input').addEventListener('change', (e) => addPhoto(e.target.files[0]));

  $('#export-bp').addEventListener('click', exportBP);
  $('#export-body').addEventListener('click', exportBodyComp);
  $('#export-backup').addEventListener('click', exportBackup);

  $('#save-settings').addEventListener('click', saveSettings);

  showView('view-heute');
}
document.addEventListener('DOMContentLoaded', init);
