-- SaaS Metrics Dashboard — Supabase Migration
-- Run this in the Supabase SQL Editor

create table if not exists quarterly_deal_metrics (
  id uuid primary key default gen_random_uuid(),
  quarter text not null unique,
  new_business_arr numeric not null default 0,
  new_business_count int not null default 0,
  renewal_arr numeric not null default 0,
  renewal_count int not null default 0,
  expiring_arr numeric not null default 0,
  expansion_arr numeric not null default 0,
  expansion_count int not null default 0,
  churned_arr numeric not null default 0,
  churned_count int not null default 0,
  total_closed_arr numeric not null default 0,
  total_closed_count int not null default 0,
  synced_at timestamptz not null default now()
);

create table if not exists quarterly_pnl (
  id uuid primary key default gen_random_uuid(),
  quarter text not null unique,
  revenue numeric not null default 0,
  cogs numeric not null default 0,
  gross_profit numeric not null default 0,
  operating_expenses numeric not null default 0,
  net_income numeric not null default 0,
  interest numeric not null default 0,
  taxes numeric not null default 0,
  depreciation_amortization numeric not null default 0,
  ebitda numeric not null default 0,
  synced_at timestamptz not null default now()
);

alter table quarterly_deal_metrics enable row level security;
alter table quarterly_pnl enable row level security;

create policy "Allow all access to quarterly_deal_metrics"
  on quarterly_deal_metrics for all using (true) with check (true);
create policy "Allow all access to quarterly_pnl"
  on quarterly_pnl for all using (true) with check (true);

NOTIFY pgrst, 'reload schema';
