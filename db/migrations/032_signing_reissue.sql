-- A generated deal agreement may be re-issued when the people allowed to sign change (athlete turns 18, guardian replaced).
-- One LIVE (or completed) envelope per contract, instead of one envelope ever.
ALTER TABLE signing_envelopes DROP CONSTRAINT signing_envelopes_legacy_contract_id_key;
CREATE UNIQUE INDEX signing_envelopes_one_live_per_contract ON signing_envelopes (legacy_contract_id)
  WHERE legacy_contract_id IS NOT NULL AND status NOT IN ('voided','expired','declined');
