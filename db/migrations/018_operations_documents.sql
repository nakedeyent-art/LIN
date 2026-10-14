-- Shared organization, athlete and event identities. Membership never grants category consent.
CREATE TABLE organizations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 160),
 created_by UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE organization_members (
 organization_id UUID NOT NULL REFERENCES organizations(id), user_id UUID NOT NULL REFERENCES users(id),
 role TEXT NOT NULL CHECK(role IN ('owner','member')), PRIMARY KEY(organization_id,user_id)
);
CREATE TABLE athlete_documents (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), athlete_id UUID NOT NULL REFERENCES athlete_profiles(user_id),
 organization_id UUID REFERENCES organizations(id), deal_id UUID REFERENCES deals(id), event_id UUID REFERENCES events(id),
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 160), folder TEXT NOT NULL DEFAULT '' CHECK(length(folder)<=100),
 category TEXT NOT NULL CHECK(category IN ('eligibility','identity','tax','medical','travel','contracts','media_release','school_compliance','other')),
 tags TEXT[] NOT NULL DEFAULT '{}', access_scope TEXT NOT NULL DEFAULT 'family' CHECK(access_scope IN ('family','consented')),
 expires_on DATE, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived','completed')),
 created_by UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(id,athlete_id)
);
CREATE TABLE document_versions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), document_id UUID NOT NULL REFERENCES athlete_documents(id),
 version INT NOT NULL CHECK(version>0), file_name TEXT NOT NULL, media_type TEXT NOT NULL,
 contents BYTEA NOT NULL CHECK(octet_length(contents) BETWEEN 1 AND 5242880), sha256 TEXT NOT NULL CHECK(length(sha256)=64),
 uploaded_by UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(document_id,version), UNIQUE(id,document_id)
);
CREATE INDEX ON athlete_documents(athlete_id,category,created_at DESC);
CREATE INDEX ON athlete_documents(expires_on) WHERE status='active';
CREATE INDEX ON document_versions(document_id,version DESC);
-- An explicit grant still requires a current athlete relationship and category consent.
CREATE TABLE document_grants (
 document_id UUID NOT NULL REFERENCES athlete_documents(id), user_id UUID NOT NULL REFERENCES users(id),
 granted_by UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(document_id,user_id)
);
CREATE TABLE operations_activity (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, athlete_id UUID NOT NULL REFERENCES athlete_profiles(user_id),
 actor_id UUID NOT NULL REFERENCES users(id), document_id UUID REFERENCES athlete_documents(id),
 event_id UUID REFERENCES events(id), deal_id UUID REFERENCES deals(id),
 action TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON operations_activity(athlete_id,created_at DESC);
CREATE FUNCTION protect_document_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Document versions are immutable'; END IF;
 PERFORM 1 FROM athlete_documents WHERE id=NEW.document_id AND status <> 'completed' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Completed documents are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER document_version_guard BEFORE INSERT OR UPDATE OR DELETE ON document_versions FOR EACH ROW EXECUTE FUNCTION protect_document_version();
CREATE FUNCTION protect_completed_document() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status='completed' THEN RAISE EXCEPTION 'Completed documents are immutable'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER completed_document_guard BEFORE UPDATE OR DELETE ON athlete_documents FOR EACH ROW EXECUTE FUNCTION protect_completed_document();
