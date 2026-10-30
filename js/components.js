export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'value') node.value = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  node.append(...children.flat(Infinity).filter(v => v !== null && v !== undefined));
  return node;
}
export function icon(name, className = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', className);
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `./assets/icons/sprite.svg#${name}`); svg.append(use); return svg;
}
export const link = (text, href, secondary = false) => el('a', { class: `button${secondary ? ' button-secondary' : ''}`, href }, text, icon('arrow'));
export function pageHeading(eyebrow, title, description, action) {
  return el('div', { class: 'page-heading' }, el('div', {}, el('p', { class: 'eyebrow' }, eyebrow), el('h1', {}, title), el('p', { class: 'intro' }, description)), action);
}
export function emptyState(symbol, title, description, action) {
  return el('div', { class: 'empty-state' }, el('div', { class: 'empty-symbol' }, icon(symbol)), el('h2', {}, title), el('p', {}, description), action);
}
export function toast(message, error = false) {
  const region = document.querySelector('#toasts');
  const item = el('div', { class: `toast${error ? ' toast-error' : ''}` }, icon(error ? 'alert' : 'check'), message);
  region.replaceChildren(item); setTimeout(() => item.remove(), 6500);
}
export function showError(parent, error, retry) {
  parent.append(el('div', { class: 'error-state', role: 'alert' }, icon('alert'), el('h2', {}, 'Det gick inte som tänkt'), el('p', {}, error.message || 'Ett oväntat fel uppstod. Försök igen.'), retry ? el('button', { class: 'button button-secondary', onclick: retry }, 'Försök igen') : null));
}
export function poster(movie, eager = false) {
  const frame = el('div', { class: 'poster' }, el('div', { class: 'poster-placeholder', 'aria-hidden': 'true' }, icon('film'), el('span', {}, 'Affisch saknas')));
  if (/^\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(movie.posterPath || '')) {
    const img = el('img', { src: `https://image.tmdb.org/t/p/w500${movie.posterPath}`, alt: '', loading: eager ? 'eager' : 'lazy', decoding: 'async', width: 500, height: 750 });
    img.addEventListener('error', () => img.remove(), { once: true }); frame.append(img);
  }
  return frame;
}
export function stars(value) {
  return el('span', { class: 'stars', 'aria-label': `${value} av 5 stjärnor` }, Array.from({ length: 5 }, (_, i) => icon('star', i < value ? 'filled' : 'unfilled')));
}
export function movieCard(movie, saved = true) {
  const image = poster(movie);
  if (saved) image.append(el('span', { class: 'poster-tag' }, icon('check'), 'Sedd'));
  return el('a', { class: 'movie-card', href: `#/movie/${movie.tmdbId}`, 'aria-label': `${movie.title}, ${movie.releaseYear || 'årtal saknas'}${saved ? `, ${movie.personalRating} av 5 stjärnor` : ''}` }, image,
    el('div', { class: 'card-info' }, el('h3', {}, movie.title), el('p', { class: 'card-year' }, String(movie.releaseYear || 'Årtal saknas')), saved ? stars(movie.personalRating) : null));
}
export function ratingInput(value = 0) {
  const field = el('fieldset', { class: 'rating-field' }, el('legend', {}, 'Ditt betyg', el('span', { class: 'required' }, ' *')));
  const group = el('div', { class: 'rating-input' });
  const captions = ['Välj ett betyg', 'Ingen favorit', 'Helt okej', 'Bra film', 'Riktigt bra', 'En ny favorit'];
  const caption = el('span', { class: 'rating-caption', 'aria-live': 'polite' }, captions[value]);
  const labels = [];
  for (let i = 1; i <= 5; i++) {
    const input = el('input', { type: 'radio', name: 'rating', value: i, id: `rating-${i}`, required: true, checked: i === value, 'aria-label': `${i} av 5 stjärnor` });
    const label = el('label', { for: `rating-${i}`, class: i <= value ? 'selected' : '' }, input, icon('star'));
    input.addEventListener('change', () => { labels.forEach((item, index) => item.classList.toggle('selected', index < i)); caption.textContent = captions[i]; });
    labels.push(label); group.append(label);
  }
  field.append(group, caption); return field;
}
export function confirmAction(title, description, { danger = false, strong = false, action = 'Bekräfta' } = {}) {
  const dialog = document.querySelector('#confirm-dialog');
  if (dialog.open) return Promise.resolve(false);
  document.querySelector('#confirm-title').textContent = title;
  document.querySelector('#confirm-description').textContent = description;
  const input = document.querySelector('#confirm-input'); const button = document.querySelector('#confirm-action');
  input.value = ''; document.querySelector('#confirm-label').hidden = !strong;
  button.textContent = action; button.className = danger ? 'button button-danger' : 'button'; button.disabled = strong;
  input.oninput = () => { button.disabled = strong && input.value !== 'RADERA'; };
  dialog.returnValue = 'cancel'; dialog.showModal();
  return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }));
}
export function localDate(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export const number = value => new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 }).format(value);
