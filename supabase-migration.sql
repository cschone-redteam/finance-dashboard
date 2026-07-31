-- Month-End Close Tracker — Supabase Migration
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

create table if not exists close_periods (
  id uuid primary key default gen_random_uuid(),
  year_month text not null unique,
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  started_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists close_task_completions (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references close_periods(id) on delete cascade,
  step_index int not null,
  completed boolean not null default false,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (period_id, step_index)
);

create index idx_completions_period on close_task_completions(period_id);

alter table close_periods enable row level security;
alter table close_task_completions enable row level security;

create policy "Allow all access to close_periods"
  on close_periods for all
  using (true)
  with check (true);

create policy "Allow all access to close_task_completions"
  on close_task_completions for all
  using (true)
  with check (true);
