-- Monthly challenges you've joined, and your weekly distance goals.

CREATE TABLE challenge_joins (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- e.g. "2026-10:run-50k". The challenge list itself lives in code (challenges.ts).
  challenge_id text NOT NULL,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, challenge_id)
);

-- Speeds up "how many people joined this challenge".
CREATE INDEX challenge_joins_challenge_idx ON challenge_joins (challenge_id);

CREATE TABLE weekly_goals (
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          text NOT NULL CHECK (type IN ('run', 'ride', 'walk', 'hike')),
  target_meters real NOT NULL CHECK (target_meters > 0),
  PRIMARY KEY (user_id, type)
);
