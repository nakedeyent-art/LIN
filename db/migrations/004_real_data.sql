-- Real data for academics, nutrition, training, team connections, events and recruiting.

-- Body metrics used for nutrition targets (entered by the athlete)
ALTER TABLE athlete_profiles
  ADD COLUMN height_cm NUMERIC(5,1) CHECK (height_cm BETWEEN 100 AND 250),
  ADD COLUMN weight_kg NUMERIC(5,1) CHECK (weight_kg BETWEEN 25 AND 250),
  ADD COLUMN sex TEXT CHECK (sex IN ('male','female')),
  ADD COLUMN activity_factor NUMERIC(3,2) NOT NULL DEFAULT 1.55 CHECK (activity_factor BETWEEN 1.2 AND 2.0);

-- Academics: grade checkpoints reuse academic_logs; study time gets its own table.
ALTER TABLE academic_logs
  ADD CONSTRAINT academic_logs_grade_chk CHECK (current_grade BETWEEN 0 AND 100);
CREATE INDEX academic_logs_course_idx ON academic_logs (athlete_id, lower(course_name), logged_at);

CREATE TABLE study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  minutes INT NOT NULL CHECK (minutes BETWEEN 5 AND 480),
  subject TEXT NOT NULL,
  note TEXT,
  studied_on DATE NOT NULL DEFAULT CURRENT_DATE,
  verified_by UUID REFERENCES users(id),       -- guardian or manager with academics access
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON study_sessions (athlete_id, studied_on);

-- Nutrition: plans are computed by the app from metrics + a performance profile.
ALTER TABLE nutrition_plans
  ADD COLUMN bmr_kcal INT,
  ADD COLUMN activity_factor NUMERIC(3,2),
  ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD CONSTRAINT nutrition_profile_chk CHECK (target_body_profile IN ('hypertrophy_power','lean_fast_twitch','maintenance'));
CREATE INDEX ON nutrition_plans (athlete_id, created_at);

ALTER TABLE food_logs
  ADD COLUMN meal_name TEXT,
  ADD COLUMN logged_on DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD CONSTRAINT food_logs_ranges_chk CHECK (
    calories BETWEEN 0 AND 6000 AND protein_grams BETWEEN 0 AND 500 AND carbs_grams BETWEEN 0 AND 1000 AND fats_grams BETWEEN 0 AND 500);
CREATE INDEX ON food_logs (athlete_id, logged_on);

-- Training
ALTER TABLE athlete_workouts
  ADD COLUMN title TEXT NOT NULL DEFAULT 'Workout',
  ADD COLUMN completed_at TIMESTAMPTZ,
  ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD CONSTRAINT athlete_workouts_status_chk CHECK (status IN ('assigned','in_progress','completed','missed'));
ALTER TABLE athlete_workouts ALTER COLUMN title DROP DEFAULT;

-- Team connections: an athlete (or, for minors, a linked guardian) invites a coach/trainer/manager/recruiter
-- and chooses exactly what they can see. Accepting creates an athlete_relationships row.
CREATE TABLE connection_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(id),
  invitee_email TEXT NOT NULL CHECK (invitee_email = lower(invitee_email)),
  role user_role NOT NULL CHECK (role IN ('coach','trainer','manager','recruiter')),
  can_view_academics BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_health BOOLEAN NOT NULL DEFAULT FALSE,   -- nutrition + training
  token_hash TEXT UNIQUE,                            -- NULL once used
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked')),
  accepted_by UUID REFERENCES users(id),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON connection_invites (athlete_id, status);
ALTER TABLE athlete_relationships ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Events (tournament managers) and recruiting board
ALTER TABLE events
  ADD COLUMN location TEXT,
  ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD CONSTRAINT events_status_chk CHECK (status IN ('draft','published','completed','cancelled'));
CREATE INDEX ON events (organizer_id, starts_on);

ALTER TABLE recruiting_board
  ADD COLUMN note TEXT,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD CONSTRAINT recruiting_stage_chk CHECK (stage IN ('watching','evaluating','contacted','passed'));
