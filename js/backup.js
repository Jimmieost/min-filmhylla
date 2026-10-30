import { allMovies, mergeMovies } from './db.js';
import { parseBackup, validateRecord } from './model.js';
import { localDate, confirmAction, toast } from './components.js';
export async function exportBackup() {
  const movies = (await allMovies()).map((movie, i) => validateRecord(movie, i + 1));
  const data = { schemaVersion: 1, exportedAt: new Date().toISOString(), movies };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = `min-filmhylla-${localDate()}.json`; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  toast(`Säkerhetskopia med ${movies.length} filmer har skapats.`);
}
export async function importBackup(file) {
  if (!file) return;
  if (file.size > 25 * 1024 * 1024) throw new Error('Filen är för stor. Välj en JSON-säkerhetskopia på högst 25 MB.');
  const movies = parseBackup(await file.text());
  if (!movies.length) throw new Error('Säkerhetskopian är tom. Din samling har inte ändrats.');
  const current = new Set((await allMovies()).map(m => m.tmdbId));
  const updates = movies.filter(m => current.has(m.tmdbId)).length;
  if (!await confirmAction('Importera säkerhetskopian?', `${movies.length - updates} nya filmer läggs till och ${updates} befintliga filmer uppdateras med betyg och anteckningar från filen. Övriga filmer behålls.`, { action: 'Importera filmer' })) return;
  await mergeMovies(movies); toast(`${movies.length} filmer har importerats.`);
}
