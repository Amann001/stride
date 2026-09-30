-- Per-category features: step counts, top speed, fastest efforts and achievements.
-- Existing activities get their best efforts, top speed and achievements filled in by
-- the backfill step in migrate.ts, which runs right after this file.

ALTER TABLE activities
  ADD COLUMN steps         integer,
  ADD COLUMN max_speed_mps real NOT NULL DEFAULT 0,
  -- [{distanceMeters, seconds}, ...]. NULL means "not analysed yet".
  ADD COLUMN best_efforts  jsonb,
  -- [{kind, rank, title, detail}, ...]
  ADD COLUMN achievements  jsonb NOT NULL DEFAULT '[]';

-- Speeds up "your earlier activities of this type" when awarding achievements.
CREATE INDEX activities_user_type_started_idx ON activities (user_id, type, started_at);
