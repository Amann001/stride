-- Maps: saved routes, a bounding box per activity for fast heatmap tiles, and who can
-- see each activity (only "everyone" activities go into the shared heatmaps).

ALTER TABLE activities
  ADD COLUMN min_lat real,
  ADD COLUMN max_lat real,
  ADD COLUMN min_lng real,
  ADD COLUMN max_lng real,
  ADD COLUMN visibility text NOT NULL DEFAULT 'everyone'
    CHECK (visibility IN ('everyone', 'followers', 'only_me'));

-- Fill in the box for activities saved before this migration. Activities added by hand
-- have no GPS points and keep an empty box.
UPDATE activities a
SET min_lat = b.min_lat, max_lat = b.max_lat, min_lng = b.min_lng, max_lng = b.max_lng
FROM (
  SELECT id,
    min((p->>'lat')::real) AS min_lat, max((p->>'lat')::real) AS max_lat,
    min((p->>'lng')::real) AS min_lng, max((p->>'lng')::real) AS max_lng
  FROM activities, jsonb_array_elements(points) p
  GROUP BY id
) b
WHERE a.id = b.id;

CREATE INDEX activities_bbox_idx ON activities (min_lat, max_lat, min_lng, max_lng);

CREATE TABLE routes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  sport                 text NOT NULL CHECK (sport IN ('run', 'ride', 'walk', 'hike')),
  distance_meters       real NOT NULL,
  elevation_gain_meters real NOT NULL,
  polyline              text NOT NULL,
  -- [{distanceMeters, altitude}, ...] for the hill chart.
  elevation_profile     jsonb NOT NULL DEFAULT '[]',
  start_lat             real NOT NULL,
  start_lng             real NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX routes_user_idx ON routes (user_id, created_at DESC);
