import { canLeave, setDirty, setBusy } from './router.js';
import { toast } from './components.js';
let installPrompt;
export const canInstall = () => Boolean(installPrompt);
export async function installApp() {
  if (!installPrompt) return;
  const prompt = installPrompt; installPrompt = null;
  await prompt.prompt(); await prompt.userChoice;
  window.dispatchEvent(new Event('install-available'));
}
export async function requestPersistence() {
  if (!navigator.storage?.persist) return 'Den här webbläsaren stöder inte begäran om beständig lagring. Exportera säkerhetskopior regelbundet.';
  if (await navigator.storage.persisted()) return 'Din filmhylla har redan beständig lagring. Fortsätt säkerhetskopiera regelbundet.';
  const granted = await navigator.storage.persist();
  return granted ? 'Beständig lagring är aktiverad. Fortsätt säkerhetskopiera regelbundet.' : 'Webbläsaren beviljade inte beständig lagring. Din samling är kvar. Exportera säkerhetskopior regelbundet.';
}
export function setupPWA() {
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; window.dispatchEvent(new Event('install-available')); });
  window.addEventListener('appinstalled', () => { installPrompt = null; window.dispatchEvent(new Event('install-available')); toast('Min Filmhylla är installerad.'); });
  const connection = document.querySelector('#connection');
  const connectivity = () => { connection.hidden = navigator.onLine; };
  window.addEventListener('online', connectivity); window.addEventListener('offline', connectivity); connectivity();
  if (!('serviceWorker' in navigator)) return;
  let reloadRequested = false;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadRequested && !reloading) { reloading = true; location.reload(); }
  });
  navigator.serviceWorker.register('./sw.js', { scope: './' }).then(registration => {
    const banner = document.querySelector('#update-banner');
    const check = () => { banner.hidden = !registration.waiting; };
    check();
    registration.addEventListener('updatefound', () => { const worker = registration.installing; worker?.addEventListener('statechange', () => { if (worker.state === 'installed') check(); }); });
    document.querySelector('#update-app').addEventListener('click', async () => {
      if (!registration.waiting || !await canLeave()) return;
      setDirty(false); setBusy(true); reloadRequested = true;
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    });
  }).catch(() => toast('Offline-stödet kunde inte aktiveras. Använd HTTPS eller localhost och försök ladda om.', true));
}
