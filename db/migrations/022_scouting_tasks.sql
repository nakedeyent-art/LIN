CREATE TABLE scouting_stages (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),owner_id UUID NOT NULL REFERENCES users(id),name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 30),position INT NOT NULL DEFAULT 0,UNIQUE(owner_id,name)
);
CREATE TABLE scouting_templates (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),owner_id UUID NOT NULL REFERENCES users(id),sport TEXT NOT NULL,name TEXT NOT NULL,criteria TEXT[] NOT NULL CHECK(cardinality(criteria) BETWEEN 1 AND 20)
);
CREATE TABLE scouting_reports (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),athlete_id UUID NOT NULL REFERENCES users(id),organization_id UUID REFERENCES organizations(id),author_id UUID NOT NULL REFERENCES users(id),
 event_id UUID REFERENCES events(id),template_id UUID REFERENCES scouting_templates(id),title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
 notes TEXT NOT NULL CHECK(length(notes)<=10000),film_url TEXT,evaluation JSONB NOT NULL DEFAULT '{}',measurables TEXT NOT NULL DEFAULT '',
 intentionally_shared BOOLEAN NOT NULL DEFAULT false,observed_on DATE NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE scouting_followups (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),report_id UUID NOT NULL REFERENCES scouting_reports(id),owner_id UUID NOT NULL REFERENCES users(id),title TEXT NOT NULL,due_on DATE NOT NULL,done BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE scouting_activity (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,athlete_id UUID NOT NULL REFERENCES users(id),actor_id UUID NOT NULL REFERENCES users(id),report_id UUID REFERENCES scouting_reports(id),action TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE scouting_watch_state (
 recruiter_id UUID NOT NULL REFERENCES users(id),athlete_id UUID NOT NULL REFERENCES users(id),profile_digest TEXT NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),PRIMARY KEY(recruiter_id,athlete_id)
);
CREATE INDEX ON scouting_reports(author_id,athlete_id,created_at DESC);
