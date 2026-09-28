-- Access insights: one row per page view, written by POST /api/insights
-- (lib/access-insights-server.ts) when FLAG_TRACK_USER_ACCESS is "true".
-- Apply: npx wrangler d1 execute gsantana-dev-database --remote --file=migrations/0003_page_views.sql
CREATE TABLE IF NOT EXISTS page_views (
  id TEXT PRIMARY KEY,                 -- random per page view, made by the browser
  visitor_id TEXT NOT NULL,            -- localStorage gsantana_visitor, same browser across visits
  session_id TEXT NOT NULL,            -- ends after 30 min without a page view
  is_landing INTEGER NOT NULL,         -- 1 for the first page of a session
  created_at INTEGER NOT NULL,         -- epoch ms
  updated_at INTEGER NOT NULL,         -- epoch ms, last beacon for this view
  ip TEXT,
  country TEXT,                        -- request.cf fields, from the IP
  region TEXT,
  region_code TEXT,
  city TEXT,
  postal_code TEXT,
  latitude REAL,
  longitude REAL,
  cf_timezone TEXT,
  continent TEXT,
  asn INTEGER,
  as_organization TEXT,                -- ISP or company network
  colo TEXT,                           -- Cloudflare data center
  http_protocol TEXT,
  tls_version TEXT,
  user_agent TEXT,
  browser TEXT,                        -- parsed from user_agent; in-app browsers ("LinkedIn app") included
  browser_version TEXT,
  os TEXT,
  device_type TEXT,                    -- desktop, mobile, tablet, bot
  accept_language TEXT,
  host TEXT,
  path TEXT,
  query TEXT,
  page_title TEXT,
  page_locale TEXT,
  referrer TEXT,                       -- document.referrer, or the previous page after a client-side navigation
  source TEXT,                         -- utm_source (or ?ref=), else referrer_source
  referrer_source TEXT,                -- direct, internal, linkedin, google... or the referrer's host
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  click_id TEXT,                       -- gclid, fbclid, li_fat_id or msclkid
  screen_w INTEGER,
  screen_h INTEGER,
  viewport_w INTEGER,
  viewport_h INTEGER,
  pixel_ratio REAL,
  color_scheme TEXT,                   -- dark or light
  browser_language TEXT,
  browser_timezone TEXT,
  connection TEXT,                     -- navigator.connection.effectiveType
  device_memory REAL,
  cpu_cores INTEGER,
  touch INTEGER,
  ttfb_ms INTEGER,
  load_ms INTEGER,
  active_ms INTEGER NOT NULL DEFAULT 0, -- time the page was visible
  total_ms INTEGER NOT NULL DEFAULT 0,  -- time since the view started
  max_scroll_pct INTEGER NOT NULL DEFAULT 0,
  clarity_user_id TEXT,                -- Clarity's user and session ids, for cross analysis
  clarity_session_id TEXT,
  clarity_page_num INTEGER,
  github_login TEXT                    -- signed-in readers only
);

CREATE INDEX IF NOT EXISTS page_views_created_at ON page_views (created_at);
CREATE INDEX IF NOT EXISTS page_views_visitor ON page_views (visitor_id, created_at);
CREATE INDEX IF NOT EXISTS page_views_session ON page_views (session_id);
CREATE INDEX IF NOT EXISTS page_views_clarity_user ON page_views (clarity_user_id);
CREATE INDEX IF NOT EXISTS page_views_ip ON page_views (ip);
