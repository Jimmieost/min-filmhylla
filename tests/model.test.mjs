import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRecord, parseBackup, normalizeMovie, collectionMovies, calculateStats, validDate, safeImagePath } from '../js/model.js';
import { localDate } from '../js/components.js';

// Synthetic fixtures exist only in tests, never in the user's collection.
const movie = (values = {}) => ({ tmdbId: 1001, title: 'Återkomsten', originalTitle: 'The Return', releaseYear: 2020, posterPath: '/poster.jpg', backdropPath: null, genres: ['Drama'], synopsis: 'En beskrivning med å, ä och ö.', runtime: 100, personalRating: 4, personalReview: 'Första raden.\nAndra raden.', watchedDate: '2026-10-31', createdAt: '2026-10-01T12:00:00.000Z', updatedAt: '2026-10-31T12:00:00.000Z', ...values });
const backup = movies => JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), movies });
test('UTF-8 backup roundtrip preserves Swedish and line breaks, strips credentials', () => {
  const result = parseBackup(backup([movie({ token: 'must-never-be-exported' })]));
  assert.equal(result[0].title, 'Återkomsten'); assert.equal(result[0].personalReview, 'Första raden.\nAndra raden.'); assert.equal(result[0].token, undefined);
});
test('backup rejects malformed JSON, unsupported schemas and duplicate TMDB IDs', () => {
  assert.throws(() => parseBackup('{'), /JSON/);
  assert.throws(() => parseBackup(JSON.stringify({ schemaVersion: 2, movies: [] })), /version/);
  assert.throws(() => parseBackup(backup([movie(), movie()])), /samma TMDB-ID/);
});
test('backup rejects partial files before writes, invalid ratings and oversized reviews', () => {
  for (const value of [0, 6, 2.5, '5', NaN]) assert.throws(() => validateRecord(movie({ personalRating: value })));
  assert.throws(() => parseBackup(backup([movie(), { tmdbId: 1002 }])));
  assert.throws(() => validateRecord(movie({ personalReview: 'a'.repeat(5001) })));
  assert.equal(validateRecord(movie({ personalReview: 'a'.repeat(5000) })).personalReview.length, 5000);
});
test('optional fields allow null and an explicitly cleared date', () => {
  assert.doesNotThrow(() => validateRecord(movie({ releaseYear: null, posterPath: null, backdropPath: null, runtime: null, watchedDate: null, personalReview: '' })));
  assert.doesNotThrow(() => validateRecord(movie({ watchedDate: '' })));
});
test('calendar validation catches impossible days and handles leap years', () => {
  assert.equal(validDate('2024-02-29'), true); assert.equal(validDate('2025-02-29'), false);
  assert.equal(validDate('2026-02-30'), false); assert.equal(validDate('2026-13-01'), false);
  assert.throws(() => validateRecord(movie({ watchedDate: '2026-02-30' })));
  assert.equal(localDate(new Date(2026, 9, 31, 23, 59)), '2026-10-31');
});
test('metadata validation rejects incorrect types and unsafe image addresses', () => {
  for (const values of [{ tmdbId: -1 }, { title: '' }, { runtime: '100' }, { genres: ['Drama', {}] }, { createdAt: 'yesterday' }, { posterPath: 'https://example.com/track.jpg' }, { synopsis: null }]) assert.throws(() => validateRecord(movie(values)));
  assert.equal(safeImagePath('//evil.example/x.jpg'), null);
  assert.equal(safeImagePath('javascript:alert(1)'), null);
});
test('TMDB normalization handles absent posters and untrusted metadata', () => {
  const normalized = normalizeMovie({ id: 44, original_title: 'Original', overview: '<script>example</script>', release_date: '2001-01-01', runtime: null });
  assert.equal(normalized.title, 'Original'); assert.equal(normalized.posterPath, null);
  assert.equal(normalized.synopsis, '<script>example</script>'); assert.equal(normalized.releaseYear, 2001);
  assert.throws(() => normalizeMovie({ id: '44' }));
});
const movies = [movie(), movie({ tmdbId: 1002, title: 'Apelsin', personalRating: 5, releaseYear: 2010, createdAt: '2026-10-03T12:00:00.000Z' }), movie({ tmdbId: 1003, title: 'Ön', personalRating: 1, releaseYear: null, createdAt: '2026-10-02T12:00:00.000Z' })];
test('local search matches original and Swedish titles without changing original arrays', () => {
  assert.equal(collectionMovies(movies, 'THE RETURN').length, 3);
  assert.equal(collectionMovies(movies, 'åter')[0].tmdbId, 1001);
  assert.equal(collectionMovies(movies, '', '0').length, 3);
  assert.equal(collectionMovies(movies, '', 5)[0].tmdbId, 1002);
  assert.equal(movies[0].tmdbId, 1001);
});
test('all five sorting modes and rating filters work', () => {
  for (const [sort, ids] of [['recent', [1002, 1003, 1001]], ['highest', [1002, 1001, 1003]], ['lowest', [1003, 1001, 1002]], ['title', [1002, 1001, 1003]], ['year', [1001, 1002, 1003]]]) assert.deepEqual(collectionMovies(movies, '', 0, sort).map(m => m.tmdbId), ids);
  assert.equal(collectionMovies(movies, 'not a title').length, 0);
});
test('statistics include every rating, correct average and empty collection', () => {
  assert.deepEqual(calculateStats(movies), { total: 3, average: 10 / 3, fives: 1, distribution: [1, 0, 0, 1, 1] });
  assert.deepEqual(calculateStats([]), { total: 0, average: 0, fives: 0, distribution: [0, 0, 0, 0, 0] });
});
