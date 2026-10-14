CREATE TABLE scouting_attachments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),report_id UUID NOT NULL REFERENCES scouting_reports(id) ON DELETE CASCADE,
 uploader_id UUID NOT NULL REFERENCES users(id),file_name TEXT NOT NULL,media_type TEXT NOT NULL CHECK(media_type IN ('image/png','image/jpeg','application/pdf')),
 contents BYTEA NOT NULL CHECK(octet_length(contents) BETWEEN 1 AND 2097152),created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE athlete_metrics (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),athlete_id UUID NOT NULL REFERENCES users(id),event_id UUID REFERENCES events(id),
 recorded_by UUID NOT NULL REFERENCES users(id),label TEXT NOT NULL CHECK(length(label) BETWEEN 1 AND 100),value TEXT NOT NULL CHECK(length(value) BETWEEN 1 AND 100),
 source TEXT NOT NULL CHECK(length(source) BETWEEN 1 AND 500),recorded_on DATE NOT NULL,
 recruiting_visible BOOLEAN NOT NULL DEFAULT false,verified_by UUID REFERENCES users(id),verified_at TIMESTAMPTZ,
 CHECK(verified_by IS NULL OR verified_by<>recorded_by),created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
