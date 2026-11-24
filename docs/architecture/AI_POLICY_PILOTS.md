# Verificirani AI policy piloti

`public/katedra-process-facts.json` trenutačno sadrži samo dva duboka pilota. Ne predstavlja opću tvrdnju za sve ustanove u katalogu.

## FPZG

- Izvor: [Smjernice za uporabu generativne umjetne inteligencije u nastavi i izradi studentskih radova](https://www.fpzg.unizg.hr/_download/repository/Smjernice%20za%20uporabu%20generativne%20umjetne%20inteligencije%20u%20nastavi%20i%20izradi%20studentskih%20radova_21.5.2026.pdf)
- Datum donošenja: 21. 5. 2026.
- Datum provjere: 22. 8. 2026.
- Ključna granica: pomoćne radnje poput literature, jezične provjere i prijevoda dopuštene su uz provjeru i transparentnost; generiranje dijelova ili cijelih studentskih radova nije dopušteno.
- Parafraziranje za predaju i simulator obrane ostaju `unspecified` jer izvor ne daje dovoljno precizno pozitivno dopuštenje za te dvije konkretne radnje. Katedra ih zato ne tretira kao automatski dopuštene.

## FOI

- Izvor: [Smjernice za korištenje umjetne inteligencije u nastavi i studentskim radovima](https://www.foi.unizg.hr/sites/default/files/smjernice_za_koristenje_umjetne_inteligencije_u_nastavi_i_studentskim_radovima_suzg_foi.pdf)
- Službena stranica dokumenta: [FOI dokument](https://www.foi.unizg.hr/hr/dokument/smjernice-za-koristenje-umjetne-inteligencije-u-nastavi-i-studentskim-radovima)
- Datum kreiranja/objave: 20. 2. 2026.
- Datum stupanja na snagu: izvor ga ne navodi zasebno; aplikacija to prikazuje otvoreno korisniku.
- Datum provjere: 22. 8. 2026.
- Ključna granica: završni i diplomski radovi u osnovi su razina 0. Mentor može odobriti višu razinu kada je to opravdano, uz provjeru, dokumentiranje i transparentno referenciranje.

## Model odluke

`resolveCapability()` je zajednički resolver za server i klijentski prikaz. `explainCapability()` vraća samo odluku, kratko objašnjenje, obaveze, status i poveznicu na izvor; ne vraća privatni rukopis niti cijeli dokument politike.

Ako izvor ne odgovara izričito na konkretnu radnju, zapis ostaje `unspecified`, a generiranje se blokira. `partial`, `research` ili `generic` akademski profili ne dobivaju verified AI-policy status samo zato što postoji fakultetski zapis u ovom artifactu.
