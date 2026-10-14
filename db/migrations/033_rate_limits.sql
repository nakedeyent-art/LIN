-- Fixed-window request counters for abuse control (per remote address / per target). Rows older than a day are purged by the housekeeping job.
CREATE TABLE rate_limits (
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits INT NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_start)
);
