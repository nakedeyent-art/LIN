-- Deal messaging: one shared thread per deal, visible to exactly the people who can see the deal
-- (sponsor, athlete, and the athlete's current guardians while the athlete is under 18).
CREATE TABLE deal_messages (
  id BIGSERIAL PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES deals(id),
  sender_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX deal_messages_deal_idx ON deal_messages (deal_id, id);
CREATE INDEX deal_messages_sender_idx ON deal_messages (sender_id, created_at);

CREATE TABLE deal_message_reads (
  deal_id UUID NOT NULL REFERENCES deals(id),
  user_id UUID NOT NULL REFERENCES users(id),
  last_read_id BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (deal_id, user_id)
);

-- Messages are a record: no edits. (Deleting an account blanks that person's messages; see lib/account-deletion.ts.)
CREATE FUNCTION deal_messages_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'deal messages cannot be deleted'; END IF;
  IF NEW.id <> OLD.id OR NEW.deal_id <> OLD.deal_id OR NEW.sender_id <> OLD.sender_id OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'deal message identity is immutable';
  END IF;
  IF NEW.body <> OLD.body AND NEW.body <> '[message removed]' THEN
    RAISE EXCEPTION 'deal messages cannot be edited';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER deal_messages_guard BEFORE UPDATE OR DELETE ON deal_messages
  FOR EACH ROW EXECUTE FUNCTION deal_messages_guard();
