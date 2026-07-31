-- Cadence task completions — tracks which recurring activity tasks are checked off
create table if not exists cadence_task_completions (
  id uuid primary key default gen_random_uuid(),
  task_id text not null unique,
  completed_at timestamptz default now()
);

-- RLS
alter table cadence_task_completions enable row level security;
create policy "Allow all access to cadence_task_completions"
  on cadence_task_completions for all using (true) with check (true);
