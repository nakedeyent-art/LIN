-- News: admin-managed sources (RSS/Atom) ingested into tagged items; per-user filter preferences.
CREATE TABLE news_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  feed_url TEXT NOT NULL UNIQUE CHECK (feed_url ~ '^https?://'),
  default_level TEXT CHECK (default_level IN ('high_school','college')),
  default_sport TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_fetched_at TIMESTAMPTZ,
  last_status TEXT,                              -- 'ok' or a short error; never a response body
  failures INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE news_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES news_sources(id),    -- NULL for LIN editorial posts
  url TEXT NOT NULL UNIQUE,
  source_name TEXT NOT NULL,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  summary TEXT CHECK (summary IS NULL OR char_length(summary) <= 300),
  published_at TIMESTAMPTZ NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  categories TEXT[] NOT NULL DEFAULT '{}',       -- rankings, reclassification, graduating_seniors, redshirt, powerhouse, general
  level TEXT CHECK (level IN ('high_school','college')),
  sport TEXT,
  hidden_at TIMESTAMPTZ
);
CREATE INDEX news_items_pub_idx ON news_items (published_at DESC) WHERE hidden_at IS NULL;
CREATE INDEX news_items_cat_idx ON news_items USING GIN (categories);

CREATE TABLE news_prefs (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  categories TEXT[] NOT NULL DEFAULT '{}',       -- empty = all
  levels TEXT[] NOT NULL DEFAULT '{}',
  sports TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
