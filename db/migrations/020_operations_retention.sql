-- Athlete identity remains stable after profile deletion, as it does for deals.
ALTER TABLE athlete_documents DROP CONSTRAINT athlete_documents_athlete_id_fkey;
ALTER TABLE athlete_documents ADD FOREIGN KEY(athlete_id) REFERENCES users(id);
ALTER TABLE signing_envelopes DROP CONSTRAINT signing_envelopes_athlete_id_fkey;
ALTER TABLE signing_envelopes ADD FOREIGN KEY(athlete_id) REFERENCES users(id);
ALTER TABLE operations_activity DROP CONSTRAINT operations_activity_athlete_id_fkey;
ALTER TABLE operations_activity ADD FOREIGN KEY(athlete_id) REFERENCES users(id);
-- One active signing workflow per document prevents competing executions of different versions.
CREATE UNIQUE INDEX signing_one_live_document ON signing_envelopes(document_id) WHERE status NOT IN ('declined','expired','voided');
