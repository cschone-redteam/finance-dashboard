CREATE TABLE IF NOT EXISTS pl_function_cache (
  realm_id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);
