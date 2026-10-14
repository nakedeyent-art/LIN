CREATE TABLE organization_invites (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id), invited_user_id UUID NOT NULL REFERENCES users(id),invited_by UUID NOT NULL REFERENCES users(id),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE(organization_id,invited_user_id)
);
