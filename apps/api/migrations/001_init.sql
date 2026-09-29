-- First version of the database: users and their activities.

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  name          text NOT NULL,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE activities (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                  text NOT NULL CHECK (type IN ('run', 'ride', 'walk', 'hike')),
  title                 text NOT NULL,
  description           text,
  started_at            timestamptz NOT NULL,
  elapsed_seconds       integer NOT NULL,
  moving_seconds        integer NOT NULL,
  distance_meters       real NOT NULL,
  elevation_gain_meters real NOT NULL,
  polyline              text NOT NULL,
  -- Full GPS track as JSON: [{lat, lng, alt, t}, ...]
  points                jsonb NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Speeds up "show my activities, newest first".
CREATE INDEX activities_user_started_idx ON activities (user_id, started_at DESC);
