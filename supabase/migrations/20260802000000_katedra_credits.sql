-- ============================================================
-- KATEDRA — krediti, uplate, potrošnja (v1)
-- Model: 1 "kredit" = 1 obračunski token (input + 5×output,
-- jer je output ~5× skuplji). Sve mijenja ISKLJUČIVO server
-- (service role) — klijent smije samo čitati svoje stanje.
-- ============================================================

create table if not exists katedra_wallets (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  balance     bigint not null default 0 check (balance >= 0),
  updated_at  timestamptz not null default now()
);

create table if not exists katedra_topups (
  id                 bigint generated always as identity primary key,
  user_id            uuid not null references auth.users(id) on delete cascade,
  stripe_session_id  text not null unique,          -- idempotencija webhooka
  tokens             bigint not null check (tokens > 0),
  amount_eur         numeric(8,2) not null,
  created_at         timestamptz not null default now()
);

create table if not exists katedra_usage (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  model          text not null,
  input_tokens   integer not null default 0,
  output_tokens  integer not null default 0,
  charged        bigint not null default 0,          -- input + 5*output
  created_at     timestamptz not null default now()
);
create index if not exists katedra_usage_user_time on katedra_usage(user_id, created_at desc);

-- ---------- RLS: klijent čita SVOJE, ne piše ništa ----------
alter table katedra_wallets enable row level security;
alter table katedra_topups  enable row level security;
alter table katedra_usage   enable row level security;

create policy "own wallet read"  on katedra_wallets for select using (auth.uid() = user_id);
create policy "own topups read"  on katedra_topups  for select using (auth.uid() = user_id);
create policy "own usage read"   on katedra_usage   for select using (auth.uid() = user_id);
-- (bez insert/update/delete politika → klijent ne može mijenjati ništa)

-- ---------- RPC: atomsko skidanje kredita ----------
create or replace function katedra_consume(p_user uuid, p_charged bigint,
                                           p_model text, p_in int, p_out int)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v_balance bigint;
begin
  insert into katedra_wallets(user_id, balance) values (p_user, 0)
    on conflict (user_id) do nothing;

  update katedra_wallets
     set balance = greatest(balance - p_charged, 0), updated_at = now()
   where user_id = p_user
   returning balance into v_balance;

  insert into katedra_usage(user_id, model, input_tokens, output_tokens, charged)
  values (p_user, p_model, p_in, p_out, p_charged);

  return v_balance;
end $$;

-- ---------- RPC: dodavanje kredita (webhook, idempotentno) ----------
create or replace function katedra_grant(p_user uuid, p_tokens bigint,
                                         p_session text, p_amount numeric)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v_balance bigint;
begin
  -- idempotencija: ista Stripe sesija smije proći samo jednom
  insert into katedra_topups(user_id, stripe_session_id, tokens, amount_eur)
  values (p_user, p_session, p_tokens, p_amount)
  on conflict (stripe_session_id) do nothing;

  if not found then
    select balance into v_balance from katedra_wallets where user_id = p_user;
    return coalesce(v_balance, 0);
  end if;

  insert into katedra_wallets(user_id, balance) values (p_user, p_tokens)
  on conflict (user_id)
  do update set balance = katedra_wallets.balance + excluded.balance, updated_at = now()
  returning balance into v_balance;

  return v_balance;
end $$;

-- RPC-ove smije zvati samo service role (server):
revoke execute on function katedra_consume(uuid, bigint, text, int, int) from public, anon, authenticated;
revoke execute on function katedra_grant(uuid, bigint, text, numeric)   from public, anon, authenticated;
