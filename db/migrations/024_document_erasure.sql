-- Erasure exception: after account anonymization, unsigned bytes may be replaced by an explicit tombstone.
-- Executed/partially signed agreements remain immutable evidence, matching legacy contract retention.
CREATE OR REPLACE FUNCTION protect_document_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM athlete_documents d JOIN users u ON u.id=d.athlete_id WHERE d.id=OLD.document_id AND u.deleted_at IS NOT NULL AND d.status<>'completed')
  AND NOT EXISTS(SELECT 1 FROM signing_envelopes e JOIN signing_evidence se ON se.envelope_id=e.id WHERE e.document_id=OLD.document_id)
  AND NEW.contents=decode('00','hex') AND NEW.file_name='removed' AND NEW.media_type='application/octet-stream'
  AND (NEW.id,NEW.document_id,NEW.version,NEW.sha256,NEW.uploaded_by,NEW.created_at) IS NOT DISTINCT FROM (OLD.id,OLD.document_id,OLD.version,OLD.sha256,OLD.uploaded_by,OLD.created_at)
 THEN RETURN NEW; END IF;
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Document versions are immutable'; END IF;
 PERFORM 1 FROM athlete_documents WHERE id=NEW.document_id AND status <> 'completed' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Completed documents are immutable'; END IF;
 RETURN NEW;
END $$;
