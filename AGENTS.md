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
│   └── posts/      # content, one folder per locale: en-us/, pt-br/
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

Content is split per locale: `src/posts/<locale>/*.md` are blog posts and
`src/posts/<locale>/principles/…` are principles. **Every article exists in
every locale under the same file name** (`tests/i18n.test.ts` enforces it),
because the language switcher keeps the slug. Post frontmatter:

```yaml
title: string
description: string
date: "YYYY-MM-DD"
tags: string[]
cover: string   # optional, root-relative path resolved via mediaUrl()
draft: boolean  # optional, default false; drafts only render in `next dev`
```

The pipeline: `src/lib/posts.ts` reads `src/posts/<locale>/`, `gray-matter` splits
frontmatter from content, `src/lib/markdown.ts` renders the markdown body to
HTML via a `unified`/`remark`/`rehype` pipeline (GFM, heading anchors,
Shiki-based syntax highlighting through `rehype-pretty-code`) — entirely at
build time. `src/app/[lang]/blog/[slug]/page.tsx` generates one static page
per (locale, slug) pair. There
is no CMS, no database, and no runtime markdown parsing.

### Principles (second content type)

`src/posts/<locale>/principles/<category>/<slug>.md` are architecture
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

## Internationalization

- Every page is under `app/[lang]/` (`en-us`, `pt-br`), which is also a
  **root layout** (it owns `<html lang>`). `app/(root)/` is a second root
  layout used only by `/`. In production `/` never reaches it: the Pages
  Function `src/functions/index.ts` answers first with a 302 decided by
  `src/lib/locale-detection.ts` (cookie `gsantana_locale` from the
  switcher, else country via `request.cf.country`, else Accept-Language,
  else `en-us`). The static page's inline script (localStorage, then
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
