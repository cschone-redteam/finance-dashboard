-- Trial Balance Analyzer — Supabase Migration
-- Run this in the Supabase SQL Editor after the initial migration

create table if not exists qbo_tokens (
  id uuid primary key default gen_random_uuid(),
  realm_id text not null unique,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists trial_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  year_month text not null,
  entity text not null,
  realm_id text not null,
  synced_at timestamptz not null default now(),
  unique (year_month, entity, realm_id)
);

create table if not exists trial_balance_rows (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references trial_balance_snapshots(id) on delete cascade,
  account_name text not null,
  account_type text not null,
  debit numeric not null default 0,
  credit numeric not null default 0,
  net_amount numeric not null default 0
);

create index idx_tb_rows_snapshot on trial_balance_rows(snapshot_id);

create table if not exists hs_revenue_summary (
  id uuid primary key default gen_random_uuid(),
  year_month text not null unique,
  deals_won int not null default 0,
  total_revenue numeric not null default 0,
  total_arr numeric not null default 0,
  synced_at timestamptz not null default now()
);

-- RLS policies (open access for single-user app)
alter table qbo_tokens enable row level security;
alter table trial_balance_snapshots enable row level security;
alter table trial_balance_rows enable row level security;
alter table hs_revenue_summary enable row level security;

create policy "Allow all access to qbo_tokens"
  on qbo_tokens for all using (true) with check (true);
create policy "Allow all access to trial_balance_snapshots"
  on trial_balance_snapshots for all using (true) with check (true);
create policy "Allow all access to trial_balance_rows"
  on trial_balance_rows for all using (true) with check (true);
create policy "Allow all access to hs_revenue_summary"
  on hs_revenue_summary for all using (true) with check (true);
