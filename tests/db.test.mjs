import { test, after } from 'node:test';
import assert from 'node:assert/strict';
// These checks simulate storage errors; real IndexedDB still needs browser QA.
const savedIndexedDB = globalThis.indexedDB;
after(() => { if (savedIndexedDB === undefined) delete globalThis.indexedDB; else globalThis.indexedDB = savedIndexedDB; });
let moduleId = 0;
const freshDB = () => import(`../js/db.js?test=${++moduleId}`);
test('unavailable IndexedDB gives a Swedish error and never uses volatile fallback', async () => {
  delete globalThis.indexedDB;
  const { allMovies } = await freshDB();
  await assert.rejects(allMovies(), /Tillåt lokal lagring/);
});
test('synchronously denied storage is converted to a Swedish error', async () => {
  globalThis.indexedDB = { open() { throw new DOMException('Denied', 'SecurityError'); } };
  const { allMovies } = await freshDB();
  await assert.rejects(allMovies(), /Befintliga data har inte raderats/);
});
test('blocked migrations are actionable and close a delayed connection', async () => {
  let request; let closed = false;
  globalThis.indexedDB = { open(name, version) { assert.equal(name, 'min-filmhylla-db'); assert.equal(version, 1); request = {}; queueMicrotask(() => request.onblocked()); return request; } };
  const { openDB } = await freshDB();
  await assert.rejects(openDB(), /Stäng andra flikar/);
  request.result = { close: () => { closed = true; } }; request.onsuccess(); assert.equal(closed, true);
});
test('quota errors explicitly state the problem and recommend a backup', async () => {
  const { storageError } = await freshDB();
  assert.match(storageError(new DOMException('Full', 'QuotaExceededError')).message, /fullt/);
  assert.match(storageError(new DOMException('Full', 'QuotaExceededError')).message, /säkerhetskopia/);
});
