import { allMovies, getMovie, saveMovie, deleteMovie } from './db.js';
import { el, icon, link, pageHeading, emptyState, movieCard, poster, ratingInput, showError, toast, confirmAction, localDate, number } from './components.js';
import { collectionMovies, calculateStats, validateRecord } from './model.js';
import { hasToken, searchMovies, movieDetails } from './tmdb.js';
import { setDirty, setBusy } from './router.js';

const collectionState = { query: '', rating: 0, sort: 'recent' };
const searchState = { query: '', page: 1 };
export function summaryCards(movies) {
  const stats = calculateStats(movies);
  return el('div', { class: 'summary-cards' },
    ...[['film', stats.total, 'filmer i samlingen'], ['star', stats.total ? number(stats.average) : '–', 'ditt snittbetyg'], ['heart', stats.fives, 'femstjärniga favoriter']].map(([symbol, value, label]) => el('div', { class: 'summary-card' }, el('span', { class: 'summary-icon' }, icon(symbol)), el('div', {}, el('strong', {}, String(value)), el('span', {}, label)))));
}
export async function renderCollection(root, signal) {
  root.append(pageHeading('DIN PERSONLIGA FILMDAGBOK', 'Min samling', 'Bra, dåliga och oförglömliga. Här finns alla dina filmminnen.', link('Lägg till en film', '#/search')));
  const movies = await allMovies(); if (signal.aborted) return;
  root.append(summaryCards(movies));
  const input = el('input', { type: 'search', value: collectionState.query, placeholder: 'Sök i din samling…', 'aria-label': 'Sök i din samling', autocomplete: 'off' });
  const select = el('select', { 'aria-label': 'Sortera samlingen' }, ...[['recent', 'Senast tillagda'], ['highest', 'Högst betyg'], ['lowest', 'Lägst betyg'], ['title', 'Titel A–Ö'], ['year', 'Utgivningsår']].map(([value, label]) => el('option', { value }, label)));
  select.value = collectionState.sort;
  const filters = el('div', { class: 'filters', role: 'group', 'aria-label': 'Filtrera efter betyg' });
  const results = el('div', { class: 'collection-results' });
  const counter = el('span', { class: 'result-count', role: 'status' });
  const buttons = [];
  for (const rating of [0, 5, 4, 3, 2, 1]) {
    const button = el('button', { class: 'filter-chip', type: 'button', 'aria-pressed': String(collectionState.rating === rating), onclick: () => { collectionState.rating = rating; draw(); } }, rating ? [icon('star'), String(rating)] : 'Alla filmer');
    buttons.push([rating, button]); filters.append(button);
  }
  function draw() {
    const list = collectionMovies(movies, collectionState.query, collectionState.rating, collectionState.sort);
    counter.textContent = `${list.length} ${list.length === 1 ? 'film' : 'filmer'}`;
    buttons.forEach(([rating, button]) => button.setAttribute('aria-pressed', String(collectionState.rating === rating)));
    if (list.length) results.replaceChildren(el('div', { class: 'movie-grid' }, list.map(m => movieCard(m))));
    else if (movies.length) results.replaceChildren(emptyState('search', 'Ingen film matchade', 'Prova en annan titel eller visa alla betyg.', el('button', { class: 'button button-secondary', onclick: () => { collectionState.query = ''; input.value = ''; collectionState.rating = 0; draw(); } }, 'Rensa filtren')));
    else results.replaceChildren(emptyState('library', 'Varje filmhylla börjar med en film.', 'Den där filmen du fortfarande tänker på? Ge den en plats här. Sök, sätt ett betyg och gör samlingen till din.', link('Hitta din första film', '#/search')));
  }
  input.addEventListener('input', () => { collectionState.query = input.value; draw(); });
  select.addEventListener('change', () => { collectionState.sort = select.value; draw(); });
  root.append(el('div', { class: 'collection-toolbar' }, el('div', { class: 'search-field' }, icon('search'), input), el('div', { class: 'sort-field' }, icon('sort'), select)), el('div', { class: 'filter-row' }, filters, counter), results);
  draw();
}

export async function renderSearch(root, signal) {
  root.append(pageHeading('NÄSTA FILMMINNE BÖRJAR HÄR', 'Sök filmer', 'Hitta filmen. Sätt dina stjärnor. Spara känslan.'));
  if (!hasToken()) {
    root.append(emptyState('key', 'Koppla ihop din filmvärld', 'Lägg till din egen kostnadsfria TMDB-token för att söka bland filmer. Din sparade samling fungerar alltid utan token.', link('Ställ in TMDB', '#/settings'))); return;
  }
  const input = el('input', { type: 'search', value: searchState.query, placeholder: 'Vilken film har du sett?', 'aria-label': 'Sök filmer på TMDB', autocomplete: 'off', maxlength: 200 });
  const results = el('div', { 'aria-live': 'polite', 'aria-busy': 'false' });
  const content = el('div'); const status = el('p', { class: 'search-status', role: 'status' });
  const previous = el('button', { class: 'button button-secondary', onclick: () => run(searchState.page - 1) }, 'Föregående');
  const next = el('button', { class: 'button button-secondary', onclick: () => run(searchState.page + 1) }, 'Nästa');
  const pageLabel = el('span'); const pagination = el('div', { class: 'pagination', hidden: true }, previous, pageLabel, next);
  results.append(status, content, pagination);
  root.append(el('div', { class: 'search-field search-large' }, icon('search'), input), el('p', { class: 'field-help' }, 'Sök på svensk eller engelsk titel. Filminformation från TMDB.'), results);
  let timer; let request; let sequence = 0;
  signal.addEventListener('abort', () => { clearTimeout(timer); request?.abort(); }, { once: true });
  function cancel() { request?.abort(); sequence++; results.setAttribute('aria-busy', 'false'); }
  async function run(page = 1) {
    cancel(); if (signal.aborted) return;
    const query = input.value.trim(); searchState.query = input.value; searchState.page = page;
    content.replaceChildren(); pagination.hidden = true;
    if (query.length < 2) { status.textContent = ''; content.append(emptyState('search', 'Vad har du sett på sistone?', 'Skriv minst två tecken för att hitta din film.')); return; }
    request = new AbortController(); const current = sequence;
    status.textContent = 'Letar bland filmer…'; results.setAttribute('aria-busy', 'true');
    previous.disabled = true; next.disabled = true;
    try {
      const data = await searchMovies(query, page, request.signal);
      if (signal.aborted || sequence !== current) return;
      status.textContent = `${number(data.total)} ${data.total === 1 ? 'film hittad' : 'filmer hittade'}`;
      if (!data.movies.length) content.append(emptyState('search', 'Ingen film hittades', 'Prova originaltiteln eller kontrollera stavningen.'));
      else content.append(el('div', { class: 'movie-grid' }, data.movies.map(m => movieCard(m, false))));
      pagination.hidden = data.pages <= 1; previous.disabled = page <= 1; next.disabled = page >= data.pages;
      pageLabel.textContent = `Sida ${page} av ${data.pages}`;
    } catch (error) {
      if (error.name === 'AbortError' || signal.aborted || current !== sequence) return;
      status.textContent = ''; showError(content, error, () => run(page));
    } finally { if (!signal.aborted && current === sequence) results.setAttribute('aria-busy', 'false'); }
  }
  input.addEventListener('input', () => { clearTimeout(timer); cancel(); searchState.query = input.value; status.textContent = ''; content.replaceChildren(); pagination.hidden = true; timer = setTimeout(() => run(1), 350); });
  run(searchState.page);
}

export async function renderMovie(root, id, signal) {
  const back = el('a', { class: 'back-link', href: '#/collection' }, icon('arrow-left'), 'Till samlingen');
  root.append(back, el('p', { class: 'loading', role: 'status' }, 'Hämtar film…'));
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Filmlänken är ogiltig.');
  let movie = await getMovie(id); const existing = Boolean(movie);
  if (!movie) movie = await movieDetails(id, signal);
  if (signal.aborted) return;
  root.replaceChildren(back);
  if (!existing) { back.href = '#/search'; back.replaceChildren(icon('arrow-left'), 'Till sökningen'); }
  const info = el('div', { class: 'movie-detail-info' }, el('p', { class: 'eyebrow' }, existing ? 'ETT AV DINA FILMMINNEN' : 'ETT NYTT FILMMINNE'), el('h1', {}, movie.title), el('p', { class: 'movie-meta' }, [movie.releaseYear, movie.runtime ? `${movie.runtime} min` : null].filter(Boolean).join(' · ')), el('div', { class: 'genres' }, movie.genres.map(g => el('span', {}, g))), el('p', { class: 'synopsis' }, movie.synopsis || 'Det finns ingen beskrivning för den här filmen.'));
  if (movie.originalTitle && movie.originalTitle !== movie.title) info.append(el('p', { class: 'field-help' }, `Originaltitel: ${movie.originalTitle}`));
  const form = el('form', { class: 'review-form', novalidate: true });
  const rating = ratingInput(movie.personalRating || 0);
  const validation = el('p', { class: 'field-error', role: 'alert', hidden: true });
  const review = el('textarea', { id: 'review', name: 'review', rows: 5, maxlength: 5000, placeholder: 'Vad stannade kvar efter eftertexterna?', value: movie.personalReview || '' });
  const counter = el('span', { class: 'field-help character-count' }, `${review.value.length} / 5 000`);
  const date = el('input', { id: 'watched-date', name: 'watchedDate', type: 'date', value: existing ? (movie.watchedDate || '') : localDate() });
  const save = el('button', { class: 'button save-button', type: 'submit' }, icon('check'), existing ? 'Spara ändringar' : 'Spara i min samling');
  form.append(el('div', { class: 'form-heading' }, el('h2', {}, 'Din upplevelse'), el('span', { class: 'private-label' }, icon('lock'), 'Bara för dig')), rating, validation,
    el('label', { for: 'review' }, 'Dina tankar', el('span', { class: 'optional' }, ' Valfritt')), review, counter,
    el('label', { for: 'watched-date' }, 'När såg du filmen?', el('span', { class: 'optional' }, ' Valfritt')), date, el('div', { class: 'form-actions' }, save));
  const panel = el('div', { class: 'detail-layout' }, el('aside', { class: 'detail-poster' }, poster(movie, true)), el('div', { class: 'detail-content' }, info, form));
  root.append(panel);
  const formValues = () => JSON.stringify([form.querySelector('input[name="rating"]:checked')?.value || '', review.value, date.value]);
  let savedValues = formValues();
  form.addEventListener('input', () => { counter.textContent = `${review.value.length} / 5 000`; setDirty(formValues() !== savedValues); validation.hidden = true; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const personalRating = Number(form.querySelector('input[name="rating"]:checked')?.value);
    if (!Number.isInteger(personalRating) || personalRating < 1 || personalRating > 5) {
      validation.textContent = 'Välj 1–5 stjärnor innan du sparar filmen.'; validation.hidden = false; form.querySelector('input[name="rating"]').focus(); return;
    }
    if (!form.reportValidity()) return;
    const now = new Date().toISOString();
    const record = { ...movie, personalRating, personalReview: review.value, watchedDate: date.value || null, createdAt: movie.createdAt || now, updatedAt: now };
    save.disabled = true; setBusy(true);
    try {
      validateRecord(record); await saveMovie(record);
      movie = record; savedValues = formValues(); setDirty(false); toast('Filmen är sparad i din samling.');
      location.hash = '#/collection';
    } catch (error) { toast(error.message, true); }
    finally { save.disabled = false; setBusy(false); }
  });
  if (existing) {
    const remove = el('button', { type: 'button', class: 'delete-link', onclick: async () => {
      if (!await confirmAction('Ta bort filmen?', `”${movie.title}” och dina anteckningar tas bort från samlingen. Exportera en säkerhetskopia om du vill kunna återställa dem.`, { danger: true, action: 'Ta bort filmen' })) return;
      remove.disabled = true; setBusy(true);
      try { await deleteMovie(id); setDirty(false); toast('Filmen har tagits bort.'); location.hash = '#/collection'; }
      catch (error) { toast(error.message, true); }
      finally { remove.disabled = false; setBusy(false); }
    } }, icon('trash'), 'Ta bort från samlingen');
    form.append(remove);
  }
}
