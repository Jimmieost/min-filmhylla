import { el, icon, pageHeading, toast, confirmAction } from './components.js';
import { hasToken, testToken, storeToken, forgetToken } from './tmdb.js';
import { clearMovies } from './db.js';
import { exportBackup, importBackup } from './backup.js';
import { setDirty, setBusy } from './router.js';
import { installApp, canInstall, requestPersistence } from './pwa.js';
function panel(symbol, title, description, ...children) {
  return el('section', { class: 'panel settings-panel' }, el('div', { class: 'panel-title' }, icon(symbol), el('h2', {}, title)), el('p', { class: 'muted' }, description), ...children);
}
function external(text, href) { return el('a', { href, target: '_blank', rel: 'noopener noreferrer', class: 'text-link' }, text, icon('external')); }
export function renderSettings(root, signal) {
  root.append(pageHeading('GÖR FILMHYLLAN TILL DIN', 'Inställningar', 'En enkel filmhylla. Full kontroll över dina egna data.'));
  const tokenStatus = el('p', { class: 'token-status' }, icon(hasToken() ? 'check' : 'key'), hasToken() ? 'TMDB är anslutet' : 'Ingen TMDB-token är ansluten');
  const tokenInput = el('input', { id: 'tmdb-token', type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: 'Klistra in din API Read Access Token', required: true, maxlength: 4096, 'aria-describedby': 'token-help' });
  const reveal = el('button', { type: 'button', class: 'icon-button', 'aria-label': 'Visa token', 'aria-pressed': 'false', onclick: () => { const visible = tokenInput.type === 'password'; tokenInput.type = visible ? 'text' : 'password'; reveal.setAttribute('aria-pressed', String(visible)); reveal.setAttribute('aria-label', visible ? 'Dölj token' : 'Visa token'); } }, icon('eye'));
  const remember = el('input', { type: 'checkbox', id: 'remember-token' });
  const submit = el('button', { type: 'submit', class: 'button' }, 'Testa och använd token', icon('arrow'));
  const tokenForm = el('form', { class: 'token-form' }, tokenStatus, el('label', { for: 'tmdb-token' }, 'TMDB API Read Access Token'), el('div', { class: 'token-input' }, tokenInput, reveal), el('p', { class: 'field-help', id: 'token-help' }, 'Som standard används token bara i den här flikens session. När du väljer ”Testa och använd token” skickas den till TMDB för kontroll och sparas därefter enligt ditt val.'), el('label', { class: 'checkbox-label', for: 'remember-token' }, remember, 'Kom ihåg token på den här enheten'), el('p', { class: 'security-note' }, icon('lock'), 'En token i webbläsaren är ingen säker hemlighet. Använd bara din egen token på en enhet du litar på. Token ingår aldrig i säkerhetskopior.'), submit);
  tokenForm.addEventListener('input', () => setDirty(Boolean(tokenInput.value)));
  tokenForm.addEventListener('submit', async event => {
    event.preventDefault(); if (!tokenForm.reportValidity()) return;
    const value = tokenInput.value.trim();
    if (!value || /\s/.test(value)) { toast('Klistra in enbart din Read Access Token, utan ”Bearer” eller blanksteg.', true); return; }
    submit.disabled = true; submit.textContent = 'Kontrollerar med TMDB…'; setBusy(true);
    try {
      const result = await testToken(value);
      if (result.success !== true) throw new Error('TMDB kunde inte bekräfta din token.');
      storeToken(value, remember.checked);
      tokenInput.value = ''; setDirty(false);
      tokenStatus.replaceChildren(icon('check'), 'TMDB är anslutet');
      toast(remember.checked ? 'Token är kontrollerad och sparad på enheten.' : 'Token är kontrollerad och aktiv för den här sessionen.');
    } catch (error) { toast(error.message, true); }
    finally { submit.disabled = false; submit.textContent = 'Testa och använd token'; setBusy(false); }
  });
  const forget = el('button', { class: 'text-button', type: 'button', onclick: () => {
    try { forgetToken(); tokenInput.value = ''; setDirty(false); tokenStatus.replaceChildren(icon('key'), 'Ingen TMDB-token är ansluten'); toast('TMDB-token har tagits bort.'); }
    catch (error) { toast(error.message, true); }
  } }, 'Ta bort sparad token');
  const tmdbPanel = panel('key', 'Filmer från TMDB', 'TMDB hjälper dig att hitta filmer och deras affischer. Din filmdagbok är fortfarande helt privat.', external('Hämta en kostnadsfri token hos TMDB', 'https://www.themoviedb.org/settings/api'), tokenForm, forget);
  const exportButton = el('button', { class: 'button button-secondary', onclick: async () => {
    exportButton.disabled = true;
    try { await exportBackup(); } catch (error) { toast(error.message, true); } finally { exportButton.disabled = false; }
  } }, icon('download'), 'Exportera JSON');
  const file = el('input', { type: 'file', accept: '.json,application/json', class: 'file-input', id: 'backup-file', 'aria-label': 'Välj JSON-säkerhetskopia' });
  const importButton = el('button', { class: 'button button-secondary', onclick: () => file.click() }, icon('upload'), 'Importera JSON');
  file.addEventListener('change', async () => {
    importButton.disabled = true; setBusy(true);
    try { await importBackup(file.files[0]); } catch (error) { toast(error.message, true); }
    finally { importButton.disabled = false; file.value = ''; setBusy(false); }
  });
  const backupPanel = panel('download', 'Dina filmer, i tryggt förvar', 'Exportera en säkerhetskopia regelbundet, gärna efter varje filmkväll. Spara filen på en trygg plats. Du kan importera den på en annan enhet.', el('div', { class: 'settings-actions' }, exportButton, importButton, file), el('p', { class: 'field-help' }, 'Importen visar vilka filmer som läggs till eller uppdateras innan du bekräftar. Andra filmer i din samling behålls.'));
  const persistence = el('button', { class: 'button button-secondary', onclick: async () => { persistence.disabled = true; try { toast(await requestPersistence()); } catch { toast('Webbläsaren kunde inte begära beständig lagring. Säkerhetskopiera regelbundet.', true); } finally { persistence.disabled = false; } } }, icon('shield'), 'Begär beständig lagring');
  const storagePanel = panel('lock', 'Bara din. Bara på din enhet.', 'Filmer, betyg och recensioner sparas lokalt i webbläsarens IndexedDB. De synkroniseras inte automatiskt mellan enheter. Inga konton, inga annonser och ingen spårning.', el('p', { class: 'muted' }, 'Rensad webbplatsdata, privat surfning, lagringsbrist eller en återställd enhet kan ta bort samlingen. Beständig lagring kan minska risken men ersätter aldrig en säkerhetskopia.'), persistence);
  const install = el('button', { class: 'button button-secondary', hidden: !canInstall(), onclick: async () => { try { await installApp(); install.hidden = !canInstall(); } catch (error) { toast(error.message, true); } } }, icon('phone'), 'Installera Min Filmhylla');
  window.addEventListener('install-available', () => { install.hidden = !canInstall(); }, { signal });
  const offlinePanel = panel('wifi-off', 'Ta filmhyllan med dig', 'Efter ett första besök kan appen öppnas offline. Du kan läsa, redigera, ta bort och exportera dina sparade filmer samt visa statistik. Sökning och nya filmer kräver internet.', el('p', { class: 'muted' }, 'Tidigare visade affischer kan finnas i bildcachen, men alla affischer är inte garanterade offline.'), install, el('div', { class: 'installation-help' }, el('p', {}, el('strong', {}, 'iPhone och iPad: '), 'Öppna appen i Safari, tryck på Dela och välj Lägg till på hemskärmen.'), el('p', {}, el('strong', {}, 'Android: '), 'Öppna i Chrome och välj Installera app eller Lägg till på startskärmen i menyn. Installationsvalen varierar mellan webbläsare.')));
  const aboutPanel = panel('film', 'Om Min Filmhylla', 'Byggd för filmerna som stannar kvar. Version 1.0.0.', el('a', { href: 'https://www.themoviedb.org', target: '_blank', rel: 'noopener noreferrer', class: 'tmdb-attribution' }, el('img', { src: './assets/icons/tmdb.svg', alt: 'The Movie Database (TMDB)', width: 100, height: 44 })), el('p', { class: 'field-help', lang: 'en' }, 'This product uses the TMDB API but is not endorsed or certified by TMDB.'), el('p', { class: 'field-help' }, 'Den här produkten använder TMDB:s API men är inte godkänd eller certifierad av TMDB.'));
  const clear = el('button', { class: 'button button-danger-outline', onclick: async () => {
    if (!await confirmAction('Radera alla lokala data?', 'Alla filmer, betyg, recensioner och din TMDB-token raderas på den här enheten. Detta kan inte ångras utan en säkerhetskopia. Exportera din samling först.', { danger: true, strong: true, action: 'Radera alla data' })) return;
    clear.disabled = true; setBusy(true);
    try { await clearMovies(); forgetToken(); tokenInput.value = ''; setDirty(false); tokenStatus.replaceChildren(icon('key'), 'Ingen TMDB-token är ansluten'); toast('Alla filmer och din TMDB-token har raderats.'); }
    catch (error) { toast(error.message, true); }
    finally { clear.disabled = false; setBusy(false); }
  } }, icon('trash'), 'Radera alla data');
  const dangerPanel = panel('alert', 'Börja om från början', 'Ta bort hela din lokala samling och TMDB-token. Exportera en säkerhetskopia innan du fortsätter.', clear); dangerPanel.classList.add('danger-panel');
  root.append(el('div', { class: 'settings-grid' }, tmdbPanel, backupPanel, storagePanel, offlinePanel, aboutPanel, dangerPanel));
}
