import { confirmAction } from './components.js';
let dirty = false;
let busy = false;
let render;
let committed = location.hash || '#/collection';
let controller;
let navigating = false;
export const setDirty = value => { dirty = value; };
export const setBusy = value => { busy = value; };
export const isDirty = () => dirty || busy;
export async function canLeave() {
  if (busy) return false;
  return !dirty || await confirmAction('Lämna utan att spara?', 'Du har ändringar som inte är sparade. De försvinner om du lämnar sidan.', { action: 'Lämna sidan' });
}
export function currentSection() { return (location.hash.split('/')[1] || 'collection'); }
export async function refreshRoute() {
  controller?.abort(); controller = new AbortController();
  await render(location.hash || '#/collection', controller.signal);
}
export function startRouter(callback) {
  render = callback;
  window.addEventListener('beforeunload', event => { if (isDirty()) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('hashchange', async () => {
    if (navigating) return;
    navigating = true;
    const target = location.hash || '#/collection';
    if (!await canLeave()) { history.replaceState(null, '', committed); navigating = false; return; }
    setDirty(false); committed = target;
    history.replaceState(null, '', target);
    navigating = false;
    await refreshRoute();
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.querySelector('#main').focus({ preventScroll: true });
  });
  refreshRoute();
}
