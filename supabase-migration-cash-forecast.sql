-- Cached cash forecast data from QBO
-- Stores monthly outflow/receipt breakdowns as JSONB

create table if not exists cash_forecast_cache (
  id uuid primary key default gen_random_uuid(),
  realm_id text not null unique,
  months jsonb not null default '[]',
  synced_at timestamptz default now()
);

create index idx_cash_forecast_realm on cash_forecast_cache(realm_id);
