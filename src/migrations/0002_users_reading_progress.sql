-- Signed-in readers (GitHub OAuth, no scopes) and their synced reading progress.
-- Apply: npx wrangler d1 execute gsantana-dev-database --remote --file=migrations/0002_users_reading_progress.sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_id INTEGER NOT NULL UNIQUE,   -- stable across GitHub username changes
  login TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at INTEGER NOT NULL,         -- epoch ms
  last_login_at INTEGER NOT NULL       -- epoch ms
);

CREATE TABLE IF NOT EXISTS reading_progress (
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  article_key TEXT NOT NULL,           -- same key as the browser's progress map ("slug", "news/slug", ...)
  percent INTEGER NOT NULL,            -- furthest point reached, 1..100
  updated_at INTEGER NOT NULL,         -- epoch ms
  PRIMARY KEY (user_id, article_key)
);
