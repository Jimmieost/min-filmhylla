import { normalizeMovie } from './model.js';
const KEY = 'min-filmhylla-tmdb-token';
let token = '';
try { token = sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || ''; } catch { /* In-memory configuration remains available. */ }
export const hasToken = () => Boolean(token);
export function forgetToken() {
  token = ''; let failed = false;
  for (const store of ['sessionStorage', 'localStorage']) { try { globalThis[store].removeItem(KEY); } catch { failed = true; } }
  if (failed) throw new Error('Token togs bort från minnet, men webbläsaren blockerade åtkomst till sparade inställningar. Rensa webbplatsens lagring i webbläsaren för att säkert ta bort en ihågkommen token.');
}
export function storeToken(value, remember) {
  try {
    localStorage.removeItem(KEY); sessionStorage.removeItem(KEY);
    (remember ? localStorage : sessionStorage).setItem(KEY, value); token = value;
  } catch { token = value; throw new Error('Token fungerar och är aktiv i den här sidan, men webbläsaren kunde inte spara den. Ange den igen efter omladdning.'); }
}
async function request(path, params = {}, { signal, accessToken = token } = {}) {
  if (!accessToken) throw new Error('Lägg till din TMDB-token i Inställningar för att söka efter filmer.');
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  const controller = new AbortController(); const abort = () => controller.abort();
  if (signal?.aborted) controller.abort(); signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 15000);
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }, signal: controller.signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (response.status === 401 || response.status === 403) throw new Error('TMDB-token är ogiltig eller saknar behörighet. Kontrollera den i Inställningar.');
    if (response.status === 429) throw new Error('TMDB har fått för många förfrågningar. Vänta en stund och försök igen.');
    if (response.status === 404) throw new Error('Filmen finns inte längre hos TMDB. Dina sparade filmer påverkas inte.');
    if (!response.ok) throw new Error('TMDB är inte tillgängligt just nu. Försök igen senare.');
    return await response.json();
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Avbruten förfrågan', 'AbortError');
    if (error.name === 'AbortError') throw new Error('TMDB svarade inte i tid. Försök igen.');
    if (error instanceof SyntaxError) throw new Error('TMDB skickade ett svar som inte gick att läsa. Försök igen.');
    if (error instanceof TypeError) throw new Error('Kunde inte nå TMDB. Kontrollera internetanslutningen och försök igen.'); throw error;
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}
export const testToken = accessToken => request('/authentication', {}, { accessToken });
export async function searchMovies(query, page = 1, signal) {
  const data = await request('/search/movie', { query, language: 'sv-SE', include_adult: false, page }, { signal });
  if (!Array.isArray(data.results)) throw new Error('TMDB skickade ett oväntat sökresultat. Försök igen.');
  return { movies: data.results.filter(m => Number.isSafeInteger(m.id) && m.id > 0).map(normalizeMovie), pages: Math.min(Number(data.total_pages) || 1, 500), total: Number(data.total_results) || 0 };
}
export async function movieDetails(id, signal) {
  const data = await request(`/movie/${id}`, { language: 'sv-SE' }, { signal });
  if (data?.id !== id) throw new Error('TMDB skickade fel filminformation. Försök igen.');
  const missingOverview = typeof data.overview !== 'string' || !data.overview.trim();
  const missingTitle = typeof data.title !== 'string' || !data.title.trim();
  if (missingOverview || missingTitle) {
    const english = await request(`/movie/${id}`, { language: 'en-US' }, { signal });
    if (missingOverview) data.overview = english.overview;
    if (missingTitle) data.title = english.title;
  }
  return normalizeMovie(data);
}
