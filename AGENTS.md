# AGENTS.md

Conventions for AI coding agents (and humans) working in this repo. Read
this before making changes.

## What this repo is

The source for **gsantana.dev**, a personal site (AI / programming /
technology) built with Next.js, statically exported, and deployed to
Cloudflare Pages with a CDN in front of media. See [README.md](README.md)
for the user-facing overview.

## Repo layout — important, non-standard

The Next.js project root is **`src/`**, not the repo root. `src/package.json`
is the real `package.json`; there is no root-level one on purpose.
`tests/` is a sibling of `src/`, at the repo root, not nested inside it.

```
.
├── src/            # Next.js project root — package.json, next.config.mjs,
│   │                 tsconfig.json, tailwind.config.ts etc. all live here
│   ├── app/        # App Router routes
│   ├── components/
│   ├── lib/
│   └── content/    # markdown: posts/, principles/, certifications/, news/,
│                     each with one folder per locale (en-us/, pt-br/)
├── tests/          # Vitest test files (sibling of src/, not inside it)
├── AGENTS.md
├── LICENSE
└── README.md
```

**Consequence: run every command from inside `src/`**, e.g.
`cd src && npm run dev`. Don't run `npm` from the repo root — there's
nothing there for it to find.

### Why tests/ can resolve packages from src/node_modules

Dependencies install into `src/node_modules` (because that's where
`package.json` is), but `tests/*.test.ts` files live one level up. Node's
module resolution only walks *upward* from an importing file looking for
`node_modules`, so a bare import inside `tests/` would fail to find, e.g.,
`vitest` or `@testing-library/*` — it can't see sideways into `src/`.

The fix is `src/scripts/link-root-node-modules.mjs`, wired up as the
`postinstall` script in `src/package.json`. It creates a link at the repo
root (`node_modules` → `src/node_modules`: a junction on Windows, a symlink
elsewhere) so the repo root becomes a shared ancestor both `src/` and
`tests/` can resolve through. It's idempotent and safe to re-run. If you add
a new top-level test-only dependency and tests suddenly can't resolve it,
this is the first thing to check — re-run `npm install` (or the script
directly) from `src/`.

Also note: `vitest.config.ts` sets `server.fs.allow` to include the repo
root, because Vite's dev-server file guard otherwise refuses to serve
`../tests/*` files (a separate restriction from module resolution).

## Content model

All markdown lives in `src/content/<type>/<locale>/`:
`content/posts/` (blog), `content/principles/<category>/`,
`content/certifications/` and `content/news/`. **Every article exists in
every locale under the same file name** (`tests/i18n.test.ts` enforces it),
because the language switcher keeps the slug. The folders only hold the
source: URLs come from the routes (`/<locale>/blog/<slug>/` for a post), so
reorganizing `content/` never changes a public URL. Post frontmatter:

```yaml
title: string
description: string
date: "YYYY-MM-DD"
tags: string[]
cover: string   # optional, root-relative path resolved via mediaUrl()
draft: boolean  # optional, default false; drafts only render in `next dev`
```

The pipeline: `src/lib/posts.ts` reads `src/content/posts/<locale>/`, `gray-matter` splits
frontmatter from content, `src/lib/markdown.ts` renders the markdown body to
HTML via a `unified`/`remark`/`rehype` pipeline (GFM, heading anchors,
Shiki-based syntax highlighting through `rehype-pretty-code`) — entirely at
build time. `src/app/[lang]/blog/[slug]/page.tsx` generates one static page
per (locale, slug) pair. There
is no CMS, no database, and no runtime markdown parsing.

### Principles (second content type)

`src/content/principles/<locale>/<category>/<slug>.md` are architecture
principles, shown at `/<locale>/principles/…`, loaded by
`src/lib/principles.ts`. Frontmatter is `title` and `short` (no date/tags).
The **folder is the category**; `PRINCIPLE_CATEGORIES` sets the order and
the dictionaries (`principles.categories`) the display names, so a new
category folder must be registered in both. A file whose body contains
"Em Construção" or "Under Construction" is treated as a placeholder: still
built as a page, but listed as "Coming soon" (not linked) and left out of
the sitemap. `getPostSlugs()` only reads top-level `.md` files, so
principles never leak into the blog list. Posts and principles share
`src/components/article-layout.tsx` (TOC, progress bar, author card,
comments). Each article has one locale-independent key (the post slug, or
`principles/<category>/<slug>`): reading progress and the giscus thread
use it, so both are shared across languages.

### News (third content type)

`src/content/news/<locale>/<slug>.md`, shown at `/<locale>/news/<slug>/` and
loaded by `src/lib/news.ts` into `newsStories` (newest first). The
frontmatter holds `title`, `summary`, `lead` (the opening paragraphs),
`sources` (`url` + a localized `label`) and the fields every locale shares:
`date`, `category` (`ai`, `engineering` or `security`), `publisher`,
`sourceUrl`, `image` and an optional `order` that breaks ties between
stories on the same date (lower first). The markdown body is the analysis
and starts with a `##` heading. `tests/news.test.ts` keeps the shared
fields identical across locales. The news page picks its lead story by slug
in `app/[lang]/news/page.tsx`.

### Diagrams in articles

Never ASCII art or box-drawing characters in a code block
(`tests/diagrams.test.ts` fails the build on one).

**Blog posts use canvas diagrams** (`src/lib/diagrams/`). A post places one
with a marker on its own line, `<div id="<diagram-id>-slot"></div>`, and the
blog page swaps it for `components/canvas-diagram.tsx`; an unknown id fails
the build. Each diagram is a spec in `lib/diagrams/<topic>.ts`, registered
in `lib/diagrams/index.ts`, written once for both locales with
`defineDiagram((t) => ...)` and `t(en, pt)` for every label. Specs describe
a grid, not pixels: `n(id, col, row, tone, title, detail)` nodes (fractional
cols/rows center a box between cells, `span` widens it), zones, and
`e(from, to)` edges whose `route` (`auto`, `hv`, `vh`, `hvh`, `straight`,
`u-right`...) `lib/diagrams/grid.ts` turns into paths. Every spec has a
desktop layout (760 wide) and a phone one (360 wide, drawn below 560px), plus
an `accessible` description that is the canvas's label and no-JS fallback.
The specs run on the server and the page receives plain data, so only the
renderer (`lib/diagrams/render.ts`) ships to the browser. The test checks
every layout for overlapping boxes and content outside the canvas; for the
rest, look at it: render it at both widths before you ship it. Keep a label
off lines and zone borders (move it into the box's detail if it won't fit).

**Principles use inline SVG** inside
`<figure class="diagram" data-pagefind-ignore><div class="diagram-canvas"><svg ...>`,
painted only with the `d-*` classes from the "Diagrams" block in
`app/globals.css` (boxes, lines, fills, text sizes on the site tokens), so
they need no JS and no hardcoded colors. The SVG keeps a 540px minimum
width and scrolls sideways on phones. Give it `role="img"` with a `<title>`
and `<desc>`, and prefix every id (markers, titles) with the article slug so
two diagrams on a page never collide. **No blank lines inside the figure**:
markdown ends the HTML block there and wraps the rest in `<p>` (a test in
`tests/principles.test.ts` catches this). A diagram that needs interaction
belongs in a client component mounted through `ArticleLayout`'s
`contentInsert` marker, like `agentic-mesh-diagram.tsx`.

## Internationalization

- Every page is under `app/[lang]/` (`en-us`, `pt-br`), which is also a
  **root layout** (it owns `<html lang>`). `app/(root)/` is a second root
  layout used only by `/`. In production `/` never reaches it: the Pages
  Function `src/functions/[[path]].ts` answers first, for `/` and for any
  other URL without a locale prefix (shared links), with a 302 decided by
  `src/lib/locale-detection.ts` (cookie `gsantana_locale` from the
  switcher, else country via `request.cf.country`, else Accept-Language,
  else `en-us`). It serves real root-level files as-is, 404s paths that
  don't exist in any locale, and `src/public/_routes.json` excludes
  `/en-us/*`, `/pt-br/*`, `/_next/*` and `/pagefind/*` so localized pages never invoke
  it. The static page's inline script (localStorage, then
  browser language) is the fallback for `next dev` and for function
  errors. `locale-detection.ts` and the function use relative imports, not
  `@/`, because the Pages Functions bundler doesn't know that alias. With two root layouts there is no shared 404, so
  `app/global-not-found.tsx` (experimental `globalNotFound`) renders the
  bilingual `out/404.html`.
- `src/lib/i18n.ts`: `locales`, `localeConfig` (BCP 47 tag, switcher label,
  giscus language), `localePath()`, `switchLocalePath()`.
- UI copy lives only in `src/lib/dictionaries/`. `en-us.ts` is the source
  of truth and `Dictionary` is its type, so `pt-br.ts` must match key for
  key. Interpolated strings use `{placeholder}` templates filled by
  `format()` (not functions), because client components receive them as
  props. Never hardcode user-visible text in components; add a key.
- Always build internal links with `localePath(locale, path)`. Components
  get `locale`/`dict` as props from the page; client components get only
  the strings they need.
- `src/lib/seo.ts#alternatesFor()` adds canonical + hreflang links; use it
  in every page's `generateMetadata`. The sitemap lists each locale with
  its alternates, and each locale has its own RSS feed at
  `/<locale>/feed.xml`.
- The language switcher uses `<Link scroll={false}>`: a client-side
  navigation between the same `[lang]` layout, so the page never reloads.
  Components holding locale-dependent client state need a `key={locale}`
  to reset on switch (see the hero typewriter).

When adding library functions for posts, keep them synchronous/pure where
possible (they only ever run at build time) and keep `getAllPostSummaries()`
cheap — it's called from the homepage, the blog index, the sitemap, and the
RSS feed.

## Static export constraints

`next.config.mjs` sets `output: "export"`. This means:

- No Server Components with request-time data fetching, no Route Handlers
  that depend on the incoming request, no Server Actions, no ISR/revalidate
  at runtime, no middleware. Everything must be resolvable at `next build`
  time.
- Any Route Handler (`route.ts`) must set `export const dynamic =
  "force-static"` or the build fails. See `src/app/[lang]/feed.xml/route.ts`,
  `src/app/sitemap.ts`, `src/app/robots.ts` for the pattern.
- `next/image` runs with `images.unoptimized: true` (there's no image
  optimization server in a static export). Don't rely on Next's on-demand
  image resizing — that job belongs to the CDN in front of media (see
  `src/lib/media.ts` / `mediaUrl()`).
- Don't add anything that requires `@cloudflare/next-on-pages` or an edge
  runtime unless you're deliberately moving off static export — that's a
  bigger architectural change, not a drive-by addition.

## Search

Static, serverless full-text search with [Pagefind](https://pagefind.app).
`npm run build` is `next build && node scripts/build-search-index.mjs`: the
script indexes the *exported HTML* (so the index matches what readers see)
and writes `out/pagefind/`. Pagefind splits the index into small chunks, and
a query downloads only the chunks for its terms plus one fragment per shown
result, so the cost of a search stays roughly flat as the site grows (a
5,000-article synthetic test fetched a few hundred KB per query out of a
65 MB index).

- **What gets indexed:** only elements with `data-pagefind-body`, which
  `ArticleLayout` puts on the header, the TL;DR box and the article body.
  Any page without it (lists, home, about, 404) is left out automatically;
  a new article type gets search for free by using `ArticleLayout`. Use
  `data-pagefind-ignore` for text inside those regions that shouldn't match
  (tag badges, the TL;DR label). Code blocks (`pre`) are excluded in the
  script because they make unreadable excerpts.
- **Languages:** Pagefind builds one index per `<html lang>` and the browser
  picks the one matching the current page. Because the language switcher
  changes `<html lang>` without a reload, `components/search-box.tsx`
  keys its Pagefind instance by locale and re-initializes it on switch.
- **UI:** `components/search-box.tsx`, an inline search field on the
  landing page, right below the hero's grid, with results listed under it
  (not in the nav, by the owner's choice). `/` or Ctrl/Cmd+K focuses it.
  `pagefind.js` is imported lazily (on focus, with `webpackIgnore`), so the
  page pays nothing until someone searches. Result kinds come from the URL
  (`lib/search.ts`).
- **`next dev` has no exported HTML**, so `npm run dev` first runs
  `scripts/build-dev-search-index.mjs` (`predev`): it indexes the markdown
  under `content/` directly into `public/pagefind/` (gitignored). Content
  edited during a dev session shows up in search after restarting `dev`.
  The production build deletes that copy and writes the real index, so the
  two never mix. If you add a content type, add it to the dev script too.
- Pagefind is typo tolerant and falls back to partial matches, so a query
  rarely returns nothing. That's expected.

## Stock ticker (news page)

`components/stock-ticker.tsx` reads `GET /api/quotes`, a Pages Function
(`functions/api/quotes.ts`) that fetches Finnhub quotes for
`TICKER_SYMBOLS` (`lib/quotes.ts`) server-side and caches them at the edge
for 5 minutes, keeping the last good response for a day as an outage
fallback. The Finnhub key is the Pages secret `FINNHUB_API_KEY` (production
and preview); it must never appear in client code or the repo. `next dev`
runs no Functions, so `predev` saves one real snapshot to
`public/dev-quotes.json` (gitignored) from `FINNHUB_API_KEY` in
`src/.env.local`, and `scripts/remove-dev-artifacts.mjs` strips it from the
build. With no data at all, the strip hides itself.

## Newsletter (double opt-in, our own)

The form on `/news` (`components/newsletter-form.tsx`) posts to
`POST /api/newsletter/subscribe` (`functions/api/newsletter/subscribe.ts`),
which stores a pending row in D1 and emails a confirmation link through Zoho
ZeptoMail. The link opens `/<locale>/newsletter/confirm/?token=...`, whose
client component calls `POST /api/newsletter/verify` and shows the welcome.
Verification is a POST from the page, never a GET link: mail scanners open
links, and a verifying GET would let them confirm addresses by themselves.

- **Rules** (`lib/newsletter-server.ts`, unit-tested with an in-memory
  store): tokens are 256 random bits and only their SHA-256 is stored; links
  expire after 48 h and a resend invalidates the previous one; same-address
  resends wait 10 min; one IP can sign up 5 addresses per hour (salted IP
  hash, never the raw IP); verified addresses are never emailed again and
  get an "already subscribed" answer instead (this reveals membership, a
  deliberate choice for a personal newsletter; pending addresses answer like
  new ones); a honeypot field
  catches naive bots; the API only accepts same-origin requests.
- **D1:** database `gsantana-dev-database` (the site's general database),
  bound as `DB` in production and preview. Schema changes go in
  `migrations/` and are applied with
  `npx wrangler d1 execute gsantana-dev-database --remote --file=...`.
- **Secrets/vars** (Pages project): `ZEPTOMAIL_TOKEN` (secret),
  `NEWSLETTER_FROM` (verified sender), optional `NEWSLETTER_FROM_NAME` and
  `ZEPTOMAIL_API_URL` (non-US data centers). Without them, sign-ups answer
  `send_failed`. `NEWSLETTER_MAILER=log` prints the link instead of emailing
  it, for local `wrangler pages dev` only.
- `next dev` runs no Functions, so the form can't subscribe there.
- **Sending issues is not ZeptoMail's job:** its policy allows
  transactional mail only (the confirmation email qualifies; newsletters
  don't) and accounts are reviewed. Issues go out through Zoho Campaigns,
  which adds the unsubscribe link and headers itself.
  `npm run newsletter:export [-- --since YYYY-MM-DD]` writes the confirmed
  subscribers to `subscribers-<date>.csv` (gitignored, personal data) for
  import into the Campaigns list; delete the file after importing.
- The old Zoho Campaigns sign-up form code is kept, commented out, in
  `lib/newsletter-zoho.ts`.

## Sign in with GitHub + synced reading progress

A small user service on Pages Functions (`functions/api/auth/{login,callback,logout}.ts`,
`functions/api/me.ts`, `functions/api/progress.ts`) with D1 tables `users`
and `reading_progress` (`migrations/0002_*`). All logic is in
`lib/user-server.ts`: handlers take a `Request` and return a `Response`, so
the same code runs in Functions and in the `next dev` stand-ins.

- **OAuth App, no scopes:** the token can only read the public profile and
  is used once in the callback, never stored. `state` + an HttpOnly cookie
  guard against login CSRF; `returnTo` only accepts local paths.
- **Session:** `gs_session`, an HttpOnly cookie holding `payload.HMAC`
  (key `SESSION_SECRET`), 30 days, no session table. `gs_signed_in=1` is a
  non-secret, script-readable companion: pages only call the API when it's
  present, so anonymous visitors cost zero Function invocations.
- **giscus:** its sessions are minted by giscus.app, so the site can't
  create one. Instead the callback redirects through
  `giscus.app/api/oauth/authorize`: one click signs into both (GitHub asks
  for giscus's consent only the first time). `lib/user-client.ts` stores
  the returned `?giscus=` session in `localStorage["giscus-session"]` (the
  key giscus reads) on any page; `?signin=1` marks a site-started sign-in
  so the comments box doesn't scroll to itself. Signing out clears it too.
- **Progress sync** (`lib/user-client.ts`, `components/progress-sync.tsx`):
  localStorage stays the UI's source. Saves are batched and sent with
  `sendBeacon` on page hide; D1 is pulled only when the last pull is over
  24 h old or right after signing in; merges keep the maximum per article
  on both sides. The profile is cached for 12 h.
- **Deletion:** "Delete my data" (`DELETE /api/me`) removes the user and
  their progress (LGPD).
- **OAuth Apps:** one per callback host (GitHub allows one callback URL):
  production `https://gsantana.dev/api/auth/callback`, local
  `http://localhost:3000/api/auth/callback`. So sign-in doesn't work on
  `*.pages.dev` previews. Pages secrets: `GITHUB_CLIENT_ID`,
  `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`.
- **`next dev`:** `route.dev.ts` files under `app/api/` stand in for the
  Functions (next.config.mjs registers `.dev.ts` and drops
  `output: "export"` only for the dev server), with in-memory stores
  (`lib/user-dev.ts`, `lib/newsletter-dev.ts`). Without `GITHUB_CLIENT_ID`
  in `src/.env.local`, "Sign in" logs in a fake `dev-reader`.

## Session recordings (Microsoft Clarity, first-party proxy)

`components/session-insights.tsx` loads Clarity (project `yol0e2ogzk`)
from `/r/t.js` instead of clarity.ms, so content blockers that list
clarity.ms don't drop it. `functions/r/[[path]].ts` proxies:
`/r/t.js` (the tag, rewritten by `lib/clarity-proxy.ts#rewriteClarityTag`),
`/r/s/<version>/clarity.js` (main script, edge-cached a day),
`POST /r/c/<shard>` (uploads, forwarded to `<shard>.clarity.ms/collect`
with the visitor IP in X-Forwarded-For) and `/r/p` (the ad cookie-sync
pixel, answered with 204). The path is deliberately neutral: "clarity",
"analytics" or "track" would match blocklist path rules.

- Only `gsantana.dev` loads it (not previews or `next dev`), and never when
  the browser sends Global Privacy Control.
- The newsletter form and the account menu carry `data-clarity-mask`.
- The rewrite throws if Clarity's loader gains an unknown clarity.ms
  endpoint; the test uses a real captured loader. If recordings stop after
  a Clarity update, check the function logs first.
- The disclosure text is `site.recordingNotice` in the dictionaries; the
  owner is still deciding where to show it (currently not rendered).

## The parallax system

`src/components/parallax/parallax-provider.tsx` + `parallax-layer.tsx`.
Deliberately not a library (no `framer-motion`, no `react-scroll-parallax`):
one scroll listener, one `requestAnimationFrame` loop, shared by every
`<ParallaxLayer speed={…}>` on the page. Layers mutate their own DOM node
directly via a ref — not through React state — so adding more parallax
layers doesn't add more listeners or more re-renders. It also respects
`prefers-reduced-motion` (the effect no-ops entirely).

If you touch this: keep it dependency-free and keep the "one listener
total" property. If you need scroll-linked *motion* elsewhere, subscribe
through the existing `useParallax()` context rather than adding a second
listener.

The post table of contents (`src/components/table-of-contents.tsx`) is the
one exception: its scroll-spy has its own rAF-throttled listener because
the parallax provider no-ops under `prefers-reduced-motion`, and the TOC
must still track the active section for those users. Headings for it are
extracted at build time by `src/lib/rehype-extract-headings.ts` (h2/h3,
after `rehype-slug`), and returned from `renderMarkdown()` alongside the
HTML. `ACTIVE_LINE_PX` in the component and `scroll-margin-top` on post
headings in `globals.css` are coupled — change them together.

## Conventions

- No comments explaining *what* code does; only *why*, for genuinely
  non-obvious constraints (see the static-export and node_modules-linking
  notes above for the kind of thing that deserves a comment).
- Prefer Server Components; reach for `"use client"` only where there's
  actual interactivity or browser APIs (parallax, anything with
  `useEffect`/refs/event listeners).
- Path alias `@/*` resolves to `src/*` (defined in `src/tsconfig.json`).
- Before committing: `npm run typecheck && npm run lint && npm run test &&
  npm run build`, all from `src/`.

## License

All rights reserved (see [LICENSE](LICENSE)) — this is a personal site, not
an open-source project. Don't add an OSI license file, don't add a
`CONTRIBUTING.md` inviting PRs, and don't suggest making the repo license
more permissive unless the user explicitly asks.
