-- Cadence task notes — user-editable notes per task
-- Run this in the Supabase Dashboard SQL editor

create table if not exists cadence_task_notes (
  id uuid primary key default gen_random_uuid(),
  task_id text not null unique,
  note text not null default '',
  updated_at timestamptz default now()
);

alter table cadence_task_notes enable row level security;

create policy "Allow all access to cadence_task_notes"
  on cadence_task_notes for all using (true) with check (true);
