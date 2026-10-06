-- Messaging safety & features: reports, blocks, moderator hiding, attachments, search index.

-- Moderators can hide a message (the text is kept for the record, users see "[removed by a moderator]").
ALTER TABLE deal_messages ADD COLUMN hidden_at TIMESTAMPTZ, ADD COLUMN hidden_by UUID REFERENCES users(id);

CREATE OR REPLACE FUNCTION deal_messages_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'deal messages cannot be deleted'; END IF;
  IF NEW.id <> OLD.id OR NEW.deal_id <> OLD.deal_id OR NEW.sender_id <> OLD.sender_id OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'deal message identity is immutable';
  END IF;
  IF NEW.body <> OLD.body AND NEW.body <> '[message removed]' THEN
    RAISE EXCEPTION 'deal messages cannot be edited';
  END IF;
  RETURN NEW;       -- hidden_at / hidden_by may change
END $$ LANGUAGE plpgsql;

CREATE INDEX deal_messages_fts ON deal_messages USING GIN (to_tsvector('simple', body));

-- ---- reports ----
CREATE TABLE message_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id BIGINT NOT NULL REFERENCES deal_messages(id),
  deal_id UUID NOT NULL REFERENCES deals(id),
  reporter_id UUID NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL CHECK (reason IN ('harassment','inappropriate','off_platform_contact','spam','safety_minor','other')),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','dismissed','actioned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  resolution TEXT,
  UNIQUE (message_id, reporter_id)
);
CREATE INDEX message_reports_open_idx ON message_reports (status, created_at);

-- ---- blocks ----
-- A block closes messaging between the two people (every deal they share) and stops new offers between them.
-- athlete_id is set when a guardian blocks on a minor athlete's behalf (it lapses with their guardian authority).
CREATE TABLE user_blocks (
  blocker_id UUID NOT NULL REFERENCES users(id),
  blocked_id UUID NOT NULL REFERENCES users(id),
  athlete_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX user_blocks_blocked_idx ON user_blocks (blocked_id);

-- ---- attachments (stored in Postgres; move to object storage before scale) ----
CREATE TABLE deal_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id BIGINT NOT NULL REFERENCES deal_messages(id),
  deal_id UUID NOT NULL REFERENCES deals(id),
  uploader_id UUID NOT NULL REFERENCES users(id),
  filename TEXT NOT NULL CHECK (char_length(filename) BETWEEN 1 AND 120),
  content_type TEXT NOT NULL CHECK (content_type IN ('image/png','image/jpeg','application/pdf')),
  size_bytes INT NOT NULL CHECK (size_bytes BETWEEN 1 AND 2097152),
  sha256 CHAR(64) NOT NULL,
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX deal_attachments_msg_idx ON deal_attachments (message_id);
CREATE INDEX deal_attachments_deal_idx ON deal_attachments (deal_id);
