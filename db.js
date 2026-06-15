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
  const DB_VERSION = 1;
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

  // Settings-Convenience
  async function getConfig() {
    const c = await get('settings', 'config');
    return c || { key: 'config', sex: 'male', birthdate: '', medA: 'Medikament A', medB: 'Medikament B' };
  }
  async function saveConfig(cfg) {
    cfg.key = 'config';
    return put('settings', cfg);
  }

  window.DB = { open, put, get, getAll, remove, getConfig, saveConfig };
})();
