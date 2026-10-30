const imagePattern = /^\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/i;
export const safeImagePath = value => typeof value === 'string' && imagePattern.test(value) ? value : null;
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function normalizeMovie(data) {
  if (!Number.isSafeInteger(data?.id) || data.id < 1) throw new Error('TMDB skickade ogiltig filminformation. Försök igen.');
  return {
    tmdbId: data.id,
    title: typeof data.title === 'string' && data.title.trim() ? data.title.slice(0, 500) : (typeof data.original_title === 'string' ? data.original_title.slice(0, 500) : 'Okänd titel'),
    originalTitle: typeof data.original_title === 'string' ? data.original_title.slice(0, 500) : '',
    releaseYear: /^\d{4}-/.test(data.release_date || '') ? Number(data.release_date.slice(0, 4)) : null,
    posterPath: safeImagePath(data.poster_path), backdropPath: safeImagePath(data.backdrop_path),
    genres: Array.isArray(data.genres) ? data.genres.filter(g => typeof g?.name === 'string').slice(0, 30).map(g => g.name.slice(0, 100)) : [],
    synopsis: typeof data.overview === 'string' ? data.overview.slice(0, 20000) : '',
    runtime: Number.isInteger(data.runtime) && data.runtime > 0 && data.runtime <= 10000 ? data.runtime : null,
  };
}
function text(value, max, required = false) { return typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0); }
function timestamp(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(value) && validDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value)); }
export function validateRecord(record, position = 1) {
  const fail = () => { throw new Error(`Film ${position} innehåller ogiltiga eller saknade uppgifter. Ingen film har importerats.`); };
  if (!record || typeof record !== 'object' || Array.isArray(record)) fail();
  if (!Number.isSafeInteger(record.tmdbId) || record.tmdbId <= 0 || !text(record.title, 500, true) || !text(record.originalTitle, 500)) fail();
  if (record.releaseYear !== null && (!Number.isInteger(record.releaseYear) || record.releaseYear < 1800 || record.releaseYear > 9999)) fail();
  if (!Number.isInteger(record.personalRating) || record.personalRating < 1 || record.personalRating > 5 || !text(record.personalReview, 5000)) fail();
  if (record.watchedDate !== null && record.watchedDate !== '' && !validDate(record.watchedDate)) fail();
  if (!timestamp(record.createdAt) || !timestamp(record.updatedAt)) fail();
  if (!Array.isArray(record.genres) || record.genres.length > 30 || !record.genres.every(g => text(g, 100, true)) || !text(record.synopsis, 20000)) fail();
  if (record.runtime !== null && (!Number.isInteger(record.runtime) || record.runtime < 1 || record.runtime > 10000)) fail();
  for (const key of ['posterPath', 'backdropPath']) if (record[key] !== null && !safeImagePath(record[key])) fail();
  return Object.fromEntries(['tmdbId', 'title', 'originalTitle', 'releaseYear', 'posterPath', 'backdropPath', 'genres', 'synopsis', 'runtime', 'personalRating', 'personalReview', 'watchedDate', 'createdAt', 'updatedAt'].map(key => [key, record[key]]));
}
export function parseBackup(raw) {
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error('Filen är inte giltig JSON. Välj en säkerhetskopia från Min Filmhylla.'); }
  if (!data || data.schemaVersion !== 1 || !timestamp(data.exportedAt) || !Array.isArray(data.movies)) throw new Error('Säkerhetskopian har fel format eller en version som appen inte stöder.');
  if (data.movies.length > 50000) throw new Error('Filen innehåller för många filmer (högst 50 000).');
  const movies = data.movies.map((movie, i) => validateRecord(movie, i + 1)); const ids = new Set();
  for (const movie of movies) {
    if (ids.has(movie.tmdbId)) throw new Error(`Säkerhetskopian innehåller flera filmer med samma TMDB-ID (${movie.tmdbId}). Ingen film har importerats.`);
    ids.add(movie.tmdbId);
  }
  return movies;
}
export function collectionMovies(movies, query = '', rating = 0, sort = 'recent') {
  const search = query.toLocaleLowerCase('sv-SE').trim();
  const result = movies.filter(m => (!Number(rating) || m.personalRating === Number(rating)) && `${m.title} ${m.originalTitle}`.toLocaleLowerCase('sv-SE').includes(search));
  const alpha = (a, b) => a.title.localeCompare(b.title, 'sv');
  const compare = { recent: (a, b) => b.createdAt.localeCompare(a.createdAt) || alpha(a, b), highest: (a, b) => b.personalRating - a.personalRating || alpha(a, b), lowest: (a, b) => a.personalRating - b.personalRating || alpha(a, b), title: alpha, year: (a, b) => (b.releaseYear || 0) - (a.releaseYear || 0) || alpha(a, b) };
  return result.sort(compare[sort] || compare.recent);
}
export function calculateStats(movies) {
  const distribution = [1, 2, 3, 4, 5].map(rating => movies.filter(m => m.personalRating === rating).length);
  return { total: movies.length, average: movies.length ? movies.reduce((sum, m) => sum + m.personalRating, 0) / movies.length : 0, fives: distribution[4], distribution };
}
