const NAME = 'min-filmhylla-db';
const VERSION = 1;
let connection; let opening;
export function storageError(error) {
  if (error?.name === 'QuotaExceededError') return new Error('Lagringsutrymmet är fullt. Frigör utrymme och försök igen. Exportera gärna en säkerhetskopia.');
  return new Error('Webbläsaren kunde inte läsa eller spara din filmhylla. Tillåt lokal lagring, kontrollera ledigt utrymme och försök igen. Befintliga data har inte raderats.');
}
export function openDB() {
  if (connection) return Promise.resolve(connection);
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(storageError()); return; }
    let request;
    let blocked = false;
    try { request = indexedDB.open(NAME, VERSION); }
    catch (error) { reject(storageError(error)); return; }
    request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains('movies')) db.createObjectStore('movies', { keyPath: 'tmdbId' }); };
    request.onblocked = () => { blocked = true; reject(new Error('Databasen väntar på en annan flik. Stäng andra flikar med Min Filmhylla och försök igen.')); };
    request.onerror = () => reject(storageError(request.error));
    request.onsuccess = () => {
      const database = request.result;
      if (blocked) { database.close(); return; }
      connection = database;
      database.onversionchange = () => { database.close(); if (connection === database) { connection = null; opening = null; } };
      database.onclose = () => { if (connection === database) { connection = null; opening = null; } }; resolve(database);
    };
  }).catch(error => { opening = null; throw error; });
  return opening;
}
async function transaction(mode, operation) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    let tx; let result;
    try {
      tx = db.transaction('movies', mode);
      const request = operation(tx.objectStore('movies'));
      if (request) request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => { if (mode === 'readwrite') window.dispatchEvent(new Event('movies-changed')); resolve(result); };
      tx.onabort = () => reject(storageError(tx.error));
      tx.onerror = () => { /* onabort reports the transaction failure. */ };
    } catch (error) { if (tx) tx.abort(); reject(storageError(error)); }
  });
}
export const allMovies = () => transaction('readonly', store => store.getAll());
export const getMovie = id => transaction('readonly', store => store.get(id));
export const deleteMovie = id => transaction('readwrite', store => store.delete(id));
export const clearMovies = () => transaction('readwrite', store => store.clear());
// Reads and writes share a transaction, including across concurrent tabs.
export function saveMovie(movie) {
  return transaction('readwrite', store => {
    const read = store.get(movie.tmdbId);
    read.onsuccess = () => store.put({ ...movie, createdAt: read.result?.createdAt || movie.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
  });
}
export function mergeMovies(movies) {
  return transaction('readwrite', store => {
    for (const movie of movies) {
      const read = store.get(movie.tmdbId);
      read.onsuccess = () => store.put({ ...movie, createdAt: read.result?.createdAt || movie.createdAt });
    }
  });
}
