CREATE TABLE signing_envelopes (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), document_id UUID NOT NULL REFERENCES athlete_documents(id),
 version_id UUID NOT NULL, athlete_id UUID NOT NULL REFERENCES athlete_profiles(user_id),
 organization_id UUID REFERENCES organizations(id), deal_id UUID REFERENCES deals(id), event_id UUID REFERENCES events(id),
 created_by UUID NOT NULL REFERENCES users(id), title TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','viewed','partially_signed','completed','declined','expired','voided')),
 expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ,
 FOREIGN KEY(version_id,document_id) REFERENCES document_versions(id,document_id),
 FOREIGN KEY(document_id,athlete_id) REFERENCES athlete_documents(id,athlete_id)
);
CREATE TABLE signing_recipients (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), envelope_id UUID NOT NULL REFERENCES signing_envelopes(id),
 user_id UUID NOT NULL REFERENCES users(id), capacity TEXT NOT NULL CHECK(capacity IN ('athlete','sponsor','guardian','agent','school','internal')),
 signing_order INT NOT NULL CHECK(signing_order BETWEEN 1 AND 30),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','viewed','signed','declined')),
 signed_at TIMESTAMPTZ, UNIQUE(envelope_id,user_id), UNIQUE(id,envelope_id)
);
CREATE TABLE signing_fields (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), envelope_id UUID NOT NULL REFERENCES signing_envelopes(id),
 recipient_id UUID NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('signature','initials','date','checkbox','text')),
 label TEXT NOT NULL CHECK(length(label) BETWEEN 1 AND 120), required BOOLEAN NOT NULL DEFAULT true,
 page INT NOT NULL CHECK(page BETWEEN 1 AND 200), x NUMERIC NOT NULL CHECK(x BETWEEN 0 AND 1), y NUMERIC NOT NULL CHECK(y BETWEEN 0 AND 1),
 width NUMERIC NOT NULL DEFAULT 0.3 CHECK(width>0 AND width<=1),
 FOREIGN KEY(recipient_id,envelope_id) REFERENCES signing_recipients(id,envelope_id)
);
CREATE TABLE signing_sessions (
 token_hash TEXT PRIMARY KEY, envelope_id UUID NOT NULL REFERENCES signing_envelopes(id),
 recipient_id UUID NOT NULL REFERENCES signing_recipients(id), user_id UUID NOT NULL REFERENCES users(id),
 expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE signing_evidence (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), envelope_id UUID NOT NULL REFERENCES signing_envelopes(id),
 recipient_id UUID NOT NULL UNIQUE REFERENCES signing_recipients(id), user_id UUID NOT NULL REFERENCES users(id),
 document_sha256 TEXT NOT NULL, field_values JSONB NOT NULL, consent_version TEXT NOT NULL, signed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE signing_events (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, envelope_id UUID NOT NULL REFERENCES signing_envelopes(id),
 actor_id UUID REFERENCES users(id), action TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE signing_artifacts (
 envelope_id UUID NOT NULL REFERENCES signing_envelopes(id), kind TEXT NOT NULL CHECK(kind IN ('completed','certificate')),
 contents BYTEA NOT NULL, sha256 TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(envelope_id,kind)
);
CREATE TABLE signing_delivery_events (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,envelope_id UUID NOT NULL REFERENCES signing_envelopes(id),
 recipient_id UUID NOT NULL REFERENCES signing_recipients(id), kind TEXT NOT NULL, delivery_day DATE NOT NULL DEFAULT CURRENT_DATE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(envelope_id,recipient_id,kind,delivery_day)
);
CREATE INDEX ON signing_envelopes(athlete_id,status);
CREATE INDEX ON signing_recipients(user_id,status);
CREATE FUNCTION immutable_signing_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Signing evidence is immutable'; END $$;
CREATE TRIGGER immutable_signing_evidence BEFORE UPDATE OR DELETE ON signing_evidence FOR EACH ROW EXECUTE FUNCTION immutable_signing_evidence();
CREATE TRIGGER immutable_signing_artifacts BEFORE UPDATE OR DELETE ON signing_artifacts FOR EACH ROW EXECUTE FUNCTION immutable_signing_evidence();
CREATE TRIGGER immutable_signing_events BEFORE UPDATE OR DELETE ON signing_events FOR EACH ROW EXECUTE FUNCTION immutable_signing_evidence();
CREATE FUNCTION frozen_signing_configuration() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE eid UUID; st TEXT;
BEGIN
 eid=CASE WHEN TG_OP='DELETE' THEN OLD.envelope_id ELSE NEW.envelope_id END;
 SELECT status INTO st FROM signing_envelopes WHERE id=eid FOR UPDATE;
 IF st<>'draft' THEN
  IF TG_TABLE_NAME='signing_fields' OR TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'Sent signing configuration is frozen'; END IF;
  IF (NEW.envelope_id,NEW.user_id,NEW.capacity,NEW.signing_order) IS DISTINCT FROM (OLD.envelope_id,OLD.user_id,OLD.capacity,OLD.signing_order) THEN RAISE EXCEPTION 'Recipient identity is frozen'; END IF;
  IF OLD.status='signed' THEN RAISE EXCEPTION 'Signed recipient is immutable'; END IF;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER signing_fields_frozen BEFORE INSERT OR UPDATE OR DELETE ON signing_fields FOR EACH ROW EXECUTE FUNCTION frozen_signing_configuration();
CREATE TRIGGER signing_recipients_frozen BEFORE INSERT OR UPDATE OR DELETE ON signing_recipients FOR EACH ROW EXECUTE FUNCTION frozen_signing_configuration();
CREATE FUNCTION frozen_envelope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR OLD.status IN ('completed','declined','expired','voided') THEN RAISE EXCEPTION 'Envelope is immutable'; END IF;
 IF OLD.status<>'draft' AND (NEW.document_id,NEW.version_id,NEW.athlete_id,NEW.organization_id,NEW.deal_id,NEW.event_id,NEW.created_by,NEW.title,NEW.expires_at) IS DISTINCT FROM (OLD.document_id,OLD.version_id,OLD.athlete_id,OLD.organization_id,OLD.deal_id,OLD.event_id,OLD.created_by,OLD.title,OLD.expires_at) THEN RAISE EXCEPTION 'Sent envelope is frozen'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER frozen_envelope BEFORE UPDATE OR DELETE ON signing_envelopes FOR EACH ROW EXECUTE FUNCTION frozen_envelope();
