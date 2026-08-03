-- Cached AR aging snapshots from QBO
-- Stores parsed invoice rows as JSONB so non-QBO users can view

create table if not exists ar_aging_cache (
  id uuid primary key default gen_random_uuid(),
  realm_id text not null unique,
  realm_label text,
  report_date text not null,
  rows jsonb not null default '[]',
  total_customers int default 0,
  synced_at timestamptz default now()
);

create index idx_ar_aging_realm on ar_aging_cache(realm_id);
