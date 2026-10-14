CREATE FUNCTION prevent_signing_version_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM signing_envelopes WHERE document_id=NEW.document_id AND status NOT IN ('declined','expired','voided')) THEN RAISE EXCEPTION 'Document is frozen by its signing workflow'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER signing_source_version_guard BEFORE INSERT ON document_versions FOR EACH ROW EXECUTE FUNCTION prevent_signing_version_change();
