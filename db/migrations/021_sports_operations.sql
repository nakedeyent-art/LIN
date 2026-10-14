CREATE TABLE sports_seasons (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID REFERENCES organizations(id),
 created_by UUID NOT NULL REFERENCES users(id),name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120), starts_on DATE NOT NULL, ends_on DATE NOT NULL CHECK(ends_on>=starts_on)
);
CREATE TABLE sports_venues (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),organization_id UUID REFERENCES organizations(id),created_by UUID NOT NULL REFERENCES users(id),
 name TEXT NOT NULL,address TEXT NOT NULL,contact_name TEXT,contact_details TEXT,latitude NUMERIC CHECK(latitude BETWEEN -90 AND 90),longitude NUMERIC CHECK(longitude BETWEEN -180 AND 180)
);
CREATE TABLE sports_event_details (
 event_id UUID PRIMARY KEY REFERENCES events(id),organization_id UUID REFERENCES organizations(id),season_id UUID REFERENCES sports_seasons(id),venue_id UUID REFERENCES sports_venues(id),
 kind TEXT NOT NULL CHECK(kind IN ('game','camp','combine','showcase','visit','tournament','practice')),
 starts_at TIMESTAMPTZ NOT NULL,ends_at TIMESTAMPTZ NOT NULL CHECK(ends_at>starts_at),timezone TEXT NOT NULL DEFAULT 'UTC',notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE sports_attendees (
 event_id UUID NOT NULL REFERENCES events(id),athlete_id UUID NOT NULL REFERENCES users(id),
 availability TEXT NOT NULL DEFAULT 'unknown' CHECK(availability IN ('unknown','available','unavailable','tentative')),
 attendance TEXT NOT NULL DEFAULT 'expected' CHECK(attendance IN ('expected','attended','absent')),
 guardian_consent_by UUID REFERENCES users(id),guardian_consent_at TIMESTAMPTZ,
 PRIMARY KEY(event_id,athlete_id)
);
CREATE TABLE travel_routes (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),athlete_id UUID NOT NULL REFERENCES users(id),organization_id UUID REFERENCES organizations(id),
 created_by UUID NOT NULL REFERENCES users(id),name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE travel_stops (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),route_id UUID NOT NULL REFERENCES travel_routes(id),event_id UUID REFERENCES events(id),venue_id UUID REFERENCES sports_venues(id),
 sequence INT NOT NULL CHECK(sequence>0),name TEXT NOT NULL,departure_at TIMESTAMPTZ NOT NULL,arrival_at TIMESTAMPTZ NOT NULL CHECK(arrival_at>=departure_at),
 mode TEXT NOT NULL CHECK(mode IN ('flight','bus','car','train','walk','other')),details TEXT NOT NULL DEFAULT '',hotel TEXT NOT NULL DEFAULT '',contact TEXT NOT NULL DEFAULT '',UNIQUE(route_id,sequence)
);
CREATE TABLE operational_tasks (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),athlete_id UUID NOT NULL REFERENCES users(id),organization_id UUID REFERENCES organizations(id),
 event_id UUID REFERENCES events(id),deal_id UUID REFERENCES deals(id),stop_id UUID REFERENCES travel_stops(id),document_id UUID REFERENCES athlete_documents(id),
 created_by UUID NOT NULL REFERENCES users(id),assigned_to UUID NOT NULL REFERENCES users(id),title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
 due_at TIMESTAMPTZ NOT NULL,status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','done','cancelled')),created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE operational_expenses (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),athlete_id UUID NOT NULL REFERENCES users(id),organization_id UUID REFERENCES organizations(id),event_id UUID REFERENCES events(id),stop_id UUID REFERENCES travel_stops(id),
 created_by UUID NOT NULL REFERENCES users(id),description TEXT NOT NULL CHECK(length(description) BETWEEN 1 AND 200),amount_cents BIGINT NOT NULL CHECK(amount_cents BETWEEN 0 AND 100000000),
 currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency='USD'),status TEXT NOT NULL DEFAULT 'estimate' CHECK(status IN ('estimate','submitted','approved','reimbursed','rejected')),
 receipt_document_id UUID REFERENCES athlete_documents(id),created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE operations_reminders (
 resource_type TEXT NOT NULL,resource_id TEXT NOT NULL,user_id UUID NOT NULL REFERENCES users(id),sent_on DATE NOT NULL DEFAULT CURRENT_DATE,
 PRIMARY KEY(resource_type,resource_id,user_id,sent_on)
);
CREATE INDEX ON sports_attendees(athlete_id,event_id);
CREATE INDEX ON operational_tasks(athlete_id,due_at);
CREATE INDEX ON travel_routes(athlete_id);
