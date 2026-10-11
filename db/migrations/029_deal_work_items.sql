CREATE TABLE deal_work_items (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),deal_id UUID NOT NULL REFERENCES deals(id),created_by UUID NOT NULL REFERENCES users(id),
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),due_on DATE NOT NULL,
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','submitted','accepted','changes_requested')),
 attachment_id UUID REFERENCES deal_attachments(id) ON DELETE SET NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON deal_work_items(deal_id,due_on);
