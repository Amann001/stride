-- A tag the phone gives each recording, so uploading the same recording twice
-- (e.g. a retry after a lost connection) never creates a duplicate activity.
ALTER TABLE activities ADD COLUMN client_id text;

CREATE UNIQUE INDEX activities_user_client_id_idx
  ON activities (user_id, client_id)
  WHERE client_id IS NOT NULL;
