-- Newsletter subscribers, in the site database (D1 "gsantana-dev-database", binding DB).
-- Apply: npx wrangler d1 execute gsantana-dev-database --remote --file=migrations/0001_newsletter_subscribers.sql
CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,          -- lower-cased, trimmed
  locale TEXT NOT NULL,                -- en-us | pt-br: language of the emails
  verified INTEGER NOT NULL DEFAULT 0, -- 1 once the confirmation link was opened
  token_hash TEXT,                     -- SHA-256 of the confirmation token (never the token)
  token_expires_at INTEGER,            -- epoch ms
  created_at INTEGER NOT NULL,         -- epoch ms
  verified_at INTEGER,                 -- epoch ms
  last_sent_at INTEGER,                -- epoch ms of the last confirmation email
  ip_hash TEXT                         -- salted SHA-256 of the sign-up IP, for rate limiting
);

CREATE INDEX IF NOT EXISTS idx_subscribers_token_hash ON subscribers (token_hash);
CREATE INDEX IF NOT EXISTS idx_subscribers_ip_recent ON subscribers (ip_hash, last_sent_at);
