# Agenticni tijek izrade akademskog rada

## Cilj

Katedra treba korisniku omogućiti da od početnih podataka, vlastitih materijala i odabranog Passa dođe do provjerenog nacrta akademskog rada. Sustav nije jedan chatbot, nego orkestrirani radni proces s jasno odvojenim agentima i verifikatorima.

Korisnik može birati između vođenog rada, ubrzanog rada i potpuno automatskog procesa. U automatskom načinu korisnik ne potvrđuje svaki odlomak, ali sustav radi u verzijama, čuva izvorni rukopis i zaustavlja korake koji ne zadovoljavaju provjeru izvora ili druga pravila projekta.

## Granica između besplatnog onboardinga i plaćene usluge

Početni onboarding ostaje kratak i služi samo za osnovni kontekst:

- fakultet i smjer;
- vrsta rada;
- tema;
- mentor;
- rok;
- početno stanje rada.

Upload materijala, detaljna analiza, izbor agenata, istraživanje literature i generiranje rada otključavaju se tek nakon odabira i uspješne naplate odgovarajućeg Katedra Passa.

## Pass i zaključavanje projekta

Svaki Pass vrijedi samo za jedan konkretan `projectId`. Ne može se premjestiti na drugi projekt niti se može koristiti za drugi rad istog korisnika.

Pass je vezan uz zaključani snapshot:

- korisnika;
- projekta;
- vrste rada;
- fakulteta i smjera;
- teme;
- plaćenog opsega usluge;
- dostupnih agenata;
- trajanja i limita potrošnje.

Prije Stripe checkouta korisnik mora vidjeti obaveznu potvrdu:

> **VAŽNO**  
> Ovaj Pass vrijedi samo za jedan projekt i jednu potvrđenu temu. Nakon naplate tema, vrsta rada i projekt ne mogu se promijeniti. Za drugu temu potrebno je otvoriti novi projekt i kupiti novi Pass.

Korisnik mora potvrditi da su podaci točni. Server ponovno provjerava iste uvjete nakon webhooka; zaključavanje ne smije ovisiti samo o klijentskom sučelju.

Nakon naplate tema je potpuno zaključana. Za drugi rad korisnik mora otvoriti novi projekt i kupiti novi Pass.

## Paketi i entitlementi

Pass/pretplata se određuje prema vrsti rada i odabranom opsegu, primjerice:

- seminarski rad;
- završni rad;
- diplomski rad;
- istraživanje literature;
- planiranje i struktura;
- pojedino poglavlje;
- cijeli proces od analize do DOCX-a;
- recenzija i poboljšanje.

Entitlement repository ostaje canonical mjesto za server-side provjeru dostupnih agenata, limita i faza. Klijent ne smije sam otključati agenta ili promijeniti plaćeni opseg.

## Vrste materijala

Nakon aktivacije Passa korisnik može dodati:

- `.docx`;
- `.pdf`;
- `.txt`;
- `.md`;
- slike i skenirane dokumente kroz OCR;
- literaturu, mentorove upute, pravilnike, bilješke i postojeći draft.

Primarna kopija osjetljivih materijala ostaje lokalno na korisničkom uređaju. Server i AI provider dobivaju samo materijal potreban za konkretnu obradu. Puni akademski tekst ne sprema se automatski u shared backend ili tehničke logove.

Svaki materijal ima status ekstrakcije:

- `pending`;
- `processing`;
- `extracted`;
- `partial`;
- `failed`;
- `needs_review`.

Prije početka pisanja Intake Agent i njegov verifikator moraju potvrditi da je tekst ispravno pročitan. Nečitki, nepotpuni ili sumnjivi dijelovi moraju biti vidljivi korisniku.

## Orkestracija agenata

Korisnik može koristiti jednu Katedru, vidljivi radni tim ili prilagođeni izbor agenata. U pozadini postoji jedan Orchestrator koji upravlja redoslijedom, stanjem, limitima, verzijama i pokušajima popravka.

### Primarni agenti

1. **Intake Agent** analizira projektne podatke i učitane materijale.
2. **Source Agent** organizira postojeću literaturu i, ako je dopušteno, istražuje dodatne izvore.
3. **Structure Agent** izrađuje ili analizira sadržaj i može ponuditi alternativu.
4. **Planning Agent** pretvara strukturu u izvediv redoslijed zadataka.
5. **Writing Agent** piše odabrane sekcije ili cijeli rad po sekvencijalnim poglavljima.
6. **Citation Agent** povezuje tvrdnje s provjerenim izvorima.
7. **Review Agent** provjerava logiku, argumentaciju, ponavljanja, stil i mentorove zahtjeve.
8. **Export Agent** priprema DOCX, dok Lekta ostaje tehnički i compliance autoritet.

### Verifikatori

Svaki primarni agent ima zaseban verifikator. Verifikator ne prepisuje rezultat agenta, nego vraća dokaziv ishod:

- `verified`;
- `needs_revision`;
- `blocked`;
- `failed`.

Verifikatori provjeravaju rezultat prema ugovoru agenta, ulaznim materijalima, pravilima projekta i dostupnim izvorima. Za tvrdnju bez pouzdanog izvora pisanje se zaustavlja; ne koriste se placeholderi poput “potreban izvor”.

Na kraju procesa postoji centralni Quality Gate koji provjerava cijeli rezultat prije izvoza.

## Načini rada

### Vođeni način

Korisnik potvrđuje rezultate pojedinih agenata i može uređivati plan prije sljedeće faze.

### Ubrzani način

Agent obrađuje veću cjelinu, primjerice plan ili više poglavlja. Korisnik potvrđuje cijelu fazu umjesto svakog odlomka.

### Potpuno automatski način

Korisnik pokreće cijeli proces bez potvrđivanja svakog dijela. Proces se korisniku prikazuje kao jedna radnja, ali se interno izvršava sekvencijalno po fazama i poglavljima.

Automatski proces može se pauzirati, nastaviti nakon zatvaranja aplikacije i vratiti na prethodnu verziju. Izvorni rukopis se nikad ne prepisuje bez stvaranja nove verzije.

## Odnos prema postojećoj strukturi

Ako korisnik dostavi sadržaj ili mentoru odobrenu strukturu, može odabrati:

- slijedi postojeću strukturu;
- slijedi je i upozori na probleme;
- izradi alternativu za usporedbu i odabir.

Katedra ne smije samostalno zamijeniti odobrenu strukturu u korisnikovom glavnom rukopisu.

## Politika izvora

Korisnik nakon aktivacije Passa bira:

- samo učitane izvore;
- učitane izvore i prijedloge dodatnih izvora;
- samostalno istraživanje dodatne literature.

U sva tri slučaja svaki izvor mora imati porijeklo, bibliografske podatke, relevantnost i status provjere. Ako agent ne može potvrditi izvor za tvrdnju, korak se blokira.

## Tijek rada

```text
aktivacija Passa
  → upload i ekstrakcija materijala
  → Intake analiza
  → provjera materijala
  → izvori
  → struktura
  → plan
  → pisanje po poglavljima
  → provjera izvora i sadržaja
  → recenzija
  → Quality Gate
  → DOCX
  → Lekta
```

Svaki run ima stanje:

- `pending`;
- `running`;
- `verified`;
- `retrying`;
- `blocked`;
- `failed`;
- `completed`.

Korisnik vidi aktivnu fazu, agenta, verifikatora, potrošnju, razlog blokade i sljedeću radnju.

## Automatski popravci

Ako verifikator odbije rezultat, primarni agent dobiva strukturirani popis problema i može pokušati popravak najviše tri puta.

Pravila:

- svaki pokušaj ima vlastiti rezultat i billing trag;
- nema beskonačnog ponavljanja;
- treći neuspjeh blokira korak;
- korisnik tada može dopuniti materijale, promijeniti dopuštene izvore, promijeniti način rada ili zatražiti novi pokušaj ako Pass to dopušta;
- blokirani korak ne smije biti predstavljen kao dovršen.

## Naplata i billing sigurnost

Svaki AI pokušaj mora imati točno jedan billing ishod: `settled`, `released` ili `pending_reconciliation`. To vrijedi i za prekinuti stream, provider 500/429, timeout i zatvoren browser.

Orchestrator mora koristiti atomic reservation/concurrency kontrolu postojećeg AI billing sloja. Klijent ne smije moći pokrenuti paralelne radove iz više tabova i zaobići limit Passa ili walleta.

U tehničke logove spremaju se samo `projectId`, `runId`, agent, verifikator, status, trajanje, model i potrošnja. Puni akademski tekst i sirovi uploadi ne spremaju se u shared logove.

## Verzije i rukopis

Automatski rezultat se sprema kao nova verzija rukopisa ili radne grane. Mora biti moguće:

- usporediti rezultat s izvornim rukopisom;
- prihvatiti cijelu novu verziju;
- prihvatiti samo odabrana poglavlja;
- vratiti prethodnu verziju;
- nastaviti rad nakon pauze.

AI ne smije tiho prepisati korisnikov tekst.

## Testiranje i kriteriji prihvaćanja

Obavezni testovi pokrivaju:

- upozorenje i potvrdu teme prije checkouta;
- server-side zaključavanje teme i `projectId` nakon webhooka;
- pokušaj korištenja Passa na drugom projektu;
- upload, DOCX/PDF/TXT/MD ekstrakciju i OCR status;
- Intake agenta i njegovog verifikatora;
- svakog primarnog agenta i pripadajućeg verifikatora;
- tri pokušaja automatskog popravka;
- blokadu tvrdnje bez provjerenog izvora;
- vođeni, ubrzani i potpuno automatski način;
- pauziranje, nastavak i zatvaranje browsera tijekom runa;
- paralelne tabove, wallet, rate limit i billing finalizaciju;
- očuvanje izvornog rukopisa i vraćanje verzije;
- DOCX izvoz i Lekta handoff.

Sustav se smatra spremnim kada korisnik može aktivirati Pass za jedan projekt, učitati materijale, odabrati način rada, dobiti plan, generirati i provjeriti rad kroz agente, nastaviti proces nakon prekida, izvesti DOCX i poslati ga u Lektu — bez mogućnosti promjene zaključane teme ili korištenja istog Passa za drugi rad.

## Izvan opsega ove specifikacije

- automatsko mijenjanje zaključane teme;
- korištenje jednog Passa na više projekata;
- spremanje punog rukopisa u shared backend kao canonical kopije;
- zamjena Lekte u tehničkoj provjeri DOCX-a;
- automatsko proglašavanje rada spremnim za predaju bez korisničkog pregleda i Lekta provjere;
- implementacija prije odobrenog tehničkog plana.
