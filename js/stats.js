import { allMovies } from './db.js';
import { el, icon, pageHeading, emptyState, link, movieCard, number } from './components.js';
import { calculateStats, collectionMovies } from './model.js';
import { summaryCards } from './movies.js';
export async function renderStats(root, signal) {
  root.append(pageHeading('DIN FILMSMAK I SIFFROR', 'Statistik', 'En liten tillbakablick på alla de stora filmupplevelserna.'));
  const movies = await allMovies(); if (signal.aborted) return;
  const stats = calculateStats(movies); root.append(summaryCards(movies));
  if (!movies.length) { root.append(emptyState('chart', 'Din filmresa i siffror', 'När du har sparat din första film börjar din statistik ta form.', link('Hitta en film', '#/search'))); return; }
  const rows = [5, 4, 3, 2, 1].map(rating => {
    const count = stats.distribution[rating - 1];
    const meter = el('meter', { min: 0, max: stats.total, value: count, 'aria-label': `${rating} stjärnor: ${count} filmer, ${number(count / stats.total * 100)} procent` });
    return el('div', { class: 'distribution-row' }, el('span', {}, String(rating), icon('star')), meter, el('strong', {}, String(count)));
  });
  root.append(el('section', { class: 'panel distribution' }, el('h2', {}, 'Dina stjärnor, fördelade'), el('p', { class: 'muted' }, 'Så här har du betygsatt filmerna i din samling.'), rows), el('div', { class: 'section-title' }, el('h2', {}, 'Högst på din hylla'), el('span', { class: 'muted' }, 'Dina 6 högst betygsatta filmer')), el('div', { class: 'movie-grid' }, collectionMovies(movies, '', 0, 'highest').slice(0, 6).map(m => movieCard(m))));
}
