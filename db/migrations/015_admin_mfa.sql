-- Two-factor authentication for admin accounts (TOTP authenticator app + one-time recovery codes).
CREATE TABLE admin_mfa (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  secret_sealed TEXT NOT NULL,                  -- AES-256-GCM, key in MFA_ENCRYPTION_KEY (never in the database)
  enabled_at TIMESTAMPTZ,                       -- NULL while enrolment is pending (the secret exists but no code has proved it yet)
  last_used_step BIGINT,                        -- time step of the last accepted code: a code can never be used twice
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE admin_recovery_codes (
  user_id UUID NOT NULL REFERENCES users(id),
  code_hash CHAR(64) NOT NULL,
  used_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, code_hash)
);

-- A session is "MFA-verified" when its owner completed the second step on it; admin pages require that (and expire it after 8 hours).
ALTER TABLE sessions ADD COLUMN mfa_verified_at TIMESTAMPTZ;
