-- Organization lifecycle: re-invitation, expiring/revocable invitations, shared ownership, archival.
ALTER TABLE organization_members ADD COLUMN joined_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE organizations ADD COLUMN archived_at TIMESTAMPTZ;

-- The old UNIQUE(organization_id, invited_user_id) meant one invitation ever: after a decline, a removal or a lapse the person could never be invited again.
ALTER TABLE organization_invites DROP CONSTRAINT organization_invites_organization_id_invited_user_id_key;
ALTER TABLE organization_invites DROP CONSTRAINT organization_invites_status_check;
ALTER TABLE organization_invites ADD CONSTRAINT organization_invites_status_check CHECK (status IN ('pending','accepted','declined','revoked','expired'));
ALTER TABLE organization_invites ADD COLUMN expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '14 days';
CREATE UNIQUE INDEX organization_invites_one_pending ON organization_invites (organization_id, invited_user_id) WHERE status = 'pending';
