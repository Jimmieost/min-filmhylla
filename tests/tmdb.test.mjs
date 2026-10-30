import { test, after } from 'node:test';
import assert from 'node:assert/strict';
const savedFetch = globalThis.fetch;
function memoryStorage() { const values = new Map(); return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; }
globalThis.sessionStorage = memoryStorage(); globalThis.localStorage = memoryStorage();
const { hasToken, storeToken, forgetToken, testToken, searchMovies, movieDetails } = await import('../js/tmdb.js');
const FAKE_TOKEN = 'test-fixture-not-a-real-credential';
after(() => { globalThis.fetch = savedFetch; delete globalThis.sessionStorage; delete globalThis.localStorage; });
test('missing token gives an actionable Swedish error without making a request', async () => {
  forgetToken(); let called = false; globalThis.fetch = () => { called = true; };
  await assert.rejects(searchMovies('Film'), /Inställningar/); assert.equal(called, false);
});
test('token test uses HTTPS Bearer header, never URL credentials or caching', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url.protocol, 'https:'); assert.equal(url.pathname, '/3/authentication');
    assert.equal(url.href.includes(FAKE_TOKEN), false); assert.equal(options.headers.Authorization, `Bearer ${FAKE_TOKEN}`);
    assert.equal(options.cache, 'no-store'); assert.equal(options.credentials, 'omit'); return Response.json({ success: true });
  };
  assert.equal((await testToken(FAKE_TOKEN)).success, true); assert.equal(hasToken(), false);
});
test('session-only is default and remembering/forgetting removes old storage', () => {
  storeToken(FAKE_TOKEN, false); assert.equal(hasToken(), true);
  assert.equal(sessionStorage.getItem('min-filmhylla-tmdb-token'), FAKE_TOKEN); assert.equal(localStorage.getItem('min-filmhylla-tmdb-token'), null);
  storeToken(FAKE_TOKEN, true); assert.equal(sessionStorage.getItem('min-filmhylla-tmdb-token'), null); assert.equal(localStorage.getItem('min-filmhylla-tmdb-token'), FAKE_TOKEN);
  forgetToken(); assert.equal(hasToken(), false); assert.equal(localStorage.getItem('min-filmhylla-tmdb-token'), null); storeToken(FAKE_TOKEN, false);
});
test('search uses Swedish and preserves requested query/page', async () => {
  globalThis.fetch = async url => {
    assert.equal(url.pathname, '/3/search/movie'); assert.equal(url.searchParams.get('language'), 'sv-SE');
    assert.equal(url.searchParams.get('query'), 'Åter'); assert.equal(url.searchParams.get('page'), '2');
    return Response.json({ results: [{ id: 1, title: 'Åter' }], total_pages: 3, total_results: 43 });
  };
  const result = await searchMovies('Åter', 2); assert.equal(result.movies[0].tmdbId, 1); assert.equal(result.pages, 3); assert.equal(result.total, 43);
});
test('detail falls back to English synopsis while preserving Swedish title', async () => {
  const languages = [];
  globalThis.fetch = async url => {
    const language = url.searchParams.get('language'); languages.push(language);
    return Response.json({ id: 1, title: language === 'sv-SE' ? 'Svensk titel' : 'English title', overview: language === 'sv-SE' ? '' : 'English synopsis' });
  };
  const result = await movieDetails(1); assert.deepEqual(languages, ['sv-SE', 'en-US']); assert.equal(result.title, 'Svensk titel'); assert.equal(result.synopsis, 'English synopsis');
});
test('no extra request when Swedish details are available', async () => {
  let requests = 0; globalThis.fetch = async () => { requests++; return Response.json({ id: 1, title: 'Film', overview: 'Beskrivning' }); };
  await movieDetails(1); assert.equal(requests, 1);
});
test('invalid tokens, rate limits, deleted movies and network errors are understandable', async () => {
  for (const [code, pattern] of [[401, /ogiltig/], [403, /behörighet/], [429, /för många/], [404, /inte längre/], [500, /inte tillgängligt/]]) {
    globalThis.fetch = async () => new Response(null, { status: code }); await assert.rejects(searchMovies('Film'), pattern);
  }
  globalThis.fetch = async () => { throw new TypeError('Network'); }; await assert.rejects(searchMovies('Film'), /internetanslutningen/);
});
test('aborting an outdated search propagates an AbortError', async () => {
  globalThis.fetch = (_, { signal }) => new Promise((resolve, reject) => {
    if (signal.aborted) reject(new DOMException('Cancelled', 'AbortError'));
    else signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
  });
  const controller = new AbortController(); const request = searchMovies('Film', 1, controller.signal); controller.abort();
  await assert.rejects(request, error => error.name === 'AbortError');
});
