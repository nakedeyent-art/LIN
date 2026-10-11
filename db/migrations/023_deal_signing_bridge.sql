ALTER TABLE signing_envelopes ADD COLUMN legacy_contract_id UUID UNIQUE REFERENCES contracts(id);
CREATE OR REPLACE FUNCTION frozen_envelope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR OLD.status IN ('completed','declined','expired','voided') THEN RAISE EXCEPTION 'Envelope is immutable'; END IF;
 IF (NEW.document_id,NEW.version_id,NEW.athlete_id,NEW.organization_id,NEW.deal_id,NEW.event_id,NEW.created_by,NEW.title,NEW.expires_at,NEW.legacy_contract_id) IS DISTINCT FROM (OLD.document_id,OLD.version_id,OLD.athlete_id,OLD.organization_id,OLD.deal_id,OLD.event_id,OLD.created_by,OLD.title,OLD.expires_at,OLD.legacy_contract_id) THEN RAISE EXCEPTION 'Envelope source is frozen'; END IF;
 RETURN NEW;
END $$;
