-- Email change: the pending new address rides on the single-use token.
ALTER TABLE email_tokens ADD COLUMN payload TEXT;
ALTER TABLE email_tokens DROP CONSTRAINT email_tokens_purpose_check;
ALTER TABLE email_tokens ADD CONSTRAINT email_tokens_purpose_check
  CHECK (purpose IN ('verify_email','password_reset','change_email'));

-- Account deletion anonymizes + purges personal data but keeps the row so shared deal records stay intact.
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;
