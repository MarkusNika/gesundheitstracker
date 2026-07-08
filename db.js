/* db.js — IndexedDB-Datenschicht
 * Bewusst als klassisches Script (kein ES-Modul), damit es auch über file://
 * und GitHub Pages ohne Build-Schritt läuft. Globaler Namespace: window.DB
 *
 * Object Stores:
 *   daily    keyPath 'date' (YYYY-MM-DD)  -> Blutdruck, Puls, Medikamente, Essen, Protokoll
 *   weekly   keyPath 'date' (YYYY-MM-DD)  -> Gewicht + Hautfalten (Brust/Bauch/Oberschenkel)
 *   photos   keyPath 'id' (autoIncrement) -> { id, month 'YYYY-MM', blob, created }
 *   settings keyPath 'key'                -> z.B. { key:'config', sex, birthdate, medA, medB }
 */
(function () {
  const DB_NAME = 'gesundheitstracker';
  const DB_VERSION = 2; // v2: Store 'training' ergänzt
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('daily'))
          db.createObjectStore('daily', { keyPath: 'date' });
        if (!db.objectStoreNames.contains('weekly'))
          db.createObjectStore('weekly', { keyPath: 'date' });
        if (!db.objectStoreNames.contains('photos'))
          db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
        if (!db.objectStoreNames.contains('settings'))
          db.createObjectStore('settings', { keyPath: 'key' });
        // v2: ein Trainings-Datensatz pro Tag (hält eine Übungsliste).
        if (!db.objectStoreNames.contains('training'))
          db.createObjectStore('training', { keyPath: 'date' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx(store, mode) {
    return open().then((db) => db.transaction(store, mode).objectStore(store));
  }

  async function put(store, value) {
    const os = await tx(store, 'readwrite');
    return new Promise((resolve, reject) => {
      const r = os.put(value);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }

  async function get(store, key) {
    const os = await tx(store, 'readonly');
    return new Promise((resolve, reject) => {
      const r = os.get(key);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
  }

  async function getAll(store) {
    const os = await tx(store, 'readonly');
    return new Promise((resolve, reject) => {
      const r = os.getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error);
    });
  }

  async function remove(store, key) {
    const os = await tx(store, 'readwrite');
    return new Promise((resolve, reject) => {
      const r = os.delete(key);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  }

  // Leert einen kompletten Object-Store. Wird vom Backup-Import im Modus
  // "Komplett ersetzen" gebraucht (alle alten Daten weg, dann Backup einspielen).
  async function clear(store) {
    const os = await tx(store, 'readwrite');
    return new Promise((resolve, reject) => {
      const r = os.clear();
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  }

  // Settings-Convenience
  async function getConfig() {
    const c = await get('settings', 'config');
    return c || {
      key: 'config', sex: 'male', birthdate: '',
      medA: 'Medikament A', medB: 'Medikament B',
      medA_dose: null, medB_dose: null, // Standard-Dosis (Vorbelegung fürs Tagesformular)
    };
  }
  async function saveConfig(cfg) {
    cfg.key = 'config';
    return put('settings', cfg);
  }

  window.DB = { open, put, get, getAll, remove, clear, getConfig, saveConfig };
})();
