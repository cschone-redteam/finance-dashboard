-- Monthly financial snapshots for P&L and Balance Sheet
-- Stores parsed QBO report data as structured JSONB

create table if not exists monthly_financials (
  id uuid primary key default gen_random_uuid(),
  year_month text not null,
  entity text not null default 'RTS',
  report_type text not null check (report_type in ('pnl', 'bs')),
  line_items jsonb not null default '{}',
  raw_sections jsonb,
  synced_at timestamptz default now(),
  unique (year_month, entity, report_type)
);

create index idx_monthly_financials_ym on monthly_financials(year_month);
create index idx_monthly_financials_entity on monthly_financials(entity);

-- ARR rollforward stored monthly (from HubSpot deal metrics)
create table if not exists monthly_arr (
  id uuid primary key default gen_random_uuid(),
  year_month text not null unique,
  beginning_arr numeric default 0,
  new_business numeric default 0,
  expansion numeric default 0,
  churn numeric default 0,
  ending_arr numeric default 0,
  logo_count_beg int default 0,
  logo_count_end int default 0,
  new_logos int default 0,
  churned_logos int default 0,
  synced_at timestamptz default now()
);

create index idx_monthly_arr_ym on monthly_arr(year_month);
