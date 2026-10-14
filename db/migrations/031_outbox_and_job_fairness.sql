-- Reliable notices: a durable outbox with retries. Only messages that contain no live token are queued here
-- (security notices, signing and deal notices); sign-in links stay best-effort because storing live tokens would be worse than a resend button.
CREATE TABLE email_outbox (
  id BIGSERIAL PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','dead')),
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  dedupe_key TEXT UNIQUE,                       -- e.g. one reminder per recipient per day
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);
CREATE INDEX email_outbox_due_idx ON email_outbox (next_attempt_at) WHERE status = 'pending';

-- Round-robin fairness for the scouting watch: oldest-checked first, so a large board never starves its tail.
ALTER TABLE scouting_watch_state ADD COLUMN checked_at TIMESTAMPTZ;
CREATE INDEX scouting_watch_checked_idx ON scouting_watch_state (checked_at NULLS FIRST);
