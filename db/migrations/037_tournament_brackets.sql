-- Tournament Brackets, Teams, and Matches
-- Connects tournament bracket trees and live court schedules directly to events with real database persistence.

CREATE TABLE tournament_brackets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 160),
  sport TEXT NOT NULL CHECK(length(sport) BETWEEN 1 AND 60),
  format TEXT NOT NULL CHECK(format IN ('single_elimination', 'double_elimination')),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id)
);

CREATE TABLE tournament_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bracket_id UUID NOT NULL REFERENCES tournament_brackets(id) ON DELETE CASCADE,
  seed INT NOT NULL CHECK(seed >= 1),
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
  city TEXT NOT NULL DEFAULT '' CHECK(length(city) <= 100),
  record TEXT NOT NULL DEFAULT '' CHECK(length(record) <= 50),
  coach TEXT NOT NULL DEFAULT '' CHECK(length(coach) <= 100),
  UNIQUE(bracket_id, seed)
);

CREATE TABLE tournament_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bracket_id UUID NOT NULL REFERENCES tournament_brackets(id) ON DELETE CASCADE,
  match_key TEXT NOT NULL CHECK(length(match_key) BETWEEN 1 AND 50),
  round INT NOT NULL CHECK(round >= 1),
  round_name TEXT NOT NULL CHECK(length(round_name) BETWEEN 1 AND 100),
  bracket_type TEXT NOT NULL CHECK(bracket_type IN ('winners', 'losers', 'finals')) DEFAULT 'winners',
  court TEXT NOT NULL DEFAULT 'Main Court' CHECK(length(court) <= 100),
  scheduled_time TEXT NOT NULL DEFAULT '' CHECK(length(scheduled_time) <= 50),
  team_a_id UUID REFERENCES tournament_teams(id) ON DELETE SET NULL,
  team_b_id UUID REFERENCES tournament_teams(id) ON DELETE SET NULL,
  score_a INT CHECK(score_a IS NULL OR (score_a >= 0 AND score_a <= 999)),
  score_b INT CHECK(score_b IS NULL OR (score_b >= 0 AND score_b <= 999)),
  status TEXT NOT NULL CHECK(status IN ('scheduled', 'live', 'final')) DEFAULT 'scheduled',
  winner_id UUID REFERENCES tournament_teams(id) ON DELETE SET NULL,
  loser_id UUID REFERENCES tournament_teams(id) ON DELETE SET NULL,
  next_match_key TEXT CHECK(next_match_key IS NULL OR length(next_match_key) <= 50),
  next_match_slot TEXT CHECK(next_match_slot IS NULL OR next_match_slot IN ('teamA', 'teamB')),
  loser_match_key TEXT CHECK(loser_match_key IS NULL OR length(loser_match_key) <= 50),
  loser_match_slot TEXT CHECK(loser_match_slot IS NULL OR loser_match_slot IN ('teamA', 'teamB')),
  UNIQUE(bracket_id, match_key)
);

CREATE INDEX ON tournament_brackets(event_id);
CREATE INDEX ON tournament_matches(bracket_id);
