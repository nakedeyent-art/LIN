-- Email verification
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;

-- Single-use, expiring tokens; only the SHA-256 is stored.
CREATE TABLE email_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify_email')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON email_tokens (user_id, purpose, created_at);

-- Guardian linking: the emailed token proves control of guardian_email; acceptance additionally
-- requires a logged-in, verified parent account whose email matches.
ALTER TABLE guardian_invites
  ADD COLUMN token_hash TEXT UNIQUE,            -- NULL once accepted (single use)
  ADD COLUMN expires_at TIMESTAMPTZ,
  ADD COLUMN last_sent_at TIMESTAMPTZ,
  ADD COLUMN accepted_by UUID REFERENCES users(id),
  ADD COLUMN accepted_at TIMESTAMPTZ,
  ADD CONSTRAINT guardian_invites_status_chk CHECK (status IN ('pending','accepted','revoked'));
CREATE INDEX ON guardian_invites (athlete_id);
CREATE INDEX ON guardian_invites (guardian_email);
