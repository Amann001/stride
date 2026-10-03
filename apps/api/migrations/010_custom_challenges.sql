-- Challenges people create themselves, with their own dates, and invite friends to.

CREATE TABLE custom_challenges (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      text NOT NULL,
  -- Null means every sport counts.
  sport      text CHECK (sport IN ('run', 'ride', 'walk', 'hike')),
  metric     text NOT NULL CHECK (metric IN ('distance', 'time', 'elevation', 'activeDays', 'longest')),
  -- Meters for distance, elevation and longest; seconds for time; days for activeDays.
  goal       real NOT NULL CHECK (goal > 0),
  -- First and last day that count, both included, in the creator's time zone, so the
  -- dates mean the same for everyone taking part.
  start_date date NOT NULL,
  end_date   date NOT NULL,
  time_zone  text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE TABLE custom_challenge_members (
  challenge_id uuid NOT NULL REFERENCES custom_challenges(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       text NOT NULL CHECK (status IN ('invited', 'joined')),
  invited_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, user_id)
);
CREATE INDEX custom_challenge_members_user_idx ON custom_challenge_members (user_id);

-- "X invited you to a challenge".
ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN ('follow', 'kudos', 'comment', 'challenge_invite'));
ALTER TABLE notifications ADD COLUMN challenge_id uuid REFERENCES custom_challenges(id) ON DELETE CASCADE;
