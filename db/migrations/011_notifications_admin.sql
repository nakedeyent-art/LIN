-- In-app notifications, email preferences, and the admin panel (admin flag, suspension, audit log).

ALTER TABLE users
  ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE,      -- set only by scripts/make-admin.mjs, never by the app
  ADD COLUMN suspended_at TIMESTAMPTZ,
  ADD COLUMN email_deal_updates BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN email_messages BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('deal','message','payment','guardian','account')),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  href TEXT CHECK (href IS NULL OR (href LIKE '/dashboard%' AND href NOT LIKE '//%')),
  coalesce_key TEXT,                                       -- repeated events (e.g. 5 messages) fold into one unread row
  count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);
CREATE UNIQUE INDEX notifications_one_unread_per_key ON notifications (user_id, coalesce_key) WHERE read_at IS NULL AND coalesce_key IS NOT NULL;

-- Everything an admin does is written here, with a reason. Append-only.
CREATE TABLE admin_audit (
  id BIGSERIAL PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES users(id),
  target_deal_id UUID REFERENCES deals(id),
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX admin_audit_idx ON admin_audit (created_at DESC);
CREATE FUNCTION admin_audit_guard() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'the admin audit log is append-only'; END $$ LANGUAGE plpgsql;
CREATE TRIGGER admin_audit_guard BEFORE UPDATE OR DELETE ON admin_audit FOR EACH ROW EXECUTE FUNCTION admin_audit_guard();
