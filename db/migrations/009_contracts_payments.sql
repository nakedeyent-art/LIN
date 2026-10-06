-- Contracts + e-signatures + payments (Stripe Connect: separate charges and transfers).

-- ---- deal states: signing before active; cancellation ----
ALTER TABLE deals DROP CONSTRAINT deals_status_chk;
ALTER TABLE deals ADD CONSTRAINT deals_status_chk CHECK (status IN
  ('offered','guardian_review','awaiting_signature','active','completed','declined','withdrawn','cancelled'));
ALTER TABLE deals
  ADD COLUMN payee_user_id UUID REFERENCES users(id),        -- who receives the money: the adult athlete, or a guardian for a minor
  ADD COLUMN cancel_requested_side TEXT CHECK (cancel_requested_side IN ('buyer','athlete_side')),
  ADD COLUMN cancel_requested_by UUID REFERENCES users(id),
  ADD COLUMN cancel_requested_at TIMESTAMPTZ;

-- ---- contracts: a frozen snapshot of the terms, identified by a SHA-256 ----
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL UNIQUE REFERENCES deals(id),
  template_version TEXT NOT NULL,
  terms JSONB NOT NULL,                  -- exactly what the body was rendered from
  body TEXT NOT NULL,
  sha256 CHAR(64) NOT NULL,
  platform_fee_bps INT NOT NULL CHECK (platform_fee_bps BETWEEN 0 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at TIMESTAMPTZ,               -- all required signatures collected
  voided_at TIMESTAMPTZ                  -- deal ended before execution
);

CREATE TABLE contract_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id),
  signer_user_id UUID NOT NULL REFERENCES users(id),
  signer_role TEXT NOT NULL CHECK (signer_role IN ('counterparty','athlete','guardian')),
  typed_name TEXT NOT NULL,              -- the signature: the name the signer typed
  consent_version TEXT NOT NULL,         -- which e-sign consent text they agreed to
  document_sha256 CHAR(64) NOT NULL,     -- the exact document they signed
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip TEXT,
  user_agent TEXT,
  UNIQUE (contract_id, signer_user_id)
);

-- Contracts and signatures are evidence: the database itself refuses to alter them.
CREATE FUNCTION contracts_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'contracts cannot be deleted'; END IF;
  IF (NEW.deal_id, NEW.template_version, NEW.terms, NEW.body, NEW.sha256, NEW.platform_fee_bps, NEW.created_at)
       IS DISTINCT FROM (OLD.deal_id, OLD.template_version, OLD.terms, OLD.body, OLD.sha256, OLD.platform_fee_bps, OLD.created_at)
     OR (OLD.executed_at IS NOT NULL AND NEW.executed_at IS DISTINCT FROM OLD.executed_at)
     OR (OLD.voided_at IS NOT NULL AND NEW.voided_at IS DISTINCT FROM OLD.voided_at)
  THEN RAISE EXCEPTION 'contract terms and execution are immutable'; END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER contracts_immutable BEFORE UPDATE OR DELETE ON contracts FOR EACH ROW EXECUTE FUNCTION contracts_guard();

-- Only the signer's network metadata may ever change, and only to NULL (account deletion scrubs it).
CREATE FUNCTION signatures_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'signatures are append-only'; END IF;
  IF (NEW.contract_id, NEW.signer_user_id, NEW.signer_role, NEW.typed_name, NEW.consent_version, NEW.document_sha256, NEW.signed_at)
       IS DISTINCT FROM (OLD.contract_id, OLD.signer_user_id, OLD.signer_role, OLD.typed_name, OLD.consent_version, OLD.document_sha256, OLD.signed_at)
     OR (NEW.ip IS NOT NULL AND NEW.ip IS DISTINCT FROM OLD.ip)
     OR (NEW.user_agent IS NOT NULL AND NEW.user_agent IS DISTINCT FROM OLD.user_agent)
  THEN RAISE EXCEPTION 'signatures are immutable'; END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER signatures_immutable BEFORE UPDATE OR DELETE ON contract_signatures FOR EACH ROW EXECUTE FUNCTION signatures_guard();

-- ---- payments ----
CREATE TABLE payout_accounts (                -- a user's Stripe Connect (Express) account
  user_id UUID PRIMARY KEY REFERENCES users(id),
  stripe_account_id TEXT NOT NULL UNIQUE,
  details_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE deal_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id),
  payee_user_id UUID NOT NULL REFERENCES users(id),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  fee_cents BIGINT NOT NULL CHECK (fee_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL CHECK (status IN ('pending_checkout','funded','releasing','released','refunding','refunded','expired','failed')),
  stripe_checkout_session_id TEXT UNIQUE,
  checkout_url TEXT,
  stripe_payment_intent_id TEXT,
  stripe_transfer_id TEXT,
  stripe_refund_id TEXT,
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  funded_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (fee_cents <= amount_cents)
);
-- At most one live payment per deal: you can't double-fund, and retries are idempotent by construction.
CREATE UNIQUE INDEX one_live_payment_per_deal ON deal_payments (deal_id) WHERE status IN ('pending_checkout','funded','releasing','refunding');
CREATE INDEX ON deal_payments (status, updated_at);

CREATE TABLE payment_events (               -- audit trail; never holds card data or secrets
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES deal_payments(id),
  action TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON payment_events (payment_id, created_at);

CREATE TABLE stripe_events (                -- webhook de-duplication: each event id is processed once
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
