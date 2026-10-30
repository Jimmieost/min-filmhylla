import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const source = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
function worker() {
  const handlers = {}; const stores = new Map(); let skips = 0; let claimed = 0;
  const caches = {
    open: async name => {
      if (!stores.has(name)) stores.set(name, new Map()); const entries = stores.get(name);
      return { addAll: async urls => { for (const url of urls) entries.set(String(url), new Response('shell')); }, match: async request => entries.get(String(request.url || request)), put: async (request, response) => entries.set(String(request.url || request), response), keys: async () => [...entries.keys()], delete: async key => entries.delete(String(key)) };
    }, keys: async () => [...stores.keys()], delete: async name => stores.delete(name),
  };
  const self = { registration: { scope: 'https://example.test/min-filmhylla/' }, addEventListener: (type, callback) => { handlers[type] = callback; }, skipWaiting: () => { skips++; }, clients: { claim: async () => { claimed++; } } };
  const context = { self, caches, URL, Promise, fetch: async () => { throw new TypeError('offline'); } };
  runInNewContext(source, context);
  async function dispatch(type, properties = {}) {
    let response; const tasks = [];
    handlers[type]({ ...properties, waitUntil: p => tasks.push(p), respondWith: p => { response = p; } });
    const result = await response; await Promise.all(tasks); return result;
  }
  return { stores, context, dispatch, skips: () => skips, claimed: () => claimed };
}
test('every pre-cached asset exists, including PNGs and all JS imports', async () => {
  const w = worker(); await w.dispatch('install');
  const assets = [...w.stores.values()][0]; assert.ok(assets.size > 20);
  for (const name of assets.keys()) { const relative = new URL(name).pathname.replace('/min-filmhylla/', '') || 'index.html'; await access(resolve(root, relative)); }
  const files = ['app', 'components', 'db', 'model', 'router', 'movies', 'tmdb', 'stats', 'settings', 'backup', 'pwa'];
  for (const name of files) {
    const file = resolve(root, `js/${name}.js`); const code = await readFile(file, 'utf8');
    for (const match of code.matchAll(/from\s+['"]([^'"]+)['"]/g)) await access(resolve(dirname(file), match[1]));
    assert.equal(/\.innerHTML\s*=|insertAdjacentHTML|eval\(/.test(code), false, `${name}: unsafe rendering`);
  }
});
test('manifest scopes to project directory and PNG headers have correct sizes', async () => {
  const manifest = JSON.parse(await readFile(resolve(root, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.scope, './'); assert.equal(manifest.start_url, './'); assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) {
    const bytes = await readFile(resolve(root, icon.src));
    if (icon.type === 'image/png') { const size = Number(icon.sizes.split('x')[0]); assert.equal(bytes.readUInt32BE(16), size); assert.equal(bytes.readUInt32BE(20), size); }
  }
});
test('worker install waits; activation only removes obsolete Filmhylla shell caches', async () => {
  const w = worker(); await w.dispatch('install'); assert.equal(w.skips(), 0);
  w.stores.set('min-filmhylla-shell-old', new Map()); w.stores.set('another-app-cache', new Map()); w.stores.set('min-filmhylla-posters-v1', new Map());
  await w.dispatch('activate'); assert.equal(w.stores.has('min-filmhylla-shell-old'), false); assert.equal(w.stores.has('another-app-cache'), true); assert.equal(w.stores.has('min-filmhylla-posters-v1'), true); assert.equal(w.claimed(), 1);
  await w.dispatch('message', { data: { type: 'SKIP_WAITING' } }); assert.equal(w.skips(), 1);
});
test('offline navigation works under a GitHub Pages subdirectory', async () => {
  const w = worker(); await w.dispatch('install');
  const response = await w.dispatch('fetch', { request: { url: 'https://example.test/min-filmhylla/', method: 'GET', mode: 'navigate', headers: new Headers() } });
  assert.equal(await response.text(), 'shell');
});
test('API requests and authenticated requests are never intercepted', async () => {
  const w = worker();
  for (const request of [{ url: 'https://api.themoviedb.org/3/search/movie' }, { url: 'https://example.test/min-filmhylla/index.html', headers: new Headers({ Authorization: 'Bearer fake' }) }]) {
    assert.equal(await w.dispatch('fetch', { request: { method: 'GET', headers: new Headers(), ...request } }), undefined);
  }
});
test('failed posters fall back offline; successful posters have a bounded cache', async () => {
  const w = worker(); await w.dispatch('install');
  const request = id => ({ url: `https://image.tmdb.org/t/p/w500/${id}.jpg`, method: 'GET', headers: new Headers() });
  assert.equal(await (await w.dispatch('fetch', { request: request('missing') })).text(), 'shell');
  w.context.fetch = async () => new Response('poster');
  for (let i = 0; i < 85; i++) await w.dispatch('fetch', { request: request(i) });
  assert.equal(w.stores.get('min-filmhylla-posters-v1').size, 80);
});
