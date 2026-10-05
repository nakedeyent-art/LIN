-- Deal flow: offers -> athlete accepts -> (minors: guardian approves) -> active -> completed.
ALTER TABLE deals
  ADD COLUMN title TEXT NOT NULL DEFAULT 'NIL deal',
  ADD COLUMN expires_at TIMESTAMPTZ,
  ADD COLUMN attested_at TIMESTAMPTZ,          -- offerer attested comp is for NIL deliverables only
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD CONSTRAINT deals_status_chk CHECK (status IN ('offered','guardian_review','active','completed','declined','withdrawn')),
  ADD CONSTRAINT deals_amount_chk CHECK (amount_cents > 0),
  ADD CONSTRAINT deals_distinct_parties_chk CHECK (athlete_id <> counterparty_id);
ALTER TABLE deals ALTER COLUMN title DROP DEFAULT;
CREATE INDEX ON deals (athlete_id, status);
CREATE INDEX ON deals (counterparty_id, status);

-- Append-only audit trail of every state change.
CREATE TABLE deal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON deal_events (deal_id, created_at);

-- Athletes opt in to being listed to sponsors. Minors can only be listed once a guardian is linked (enforced in app + query).
ALTER TABLE athlete_profiles ADD COLUMN discoverable BOOLEAN NOT NULL DEFAULT FALSE;
