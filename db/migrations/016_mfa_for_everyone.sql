-- Two-factor authentication becomes available to every account (mandatory for admins, optional for everyone else).
ALTER TABLE admin_mfa RENAME TO user_mfa;
ALTER TABLE admin_recovery_codes RENAME TO user_recovery_codes;

-- What a person can see about their own account's security history. Never contains codes or secrets.
CREATE TABLE security_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL CHECK (action IN ('mfa_enabled','mfa_disabled','mfa_recovery_used','mfa_codes_regenerated','mfa_reset_by_admin','mfa_locked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX security_events_user_idx ON security_events (user_id, created_at DESC);
