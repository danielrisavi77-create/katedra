# Post-payment mode routing — implementation plan

## Goal

Nakon aktivacije Passa korisnik bira jedan od dva odvojena načina rada za demo projekt:

- **Radionica rukopisa** — korisnik piše, a Katedra pomaže kroz chat, izvore i alate.
- **Autonomna izrada** — Katedra vodi cijeli sekvencijalni proces s agentima i verifikatorima.

Odabrani način rada sprema se po projektu i ne prikazuje se kao prekidač unutar drugog workspacea.

## Tasks

1. Dodati post-payment onboarding s dvije jasne opcije i disabled nastavkom dok korisnik ne odabere način.
2. Routing odluke spremiti u demo localStorage i vratiti korisnika u isti workspace nakon reloada.
3. U ručnom workspaceu ukloniti ulaz u autonomni način.
4. U autonomnom workspaceu prikazati samo autonomni panel i workflow kontrole.
5. Dodati reset projekta koji vraća izbor načina rada na onboarding.
6. Pokriti onboarding, reload, manual i autonomous lifecycle testovima.
7. Pokrenuti typecheck, lint, unit testove, build i lokalni browser smoke test.

## Acceptance criteria

- Novi demo projekt prvo traži izbor između dva načina.
- Bez izbora nije moguće nastaviti.
- Manual workspace nema gumb za autonomnu izradu.
- Autonomous workspace nema editor, outline ni manualne AI alate.
- Refresh zadržava odabrani način rada.
- Reset briše izbor i vraća onboarding.
- Autonomni rezultat se i dalje prihvaća eksplicitno kao nova lokalna revizija.
