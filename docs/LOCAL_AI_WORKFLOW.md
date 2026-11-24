# Lokalni workflow: Claude Code + Grok

Pokreni `Katedra-AI.cmd` dvoklikom i upisi razvojni zadatak. Alternativno, iz
PowerShella u projektu:

```powershell
.\scripts\local-ai-workflow.ps1 -Task 'Popravi opisani problem i dodaj regresijski test'
```

Za pregled koraka bez AI poziva i bez pokretanja provjera:

```powershell
.\scripts\local-ai-workflow.ps1 -DryRun
```

## Redoslijed

1. Provjera dostupnosti `git`, `node`, `npm`, `claude` i `grok` te Git status.
2. Interaktivni Claude Code: implementacija zadanog zadatka uz pravila projekta.
   Pregledaj njegove prijedloge i dozvole. Kada zavrsi, izadji iz sesije
   naredbom `/exit` kako bi workflow nastavio.
3. Interaktivni Grok u `plan` permission nacinu: pregled zadatka i lokalnih
   promjena, ukljucujuci nove datoteke. Nakon pregleda izadji iz sesije.
4. `npm run typecheck`, `npm run lint`, `npm run test:ci`, `npm run build`.
   Prvi neuspjesan korak prekida workflow s izlaznim kodom 1.

Lint i Vitest konfiguracije iskljucuju `.worktrees/`: zasebni checkoutovi
provjeravaju se iz vlastitih direktorija, a ne kao dio ove Katedra sesije.

Grok treba navesti probleme, datoteke, ozbiljnost i preostale rizike. Njegov
izlazni kod 0 znaci samo da je sesija zavrsila; nije odobrenje koda. Ako nadje
probleme, popravi ih novim zadatkom i ponovi pregled i provjere. Za UI ili
integracijske promjene dodatno pokreni odgovarajuce localhost/browser provjere
prema `AGENTS.md`.

## Preduvjeti i granice

- Windows PowerShell 5.1 ili PowerShell 7, Node/npm i Git.
- Instalirani i prijavljeni Claude Code i sluzbeni `@xai-official/grok` CLI.
  Prijavu dovrsi zasebnim pokretanjem `claude` i `grok`. Workflow ne sprema
  kljuceve i koristi postojece CLI postavke modela i racuna.
- Lokalno znaci da se orkestracija i izmjene izvode na ovom racunalu.
  AI alati salju odabrani kontekst svojim servisima i koriste tvoj racun/kvotu.
- Skripta sama ne izvodi checkout, stash, reset, commit, push, merge ni deploy.
  Prije implementacije odaberi razvojnu granu; postojece izmjene ostaju na
  mjestu. Na prljavom working treeju oba alata vide i raniji rad: prompt ih
  upucuje da ga sacuvaju i ne pripisuju ovom zadatku.
- CLI dozvole ostaju interaktivne. Grokov `plan` nacin sluzi pregledu; nije
  dodatni izolirani filesystem sandbox. Postojece CLI postavke i integracije
  i dalje vrijede. Ne odobravaj radnje izvan zadanog opsega.
- Promptovi upucuju alate da ne citaju tajne ni studentske rukopise te da
  postuju Lekta authority, project entitlements i release gateove.
- Workflow ne stvara dodatne transkripte ni datoteke s diffom. Sami CLI alati
  mogu cuvati povijest sesija prema svojim postavkama.

`Katedra-Claude.cmd` i `Katedra-Zavrsi.cmd`, ako ih koristis, ostaju zasebni
postojeci alati. Novi workflow ne poziva skriptu za objavu.
