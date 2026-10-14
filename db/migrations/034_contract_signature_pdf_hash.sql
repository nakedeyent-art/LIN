-- Legacy contract signatures made through Forg3 signed a generated PDF, not the raw contract text: keep both hashes so the evidence names the artifact that was actually signed.
ALTER TABLE contract_signatures ADD COLUMN IF NOT EXISTS signed_pdf_sha256 CHAR(64);

-- Stored files: scanning state and an optional object-storage location.
-- Uploads start 'pending' when a scanner is configured and are served only once 'clean'. Existing rows were scanned inline on upload (or never, when no scanner was configured) and are kept servable.
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS scan_status TEXT NOT NULL DEFAULT 'clean' CHECK (scan_status IN ('pending','clean','infected','error'));
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS size_bytes BIGINT;
ALTER TABLE document_versions DISABLE TRIGGER document_version_guard;   -- the backfill is not a content change
UPDATE document_versions SET size_bytes = octet_length(contents) WHERE size_bytes IS NULL;
ALTER TABLE document_versions ENABLE TRIGGER document_version_guard;
ALTER TABLE document_versions ALTER COLUMN size_bytes SET NOT NULL;
ALTER TABLE document_versions ALTER COLUMN contents DROP NOT NULL;
-- The bytes live in exactly one place.
ALTER TABLE document_versions ADD CONSTRAINT document_versions_one_location CHECK ((contents IS NULL) <> (storage_key IS NULL));
ALTER TABLE document_versions ADD CONSTRAINT document_versions_size CHECK (size_bytes BETWEEN 1 AND 5242880);

-- Versions stay immutable, with two exceptions: the erasure tombstone of a deleted account (migration 024) and the scanner recording its
-- verdict exactly once (pending -> clean/infected/error) without touching the bytes.
CREATE OR REPLACE FUNCTION protect_document_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM athlete_documents d JOIN users u ON u.id=d.athlete_id WHERE d.id=OLD.document_id AND u.deleted_at IS NOT NULL AND d.status<>'completed'
  AND NOT EXISTS(SELECT 1 FROM signing_envelopes e JOIN signing_evidence se ON se.envelope_id=e.id WHERE e.document_id=OLD.document_id))
  AND NEW.contents=decode('00','hex') AND NEW.storage_key IS NULL AND NEW.file_name='removed' AND NEW.media_type='application/octet-stream'
  AND (NEW.id,NEW.document_id,NEW.version,NEW.sha256,NEW.uploaded_by,NEW.created_at) IS NOT DISTINCT FROM (OLD.id,OLD.document_id,OLD.version,OLD.sha256,OLD.uploaded_by,OLD.created_at)
 THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.scan_status='pending' AND NEW.scan_status<>'pending'
  AND (NEW.id,NEW.document_id,NEW.version,NEW.file_name,NEW.media_type,NEW.sha256,NEW.uploaded_by,NEW.created_at,NEW.storage_key,NEW.size_bytes)
      IS NOT DISTINCT FROM (OLD.id,OLD.document_id,OLD.version,OLD.file_name,OLD.media_type,OLD.sha256,OLD.uploaded_by,OLD.created_at,OLD.storage_key,OLD.size_bytes)
  AND NEW.contents IS NOT DISTINCT FROM OLD.contents
 THEN RETURN NEW; END IF;
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Document versions are immutable'; END IF;
 PERFORM 1 FROM athlete_documents WHERE id=NEW.document_id AND status <> 'completed' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Completed documents are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE INDEX IF NOT EXISTS document_versions_pending_scan ON document_versions(created_at) WHERE scan_status='pending';
