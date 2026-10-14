-- Travel stops connect to the people and paperwork of the trip: named contacts (host, driver, hotel desk, chaperone) and the documents that
-- must travel with the athlete (waivers, itineraries, consent forms). Tasks and expenses already carry stop_id.
CREATE TABLE travel_stop_contacts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), stop_id UUID NOT NULL REFERENCES travel_stops(id) ON DELETE CASCADE,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120), role TEXT NOT NULL DEFAULT '' CHECK(length(role) <= 60),
 phone TEXT NOT NULL DEFAULT '' CHECK(length(phone) <= 40), email TEXT NOT NULL DEFAULT '' CHECK(length(email) <= 254), notes TEXT NOT NULL DEFAULT '' CHECK(length(notes) <= 500),
 created_by UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON travel_stop_contacts(stop_id);
CREATE TABLE travel_stop_documents (
 stop_id UUID NOT NULL REFERENCES travel_stops(id) ON DELETE CASCADE, document_id UUID NOT NULL REFERENCES athlete_documents(id) ON DELETE CASCADE,
 linked_by UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(stop_id, document_id)
);
CREATE INDEX ON operational_tasks(stop_id) WHERE stop_id IS NOT NULL;
CREATE INDEX ON operational_expenses(stop_id) WHERE stop_id IS NOT NULL;
