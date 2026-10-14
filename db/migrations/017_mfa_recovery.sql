-- A support reset permits re-enrollment, never a password-only return to the app.
ALTER TABLE users ADD COLUMN mfa_reenrollment_required BOOLEAN NOT NULL DEFAULT FALSE;
