/*
# Create projects table for the Reboot platform

## Purpose
Reboot stores every project (startup / prototype / abandoned idea) as a row
here. Each row is rendered as a building in City Mode, a node in Network Mode,
a tombstone in Graveyard Mode, or a holographic node in Echo Mode. The four
modules read the same table through a shared Zustand store; none of them own
the schema.

## 1. New Tables

- `projects`
  - `id` (uuid, primary key, default gen_random_uuid())
  - `name` (text, not null) — project display name
  - `tagline` (text, not null default '') — one-line summary
  - `description` (text, not null default '') — long-form story / postmortem
  - `category` (text, not null) — one of: AI, Gaming, Education, Health,
    Finance, Creator, Marketplace, OpenSource, Robotics, Space, Community,
    IdeaHub, Graveyard, Legend. Drives district placement + visual theme.
  - `status` (text, not null default 'alive') — one of:
    alive / decaying / abandoned / reviving. Drives building health visuals.
  - `stage` (int2, not null default 1, CHECK 1..5) — Construction Site →
    Legend Landmark. Drives building height + detail.
  - `momentum` (int2, not null default 0, CHECK 0..100) — used by Echo.
  - `founder` (text, not null default '') — founder display name.
  - `founded_year` (int2, not null default 0)
  - `failure_year` (int2, null) — null when project is still alive.
  - `failure_reason` (text, null) — optional postmortem text.
  - `tags` (text[], not null default '{}')
  - `connections` (uuid[], not null default '{}') — ids of related projects,
    used by Network Mode to draw edges.
  - `followers` (int4, not null default 0)
  - `firebase_uid` (text, null) — owner. Set from the Firebase id token by the
    auth-callback edge function. RLS scopes writes to this column.
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

## 2. Indexes
- `projects_category_idx` on `category` — district filtering.
- `projects_status_idx` on `status` — Graveyard / Revived filters.
- `projects_created_at_idx` on `created_at DESC` — newest feed.
- `projects_stage_idx` on `stage` — Legend landmark queries.
- `projects_firebase_uid_idx` on `firebase_uid` — owner lookups.

## 3. Security
- RLS enabled on `projects`.
- SELECT is public (`TO anon, authenticated`) so the city renders for visitors
  who have not signed in.
- INSERT / UPDATE / DELETE are owner-scoped to `firebase_uid` and require an
  `authenticated` session whose JWT `sub` matches the row's `firebase_uid`.
  The auth-callback edge function mints that JWT from a verified Firebase id
  token. Until a visitor signs in, they can browse but not mutate.
- `firebase_uid` is NOT defaulted by the database — the edge function injects
  it into the JWT, and the RLS check `auth.jwt() ->> 'firebase_uid'` compares
  against the column. This keeps ownership tied to the Firebase identity.

## 4. Important Notes
1. The `auth-callback` edge function (supabase/functions/auth-callback) issues
   custom JWTs containing `{ firebase_uid }` in custom claims. RLS reads those
   claims via `auth.jwt() ->> 'firebase_uid'`.
2. Read access is intentionally public so the landing city is visible without
   an account, matching the spec's "browse before auth" flow.
3. All columns use safe defaults so inserts from authenticated users never
   fail on missing optional fields.
*/

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tagline text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  category text NOT NULL CHECK (
    category IN ('AI','Gaming','Education','Health','Finance','Creator',
                 'Marketplace','OpenSource','Robotics','Space','Community',
                 'IdeaHub','Graveyard','Legend')
  ),
  status text NOT NULL DEFAULT 'alive' CHECK (
    status IN ('alive','decaying','abandoned','reviving')
  ),
  stage smallint NOT NULL DEFAULT 1 CHECK (stage >= 1 AND stage <= 5),
  momentum smallint NOT NULL DEFAULT 0 CHECK (momentum >= 0 AND momentum <= 100),
  founder text NOT NULL DEFAULT '',
  founded_year smallint NOT NULL DEFAULT 0,
  failure_year smallint,
  failure_reason text,
  tags text[] NOT NULL DEFAULT '{}',
  connections uuid[] NOT NULL DEFAULT '{}',
  followers integer NOT NULL DEFAULT 0,
  firebase_uid text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_category_idx ON projects (category);
CREATE INDEX IF NOT EXISTS projects_status_idx ON projects (status);
CREATE INDEX IF NOT EXISTS projects_created_at_idx ON projects (created_at DESC);
CREATE INDEX IF NOT EXISTS projects_stage_idx ON projects (stage);
CREATE INDEX IF NOT EXISTS projects_firebase_uid_idx ON projects (firebase_uid);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Public read: the city renders for signed-out visitors.
DROP POLICY IF EXISTS "public_read_projects" ON projects;
CREATE POLICY "public_read_projects"
ON projects FOR SELECT
TO anon, authenticated
USING (true);

-- Owner-only writes. Ownership is the firebase_uid carried in the JWT claims.
DROP POLICY IF EXISTS "owner_insert_projects" ON projects;
CREATE POLICY "owner_insert_projects"
ON projects FOR INSERT
TO authenticated
WITH CHECK (firebase_uid IS NOT NULL AND firebase_uid = (auth.jwt() ->> 'firebase_uid'));

DROP POLICY IF EXISTS "owner_update_projects" ON projects;
CREATE POLICY "owner_update_projects"
ON projects FOR UPDATE
TO authenticated
USING (firebase_uid = (auth.jwt() ->> 'firebase_uid'))
WITH CHECK (firebase_uid = (auth.jwt() ->> 'firebase_uid'));

DROP POLICY IF EXISTS "owner_delete_projects" ON projects;
CREATE POLICY "owner_delete_projects"
ON projects FOR DELETE
TO authenticated
USING (firebase_uid = (auth.jwt() ->> 'firebase_uid'));
