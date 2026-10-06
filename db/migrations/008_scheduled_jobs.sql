-- Scheduled jobs: idempotency markers for the "turned 18" transition, and a run log.
ALTER TABLE athlete_profiles
  ADD COLUMN adult_notice_sent_at TIMESTAMPTZ,            -- set once the 18th-birthday transition has been processed
  ADD COLUMN adult_notice_attempts INT NOT NULL DEFAULT 0; -- failed delivery attempts (job gives up after a cap)

ALTER TABLE guardian_events DROP CONSTRAINT guardian_events_action_check;
ALTER TABLE guardian_events ADD CONSTRAINT guardian_events_action_check CHECK (action IN
  ('invited','accepted','invite_cancelled','removed','stepped_down','listing_changed',
   'adult_sharing_granted','adult_sharing_stopped','adult_link_removed','adult_transition'));

CREATE TABLE job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','ok','failed')),
  processed INT NOT NULL DEFAULT 0,
  skipped INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  error TEXT                                             -- never contains personal data
);
CREATE INDEX ON job_runs (job, started_at DESC);

-- Athletes who turned 18 long ago have nothing to transition: mark them done so the first run doesn't treat years of
-- history as new. Anyone inside the 30-day notice window is left for the job (it still owes them an email).
UPDATE athlete_profiles SET adult_notice_sent_at = NOW()
 WHERE birth_date <= CURRENT_DATE - INTERVAL '18 years' - INTERVAL '30 days';
