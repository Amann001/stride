-- Changing your email: a 6-digit code is sent to the NEW address to prove you own it.
-- Like password_resets: only a hash of the code is kept, it expires, and tries are counted.
CREATE TABLE email_changes (
  user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  new_email  text NOT NULL,
  code_hash  text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
