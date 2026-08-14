# Lekta handoff: Katedra production RPCs

Ovaj dokument je implementacijski handoff za vlasnika Lekta Supabase schema.
Katedra ga ne primjenjuje iz ovog repozitorija.

## Važna napomena o postojećem Lekta API-ju

U Lekta repozitoriju i povezanoj live bazi postoje:

- `completion_ai_reserve(...)`;
- `completion_ai_finalize(...)`;
- `completion_ai_usage`.

To nije dovoljan Katedrin billing contract. Postojeće funkcije:

- zahtijevaju `completion_tasks` red i capability enum;
- vraćaju usage UUID, ne Katedrin idempotentni settlement status;
- ne identificiraju pokušaj preko Katedrinog `requestId`-a;
- ne rade atomic wallet debit;
- ne pokrivaju withdrawal reservation.

Ne uključivati `KATEDRA_BILLING_RPC_CONTRACT=v2` samo zato što su ove funkcije
deployane.

## Obavezni Katedra ugovori

Lekta treba dodati i testirati sljedeće funkcije u canonical Supabase projektu:

```text
katedra_authorize_project_ai(p_user uuid, p_project_id uuid)
  -> { status, balance }
katedra_reserve_request(p_user uuid, p_request_id uuid, p_estimated_charge bigint)
  -> { status: reserved | concurrency | rate }
katedra_release_request(p_user uuid, p_request_id uuid)
  -> idempotent release result
katedra_consume(p_user uuid, p_project_id uuid, p_request_id uuid,
  p_charged bigint, p_model text, p_in integer, p_out integer)
  -> { status: settled | already_settled }
katedra_reserve_withdrawal(p_user uuid, p_reference_id text)
  -> { status: reserved | duplicate | rate }
katedra_release_withdrawal(p_user uuid, p_reference_id text)
  -> idempotent release result
katedra_commit_withdrawal(p_user uuid, p_reference_id text, p_request_id uuid)
  -> { status: committed | already_committed }
```

## Required guarantees

- `katedra_consume` je atomic i idempotentan na `(user_id, request_id)`.
- Request ne može settleati za drugog korisnika ili projekt.
- Ponavljanje settlementa nikad ne radi drugi debit.
- Reservation pokriva konkurentne tabove, instance, rolling limit i dnevni
  cost ceiling.
- Release je idempotentan i siguran kod provider failurea ili prekida streama.
- Withdrawal reference je jedinstven po korisniku i preživljava restart procesa.
- Nepoznati RPC ishodi su reconcilable i nikad se ne tretiraju kao uspjeh.
- Browser roleovi ne mogu izvršavati ove funkcije.

## Dokaz prije uključivanja flagova

Staging mora dokazati:

1. dva paralelna settlementa s istim `requestId`-om;
2. ponovljeni settlement nakon uspjeha;
3. nedostatan balance;
4. projekt A nasuprot projektu B;
5. devet paralelnih AI zahtjeva i dva taba;
6. prekinuti stream i provider failure release;
7. duplicirani withdrawal reference;
8. commit retry nakon timeouta.

Tek nakon toga smiju se uključiti:

```text
KATEDRA_BILLING_RPC_CONTRACT=v2
KATEDRA_RATE_LIMIT_STORE=supabase
```
