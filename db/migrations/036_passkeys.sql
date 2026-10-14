-- Passkeys (WebAuthn) as an additional second factor. Enrolment in two-factor still starts with an authenticator app (which also issues the
-- recovery codes); a passkey can then be added and used instead of a code at the second step. Removing the last passkey never weakens MFA.
CREATE TABLE user_passkeys (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 credential_id TEXT NOT NULL UNIQUE,                 -- base64url, as the authenticator reports it
 public_key BYTEA NOT NULL, counter BIGINT NOT NULL DEFAULT 0,
 transports TEXT[] NOT NULL DEFAULT '{}', device_type TEXT NOT NULL DEFAULT 'singleDevice', backed_up BOOLEAN NOT NULL DEFAULT false,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 60),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_used_at TIMESTAMPTZ
);
CREATE INDEX ON user_passkeys(user_id);
-- One outstanding challenge per person and purpose; short-lived and single use.
CREATE TABLE webauthn_challenges (
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, purpose TEXT NOT NULL CHECK(purpose IN ('register','authenticate')),
 challenge TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(user_id, purpose)
);
-- Security log gains the passkey events.
ALTER TABLE security_events DROP CONSTRAINT security_events_action_check;
ALTER TABLE security_events ADD CONSTRAINT security_events_action_check CHECK (action IN ('mfa_enabled','mfa_disabled','mfa_recovery_used','mfa_codes_regenerated','mfa_reset_by_admin','mfa_locked','passkey_added','passkey_removed','passkey_counter_rejected','mfa_passkey_verified'));
