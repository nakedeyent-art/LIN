-- Guardian management: authority only while the athlete is a minor; adults choose what (if anything) to keep sharing.

-- An adult athlete's explicit choice to keep sharing with a (former) guardian. NULL = no sharing.
ALTER TABLE athlete_relationships ADD COLUMN consent_confirmed_at TIMESTAMPTZ;

-- Guardians who hold real authority: linked, approved, and the athlete is still under 18.
-- Every guardian power check goes through this view so the age rule can't be forgotten.
CREATE VIEW guardian_links AS
  SELECT r.* FROM athlete_relationships r
    JOIN athlete_profiles ap ON ap.user_id = r.athlete_id
   WHERE r.relationship = 'parent' AND r.guardian_approved
     AND ap.birth_date > CURRENT_DATE - INTERVAL '18 years';

ALTER TABLE guardian_invites ADD COLUMN invited_by UUID REFERENCES users(id);   -- NULL = the athlete at signup

CREATE TABLE guardian_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL CHECK (action IN ('invited','accepted','invite_cancelled','removed','stepped_down',
                                          'listing_changed','adult_sharing_granted','adult_sharing_stopped','adult_link_removed')),
  detail TEXT,                                   -- never a full email address: masked or a name
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON guardian_events (athlete_id, created_at);
