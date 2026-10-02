-- Account security: logging out everywhere, password reset codes, and app error reports.

-- Every login token carries this number. Changing or resetting your password bumps it,
-- which logs out every other phone that had your account open.
ALTER TABLE users ADD COLUMN token_version integer NOT NULL DEFAULT 0;

-- Six-digit codes for "Forgot password", sent by email. Only a hash of the code is kept,
-- it expires after 15 minutes, and wrong guesses are counted so it can't be brute-forced.
CREATE TABLE password_resets (
  user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code_hash  text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Crashes and errors from the app and the server, so problems get noticed and fixed.
-- No personal data: just what went wrong, where, and on which app version.
CREATE TABLE error_reports (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source     text NOT NULL CHECK (source IN ('app', 'server')),
  message    text NOT NULL,
  stack      text,
  context    jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX error_reports_recent_idx ON error_reports (created_at DESC);

-- New activities start as "Followers" instead of "Everyone": a safer starting point.
-- You can still pick Everyone for any activity; existing activities don't change.
ALTER TABLE activities ALTER COLUMN visibility SET DEFAULT 'followers';
