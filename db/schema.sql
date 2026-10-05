-- LIN NIL ecosystem: PostgreSQL schema (Postgres 13+, gen_random_uuid built in)

CREATE TYPE user_role AS ENUM ('athlete','parent','coach','trainer','gym_owner','sponsor',
  'booster','tournament_manager','recruiter','manager');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Declared professional capacity (SPARTA / agent-law guardrail)
CREATE TABLE manager_declarations (
  manager_id UUID PRIMARY KEY REFERENCES users(id),
  declared_role TEXT NOT NULL CHECK (declared_role IN ('marketing_agent','certified_strength_coach','mentor')),
  credential_type TEXT,            -- e.g. CSCS, RD, state agent registration
  credential_verified BOOLEAN DEFAULT FALSE,
  declared_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE athlete_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  sport VARCHAR(50) NOT NULL,
  position VARCHAR(50),
  level VARCHAR(20) NOT NULL CHECK (level IN ('high_school','college','pro_amateur')),
  state CHAR(2),
  birth_date DATE NOT NULL,
  grad_year INT,
  in_season BOOLEAN DEFAULT FALSE   -- Season Toggle
);

-- Who may see/act for which athlete; consent gates data sharing
CREATE TABLE athlete_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES users(id),
  member_id UUID NOT NULL REFERENCES users(id),
  relationship user_role NOT NULL,
  can_view_academics BOOLEAN DEFAULT FALSE,
  can_view_health BOOLEAN DEFAULT FALSE,
  guardian_approved BOOLEAN DEFAULT FALSE,
  UNIQUE (athlete_id, member_id)
);

CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES users(id),
  counterparty_id UUID NOT NULL REFERENCES users(id),
  amount_cents BIGINT NOT NULL,
  deliverables TEXT NOT NULL,
  status VARCHAR(30) DEFAULT 'offered',  -- offered, guardian_review, active, completed, declined
  guardian_approved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL, sport VARCHAR(50), starts_on DATE, status VARCHAR(30) DEFAULT 'draft'
);

CREATE TABLE recruiting_board (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL REFERENCES users(id),
  athlete_id UUID NOT NULL REFERENCES users(id),
  stage VARCHAR(30) DEFAULT 'watching',
  UNIQUE (recruiter_id, athlete_id)
);

-- Track educational checkpoints
CREATE TABLE academic_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID REFERENCES users(id),
  manager_id UUID REFERENCES users(id),
  course_name VARCHAR(100) NOT NULL,
  current_grade NUMERIC(5,2),
  study_minutes_logged INT DEFAULT 0,
  proof_document_url TEXT,
  verified_by_manager BOOLEAN DEFAULT FALSE,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track workout prescriptions and adherence
CREATE TABLE athlete_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID REFERENCES users(id),
  prescribed_by UUID REFERENCES users(id), -- Manager or Trainer
  sport VARCHAR(50) NOT NULL,
  focus_area VARCHAR(100),
  workout_json JSONB NOT NULL,             -- sets, reps, tempo, video URLs
  scheduled_date DATE NOT NULL,
  status VARCHAR(30) DEFAULT 'assigned',   -- assigned, in_progress, completed, missed
  adherence_score NUMERIC(5,2),
  athlete_notes TEXT
);

-- Track nutritional targets and daily meal compliance
CREATE TABLE nutrition_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID REFERENCES users(id),
  prescribed_by UUID REFERENCES users(id),
  target_calories INT NOT NULL,
  protein_grams INT NOT NULL,
  carbs_grams INT NOT NULL,
  fats_grams INT NOT NULL,
  target_body_profile VARCHAR(100),
  active_until DATE
);

CREATE TABLE food_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES users(id),
  photo_url TEXT, calories INT, protein_grams INT, carbs_grams INT, fats_grams INT,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE disclaimer_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES users(id),
  accepted_by UUID NOT NULL REFERENCES users(id),  -- athlete or guardian if minor
  disclaimer_key TEXT NOT NULL,
  accepted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON athlete_workouts (athlete_id, scheduled_date);
CREATE INDEX ON academic_logs (athlete_id, logged_at);
CREATE INDEX ON food_logs (athlete_id, logged_at);
