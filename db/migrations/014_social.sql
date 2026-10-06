-- Social feed: posts (text + one image), follows (guardian-approved for minors), likes, comments, reports, profile status + music.
CREATE TABLE posts (
  id BIGSERIAL PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,                 -- the author removed it
  hidden_at TIMESTAMPTZ,                  -- a moderator removed it (text kept for the record)
  hidden_by UUID REFERENCES users(id)
);
CREATE INDEX posts_author_idx ON posts (author_id, id DESC);
CREATE INDEX posts_recent_idx ON posts (id DESC) WHERE deleted_at IS NULL AND hidden_at IS NULL;

CREATE TABLE post_images (
  post_id BIGINT PRIMARY KEY REFERENCES posts(id),
  content_type TEXT NOT NULL CHECK (content_type IN ('image/png','image/jpeg')),
  size_bytes INT NOT NULL CHECK (size_bytes BETWEEN 1 AND 2097152),
  sha256 CHAR(64) NOT NULL,
  data BYTEA NOT NULL                     -- metadata (EXIF/GPS) already stripped
);

CREATE TABLE follows (
  follower_id UUID NOT NULL REFERENCES users(id),
  followee_id UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('pending','approved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_by UUID REFERENCES users(id),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
CREATE INDEX follows_followee_idx ON follows (followee_id, status);

CREATE TABLE post_likes (
  post_id BIGINT NOT NULL REFERENCES posts(id),
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE post_comments (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts(id),
  author_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  hidden_at TIMESTAMPTZ,
  hidden_by UUID REFERENCES users(id)
);
CREATE INDEX post_comments_post_idx ON post_comments (post_id, id);

CREATE TABLE content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('post','comment')),
  post_id BIGINT NOT NULL REFERENCES posts(id),
  comment_id BIGINT REFERENCES post_comments(id),
  reporter_id UUID NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL CHECK (reason IN ('harassment','inappropriate','off_platform_contact','spam','safety_minor','other')),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','dismissed','actioned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  resolution TEXT,
  CHECK ((kind = 'post' AND comment_id IS NULL) OR (kind = 'comment' AND comment_id IS NOT NULL))
);
CREATE UNIQUE INDEX content_reports_post_once ON content_reports (post_id, reporter_id) WHERE kind = 'post';
CREATE UNIQUE INDEX content_reports_comment_once ON content_reports (comment_id, reporter_id) WHERE kind = 'comment';
CREATE INDEX content_reports_open_idx ON content_reports (status, created_at);

CREATE TABLE profile_status (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  status_text TEXT CHECK (status_text IS NULL OR char_length(status_text) <= 80),
  music_provider TEXT CHECK (music_provider IN ('spotify','apple_music')),
  music_kind TEXT,
  music_id TEXT,
  music_label TEXT CHECK (music_label IS NULL OR char_length(music_label) <= 60),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((music_provider IS NULL) = (music_id IS NULL))
);
