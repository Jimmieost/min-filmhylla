import { el, showError } from './components.js';
import { startRouter, currentSection, refreshRoute, isDirty } from './router.js';
import { renderCollection, renderSearch, renderMovie } from './movies.js';
import { renderStats } from './stats.js';
import { renderSettings } from './settings.js';
import { setupPWA } from './pwa.js';

const main = document.querySelector('#main');
document.querySelector('.skip-link').addEventListener('click', event => { event.preventDefault(); main.focus(); });
const titles = { collection: 'Min samling', search: 'Sök filmer', stats: 'Statistik', settings: 'Inställningar', movie: 'Film' };
async function render(hash, signal) {
  const section = hash.split('/')[1] || 'collection';
  const root = el('div', { class: 'page' }); main.replaceChildren(root);
  document.title = `${titles[section] || 'Sidan saknas'} · Min Filmhylla`;
  document.querySelectorAll('[data-nav]').forEach(anchor => {
    const active = anchor.dataset.nav === section || (section === 'movie' && anchor.dataset.nav === 'collection');
    if (active) anchor.setAttribute('aria-current', 'page'); else anchor.removeAttribute('aria-current');
  });
  try {
    if (section === 'collection') await renderCollection(root, signal);
    else if (section === 'search') await renderSearch(root, signal);
    else if (section === 'stats') await renderStats(root, signal);
    else if (section === 'settings') renderSettings(root, signal);
    else if (section === 'movie') await renderMovie(root, Number(hash.split('/')[2]), signal);
    else root.append(el('h1', {}, 'Här var det tomt'), el('p', {}, 'Sidan finns inte. Välj Min samling i menyn.'));
  } catch (error) { if (!signal.aborted && error.name !== 'AbortError') showError(root, error, refreshRoute); }
}
startRouter(render); setupPWA();

// Refresh statistics/collection in other tabs, without disturbing an editing form.
let channel;
if ('BroadcastChannel' in window) {
  try {
    channel = new BroadcastChannel('min-filmhylla');
    channel.onmessage = () => { if (!isDirty() && ['collection', 'stats'].includes(currentSection())) refreshRoute(); };
  } catch { /* The diary also works without cross-tab notifications. */ }
}
window.addEventListener('movies-changed', () => {
  channel?.postMessage('changed');
  if (!isDirty() && ['collection', 'stats'].includes(currentSection())) refreshRoute();
});
