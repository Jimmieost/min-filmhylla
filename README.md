# Min Filmhylla

En privat, svensk filmdagbok som fungerar som statiska filer. Sök filmer på TMDB, sätt 1–5 stjärnor, skriv egna recensioner och bygg din samling. Sparade filmer fungerar även utan internet och utan TMDB-token.

Appen använder HTML5, CSS3, vanliga JavaScript-moduler, IndexedDB och webbläsarens egna API:er. Inga paket, byggsteg, konton, databastjänster eller spårning behövs. Samlingen är tom från början; inga exempeldata sparas åt användaren.

## Starta lokalt

Om Node.js finns installerat:

```sh
node scripts/serve.mjs
```

Öppna **http://localhost:5173**. Avsluta servern med Ctrl+C. En annan port kan anges med `node scripts/serve.mjs 8080`.

Alternativ med Python installerat:

```sh
python -m http.server 5173 --bind 127.0.0.1
```

Servern behövs bara för att leverera statiska filer, inte som appens backend. Webbhotellet behöver inte Node.js eller Python.

Öppna inte `index.html` direkt via `file://`. JavaScript-moduler, service workers och lagring behöver ett korrekt HTTP-origin. Service workers kräver dessutom HTTPS, med undantag för utveckling på localhost. En mobil behöver en riktig HTTPS-adress; `localhost` på telefonen pekar på telefonen själv.

Använd samma adress och port för din vanliga samling. `localhost`, `127.0.0.1`, olika portar, olika webbläsarprofiler och publicerade adresser har separata lagringsutrymmen.

## Koppla TMDB

1. Skapa ett konto på [The Movie Database](https://www.themoviedb.org/).
2. Gå till [kontots API-inställningar](https://www.themoviedb.org/settings/api), ansök om API-åtkomst för ditt privata projekt och följ TMDB:s aktuella instruktioner. API:et är kostnadsfritt för icke-kommersiell användning med korrekt attribution; TMDB:s villkor gäller.
3. Kopiera **API Read Access Token**. Använd den långa lästoken, inte API-nyckeln med 32 tecken, och lägg inte till ordet `Bearer`.
4. Öppna **Inställningar** i Min Filmhylla och klistra in token.
5. Låt **Kom ihåg token på den här enheten** vara av för sessionslagring. Slå på det endast om du vill spara token mellan sessioner.
6. Välj **Testa och använd token**. Appen kontrollerar token med ett HTTPS-anrop till TMDB och sparar den först efter godkänd kontroll.

Sessionslagring gäller normalt den aktuella fliken och överlever omladdning. Webbläsarens sessionsåterställning kan ibland återställa den. En ihågkommen token sparas i `localStorage`. Båda kan läsas av kod på samma origin och är **inte säkra hemligheter**. Använd en betrodd enhet och välj **Ta bort sparad token** när den inte ska användas. Token finns aldrig i källkoden eller i JSON-säkerhetskopior och loggas inte av appen.

Anrop görs med `Authorization: Bearer` och `cache: no-store`; service workern avstår från alla TMDB-API-anrop. Svensk information efterfrågas med `sv-SE`. Saknas svensk beskrivning eller titel görs ett kompletterande anrop med `en-US`. Sökning avbryter tidigare förfrågningar och väntar 350 ms efter inmatning. Resultat som redan hunnit bli inaktuella ignoreras.

Officiell dokumentation: [autentisering](https://developer.themoviedb.org/docs/authentication-application), [filmsökning](https://developer.themoviedb.org/reference/search-movie), [filmdetaljer](https://developer.themoviedb.org/reference/movie-details), [bildadresser](https://developer.themoviedb.org/docs/image-basics), [attribution och villkor](https://developer.themoviedb.org/docs/faq).

## Använd appen

- **Min samling:** visa sparade filmer, sök i svensk titel och originaltitel, filtrera stjärnor och sortera efter tillagda datum, betyg, titel eller utgivningsår.
- **Sök filmer:** välj en film, sätt stjärnor, skriv en valfri recension på högst 5 000 tecken och välj eller rensa datumet då du såg filmen. Nya filmer får dagens lokala datum som förslag.
- **Filmdetaljer:** öppna en sparad film för att redigera den. Ändringar sparas först när du trycker Spara. Samma TMDB-ID kan bara finnas en gång. Borttagning kräver bekräftelse.
- **Statistik:** antal filmer, snittbetyg, femstjärniga favoriter, betygsfördelning och sex högst betygsatta filmer. Uppdateras från den lokala samlingen. Flikar kan meddela varandra om ändringar när BroadcastChannel stöds.
- **Inställningar:** TMDB, import/export, beständig lagring, installation och radering av lokala data. Radera allt kräver att du skriver `RADERA` och bekräftar.

Stjärnorna är vanliga radioknappar: använd Tab för att gå till dem och piltangenter för att ändra betyg. Recensioner visas som text, aldrig som HTML. Osparade formulär skyddas vid intern navigering och uppdatering. Webbläsaren får även en `beforeunload`-varning, men kan välja att inte visa den, särskilt när en mobilapp stängs av operativsystemet.

## Lagring och säkerhetskopior

Databasen heter `min-filmhylla-db`, version 1. Objektlagret `movies` har `tmdbId` som unik nyckel. Filmtitel, originaltitel, utgivningsår, affisch- och bakgrundsbildsökväg, genrer, beskrivning, speltid, betyg, recension, tittdatum samt skapad/uppdaterad tid sparas. Filmmetadata behövs aldrig hämtas på nytt för en sparad film. Befintligt `createdAt` behålls vid ändringar och import; vanliga redigeringar uppdaterar `updatedAt`.

Data sparas **bara i den aktuella webbläsaren på den aktuella enheten**. Ingen automatisk synkronisering eller molnbackup finns. Privat surfning, rensade webbplatsdata, en borttappad enhet och ibland lagringsbrist kan radera data. Safari kan ha ytterligare begränsningar beroende på användning och installationssätt. Knappen för beständig lagring använder webbläsarens vanliga Storage API, om det stöds; den garanterar inte att data aldrig försvinner.

**Exportera regelbundet**, gärna efter varje filmkväll och alltid före en flytt eller uppdatering. Kontrollera att den nedladdade filen finns och spara en kopia på en trygg plats.

### Export

Välj **Inställningar → Exportera JSON**. Filnamnet blir exempelvis `min-filmhylla-2026-10-31.json`. Filen är UTF-8 och innehåller `schemaVersion: 1`, `exportedAt` och alla filmer i `movies`. Svenska tecken och radbrytningar bevaras. Bara dokumenterade filmfält exporteras; token följer inte med.

### Import och flytt till en annan enhet

1. Överför JSON-filen till den andra enheten på valfritt sätt.
2. Öppna appen där och välj **Inställningar → Importera JSON**.
3. Välj filen och granska antalet nya och uppdaterade filmer.
4. Bekräfta importen. Matchande TMDB-ID uppdateras med säkerhetskopians uppgifter och övriga filmer behålls. Befintlig skapandetid behålls.

Alla fält valideras före import, inklusive heltalsbetyg, datum, textlängder och bildsökvägar. Dubbla ID:n i filen avvisas. Importen skrivs i **en enda IndexedDB-transaktion**: vid transaktionsfel rullas ändringarna tillbaka. Filer över 25 MB eller 50 000 filmer avvisas för att undvika orimlig minnesbelastning. En misslyckad import raderar inga befintliga filmer. Importerade recensioner är vanlig text.

## Offline och installation

Besök appen online en gång och låt service workern installera appskalet. Därefter kan du öppna den offline, visa filmmetadata och betyg, redigera, ta bort filmer, visa statistik samt importera och exportera säkerhetskopior. För nya filmer och sökning behövs internet och en giltig token.

Affischer som redan laddats kan finnas i en separat cache med högst 80 bilder. Det är en begränsad cache, ingen permanent affischbackup. Saknade eller misslyckade bilder får en platshållare. Inga stora bildblobbar lagras i IndexedDB.

- **iPhone/iPad:** öppna HTTPS-adressen i Safari → Dela → Lägg till på hemskärmen. iOS har inte samma installationsdialog som Android. Safari och en hemskärmsapp kan ha skilda lagringsbeteenden; använd JSON för att flytta samlingen vid behov.
- **Android:** öppna HTTPS-adressen i Chrome → menyn → Installera app / Lägg till på startskärmen. Appens installationsknapp visas endast när webbläsaren faktiskt erbjuder installation.
- **Dator:** använd webbläsarens installationsval där det stöds. Annars fungerar appen som en vanlig webbplats.

Manifestet har PNG-ikoner på 192 och 512 pixlar, en maskbar 512-ikon och separat Apple touch-ikon. Inga onödiga enhetsbehörigheter begärs.

## Publicera på GitHub Pages

1. Lägg projektets filer i ett GitHub-repository, med `index.html` i roten. Lägg **aldrig** en riktig token eller din privata filmbackup i repositoryt.
2. Gå till repositoryts **Settings → Pages**.
3. Välj **Deploy from a branch**, din huvudgren och **/(root)**. Spara.
4. Öppna HTTPS-adressen som GitHub visar när publiceringen är klar, normalt `https://ditt-namn.github.io/min-filmhylla/`.
5. Ange din token i appens Inställningar. Importera din JSON-backup om du vill flytta en lokal samling.

Alla lokala adresser är relativa. Hashnavigering gör att även filmdetaljer fungerar på GitHub Pages utan särskilda serverregler. `.nojekyll` gör att filerna levereras utan Jekyll-bearbetning. Du kan också ladda upp samma filer till valfritt statiskt HTTPS-webbhotell. Node, tester och hjälpskript behöver inte publiceras; appen använder bara `index.html`, `css/`, `js/`, `assets/`, `sw.js` och manifestet.

Den här leveransen skapar lokala filer; ingen publicering eller uppladdning av din samling har gjorts.

## Uppdatera utan att radera samlingen

1. Exportera först en säkerhetskopia.
2. Uppdatera de statiska källfilerna och ändra `VERSION` i `sw.js` när appskalet ändras.
3. Publicera samtliga filer tillsammans på samma adress.
4. Besök appen. När den nya service workern är installerad visas en uppdateringsrad.
5. Spara pågående ändringar och välj **Uppdatera appen**. Ett osparat formulär kräver bekräftelse innan omladdning.

Service workern aktiverar inte en ny version automatiskt ovanpå ett öppet formulär. Den tar bara bort gamla cacheversioner med prefixet `min-filmhylla-shell-`, aldrig IndexedDB eller andra appars cacher. Framtida databasmigreringar ska göras i `onupgradeneeded` med höjd databasversion och bevarade objektlager. Radera inte databasen som ett sätt att uppdatera.

## Filer

```text
index.html                  Svenskt appskal och navigation
css/styles.css              Responsiv design och tillgänglighet
js/app.js                   Start och sidrendering
js/router.js                Hashnavigering och skydd av osparade ändringar
js/components.js            Säkra DOM-element, affischer, stjärnor, dialoger
js/db.js                    Versionerad IndexedDB och atomiska skrivningar
js/model.js                 Validering, sökning, sortering och statistik
js/movies.js                Samling, TMDB-sökning och filmredigering
js/tmdb.js                  TMDB-anrop och lokal tokenhantering
js/stats.js                 Statistik och diagram med HTML/CSS
js/settings.js              Inställningar och radering
js/backup.js                JSON-export och bekräftad import
js/pwa.js                   Installation och kontrollerade uppdateringar
manifest.webmanifest        PWA-inställningar
sw.js                       Appskal, offline-navigering, begränsad bildcache
assets/icons/               Lokala SVG- och PNG-ikoner, officiell TMDB-logotyp
scripts/serve.mjs            Valfri statisk utvecklingsserver utan beroenden
scripts/generate-icons.mjs   Valfritt verktyg för att återskapa PNG-ikoner
tests/*.test.mjs             Tester med Nodes inbyggda testverktyg
```

## Verifiering och begränsningar

Kör logik- och service worker-tester med Node.js 22 eller senare:

```sh
node --test tests/*.test.mjs
```

Ingen installation behövs. Vissa Node-versioner visar en ofarlig `MODULE_TYPELESS_PACKAGE_JSON`-varning eftersom appen använder webbläsarmoduler utan `package.json`; testerna körs ändå. Testerna använder syntetiska data och simulerade TMDB-svar, aldrig din filmhylla eller riktiga tokens. De kontrollerar importvalidering, svensk text, kalenderdatum, alla sorteringssätt, statistik, tokenlagring, HTTPS/Bearer-anrop, språkfallback, fel/avbrott, PWA-ikoner, appskalsfiler, cachebegränsning och offline-navigering i en simulerad service worker-miljö.

En interaktiv webbläsare var inte tillgänglig i byggmiljön. Faktisk mobilrendering, IndexedDB i Safari/Chrome, installation, verklig offline-start och fullständiga klickflöden kunde därför inte verifieras här. Ingen riktig TMDB-token tillhandahölls, så live-sökning återstår att verifiera med din egen token. Kör följande före skarp användning:

1. Starta servern och kontrollera samling, sökning, statistik och inställningar på 320, 375 och 430 pixlars bredd.
2. Ange en giltig TMDB-token, sök, välj en film och försök spara utan stjärnor. Välj sedan betyg, skriv en recension med radbrytning och spara.
3. Ladda om: film, betyg och recension ska finnas kvar. Sök fram samma film igen: den befintliga posten ska öppnas utan dubblett.
4. Ändra betyg och datum; prova lokal sökning, varje sortering och betygsfiltret. Kontrollera statistiken.
5. Exportera JSON. Importera filen, granska antalet uppdateringar och bekräfta. Prova också ogiltig JSON och dubbel-ID-fil; samlingen ska vara oförändrad vid fel.
6. Efter första onlinebesöket, ladda om så service workern kontrollerar sidan. Stäng av nätverket och öppna appen igen: redigera, exportera och kontrollera statistik. Alla affischer behöver inte finnas offline.
7. Kontrollera osparade ändringar med bakåtknappen, menylänkar och en väntande PWA-uppdatering. Kontrollera tangentbordsnavigation och radioknapparnas piltangenter.
8. Prova borttagning med bekräftelse på en egen testfilm. Prova total radering endast i en separat testprofil eller efter kontrollerad backup.

Lagring och service workers kan blockeras av privat läge, webbläsarinställningar eller en osäker HTTP-adress. Appen visar begripliga fel och använder ingen flyktig reservlagring som ger sken av att filmer sparats. TMDB kan ändra eller ta bort filmer och kan vara tillfälligt otillgängligt; redan sparad metadata ligger kvar. Appen har inget konto hos Min Filmhylla, men en egen TMDB-token kräver TMDB:s konto och villkor.

TMDB:s officiella, oförändrade logotyp hämtades från deras [officiella tillgångsserver](https://www.themoviedb.org/assets/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg). Den lagras lokalt för attribution, utan extern logotypförfrågan vid användning. This product uses the TMDB API but is not endorsed or certified by TMDB.
