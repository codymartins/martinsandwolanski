-- M&W dashboard: initial schema
-- Amounts are integer cents, signed from M&W's point of view (+ in, - out).

-- ---------- Reference tables ----------

create table owners (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  email text not null unique,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table ventures (
  id text primary key,            -- slug
  name text not null,
  sort_order int not null default 0
);

insert into ventures (id, name, sort_order) values
  ('websites',  'Websites (Web Systems Group)', 1),
  ('vending',   'Pokemon Vending',              2),
  ('cashouts',  'Cashouts',                     3),
  ('reselling', 'Reselling',                    4),
  ('general',   'General / Overhead',           5);

create type account_kind as enum (
  'llc_bank', 'llc_card', 'personal_card', 'stripe', 'nayax', 'venmo', 'cash'
);

create table accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind account_kind not null,
  owner_id uuid references owners(id),     -- required for personal cards
  last4 text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint personal_card_has_owner
    check (kind <> 'personal_card' or owner_id is not null)
);

-- ---------- Deals (cashouts and reselling) ----------

create type deal_status as enum ('open', 'sold', 'closed');

create table deals (
  id uuid primary key default gen_random_uuid(),
  venture_id text not null references ventures(id),
  title text not null,
  status deal_status not null default 'open',
  opened_on date not null default current_date,
  closed_on date,
  notes text,
  created_by uuid references owners(id),
  created_at timestamptz not null default now(),
  constraint deal_venture check (venture_id in ('cashouts', 'reselling', 'vending'))
);

-- ---------- The ledger ----------

create type txn_kind as enum (
  'revenue',               -- sale / income
  'expense',               -- cost of goods, fees, subscriptions, overhead
  'refund',                -- refund given or received (counts in P&L)
  'transfer',              -- moving money between M&W accounts (excluded from P&L)
  'member_reimbursement',  -- M&W paying an owner back (reduces owed balance)
  'member_contribution',   -- owner putting money into M&W
  'member_distribution'    -- M&W paying profit out to an owner
);

create type txn_source as enum (
  'manual', 'quickbooks', 'stripe', 'nayax', 'venmo_csv'
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  occurred_on date not null,
  amount_cents bigint not null check (amount_cents <> 0),
  kind txn_kind not null,
  account_id uuid not null references accounts(id),
  venture_id text references ventures(id),           -- null = needs review
  category text,
  description text,
  merchant text,
  deal_id uuid references deals(id) on delete set null,
  counterparty_owner_id uuid references owners(id),  -- for member_* kinds
  source txn_source not null default 'manual',
  external_id text,                                  -- id in the source system
  needs_review boolean not null default false,
  notes text,
  created_by uuid references owners(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id),
  constraint member_kinds_need_owner check (
    kind not in ('member_reimbursement', 'member_contribution', 'member_distribution')
    or counterparty_owner_id is not null
  ),
  constraint sign_matches_kind check (
    (kind = 'revenue' and amount_cents > 0)
    or (kind = 'expense' and amount_cents < 0)
    or (kind = 'member_reimbursement' and amount_cents < 0)
    or (kind = 'member_distribution' and amount_cents < 0)
    or (kind = 'member_contribution' and amount_cents > 0)
    or kind in ('refund', 'transfer')
  )
);

create index transactions_occurred_on_idx on transactions (occurred_on);
create index transactions_venture_idx on transactions (venture_id);
create index transactions_deal_idx on transactions (deal_id);
create index transactions_review_idx on transactions (needs_review) where needs_review;

-- ---------- Subscriptions ----------

create type cadence as enum ('monthly', 'quarterly', 'yearly');

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  vendor text,
  amount_cents bigint not null check (amount_cents > 0),
  cadence cadence not null default 'monthly',
  venture_id text not null references ventures(id) default 'general',
  account_id uuid references accounts(id),
  next_renewal date,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- Sync plumbing ----------

create table categorization_rules (
  id uuid primary key default gen_random_uuid(),
  priority int not null default 100,         -- lower runs first
  match_field text not null check (match_field in ('description', 'merchant', 'source')),
  pattern text not null,                     -- case-insensitive substring
  set_venture_id text references ventures(id),
  set_category text,
  set_kind txn_kind,
  active boolean not null default true
);

create table sync_runs (
  id bigint generated always as identity primary key,
  source txn_source not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'ok', 'error')),
  rows_upserted int,
  error text
);

-- Encrypted at rest by Supabase; only the service role reads this.
create table integration_tokens (
  source txn_source primary key,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- Views ----------

-- What M&W owes each owner: personal-card purchases minus reimbursements.
create view member_balances with (security_invoker = true) as
select
  o.id as owner_id,
  o.name,
  p.purchased_cents,
  r.reimbursed_cents,
  p.purchased_cents - r.reimbursed_cents as owed_cents
from owners o
cross join lateral (
  select coalesce(sum(-t.amount_cents), 0) as purchased_cents
  from transactions t
  join accounts a on a.id = t.account_id
  where a.kind = 'personal_card' and a.owner_id = o.id
) p
cross join lateral (
  select coalesce(sum(-t.amount_cents), 0) as reimbursed_cents
  from transactions t
  where t.kind = 'member_reimbursement' and t.counterparty_owner_id = o.id
) r;

-- Monthly P&L per venture (excludes transfers and owner money movements).
create view venture_monthly_pnl with (security_invoker = true) as
select
  date_trunc('month', occurred_on)::date as month,
  coalesce(venture_id, 'unassigned') as venture_id,
  sum(amount_cents) filter (where amount_cents > 0) as revenue_cents,
  -sum(amount_cents) filter (where amount_cents < 0) as expense_cents,
  sum(amount_cents) as profit_cents
from transactions
where kind in ('revenue', 'expense', 'refund')
group by 1, 2;

-- Profit per deal.
create view deal_summary with (security_invoker = true) as
select
  d.*,
  coalesce(sum(t.amount_cents) filter (where t.amount_cents < 0 and t.kind = 'expense'), 0) * -1 as cost_cents,
  coalesce(sum(t.amount_cents) filter (where t.kind = 'revenue'), 0) as sales_cents,
  coalesce(sum(t.amount_cents) filter (where t.kind in ('revenue', 'expense', 'refund')), 0) as profit_cents
from deals d
left join transactions t on t.deal_id = d.id
group by d.id;

-- ---------- Row-level security: only the three owners ----------

create function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from owners where auth_user_id = auth.uid());
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'owners', 'ventures', 'accounts', 'deals', 'transactions',
    'subscriptions', 'categorization_rules', 'sync_runs'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy owners_all on %I for all to authenticated using (is_owner()) with check (is_owner())',
      t
    );
  end loop;
end $$;

-- No policies on integration_tokens: service role only.
alter table integration_tokens enable row level security;

-- Keep updated_at fresh.
create function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger transactions_touch before update on transactions
  for each row execute function touch_updated_at();
