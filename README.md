# gsantana.dev

The source for **gsantana.dev** — a personal site about AI, programming, and
technology. Built with Next.js, exported fully static, and served from
Cloudflare Pages.

## Stack

- **Next.js 15** (App Router), statically exported (`output: "export"`) —
  there's no Node.js server in production, every route is pre-rendered HTML.
- **TypeScript**, **Tailwind CSS** for styling.
- **Markdown-driven blog** — posts are plain `.md` files with frontmatter,
  parsed at build time (`gray-matter` + a `unified`/`remark`/`rehype`
  pipeline) into static HTML, including syntax-highlighted code blocks
  (`rehype-pretty-code` / Shiki) with zero client-side highlighter JS.
- A small hand-rolled **parallax system** for the landing page hero — one
  shared scroll listener, `requestAnimationFrame`-batched, driving direct
  DOM transforms (no React re-renders, no animation library), and disabled
  under `prefers-reduced-motion`.
- **Cloudflare Pages** for hosting, plus a CDN in front of media (images/
  video) so large assets never bloat the deploy or the page weight.
- **Vitest** + Testing Library for unit tests.

## Project layout

This repo is structured with the actual Next.js project inside `src/`, and
tests as a sibling folder at the repo root:

```
.
├── src/                  # the Next.js project (package.json lives here)
│   ├── app/              # routes (App Router)
│   ├── components/       # UI components
│   ├── lib/              # markdown pipeline, post loading, helpers
│   └── posts/            # blog content — one markdown file per post
├── tests/                # Vitest test files
├── AGENTS.md             # conventions for AI coding agents working here
├── LICENSE
└── README.md
```

Because `src/` is the real project root, **all commands below are run from
inside `src/`**, not the repo root.

## Getting started

```bash
cd src
npm install
npm run dev
```

Open http://localhost:3000.

### Other commands (run from `src/`)

| Command              | What it does                                      |
| --------------------- | -------------------------------------------------- |
| `npm run dev`         | Local dev server with Turbopack                    |
| `npm run build`       | Production build → static export in `src/out/`     |
| `npm run lint`        | ESLint                                             |
| `npm run typecheck`   | `tsc --noEmit`                                     |
| `npm run test`        | Run the test suite once                            |
| `npm run test:watch`  | Run tests in watch mode                            |
| `npm run pages:preview` | Preview the built `out/` via `wrangler pages dev` |

## Writing a post

Add a markdown file to `src/posts/`, e.g. `src/posts/my-new-post.md`:

```markdown
---
title: "My new post"
description: "A one-line summary shown on cards and in metadata."
date: "2026-03-01"
tags: ["ai", "notes"]
cover: "/covers/my-new-post.jpg" # optional, resolved against the media CDN
draft: false # optional, defaults to false; drafts only render in `next dev`
---

Regular markdown / GFM. Code blocks are syntax-highlighted automatically:

\`\`\`ts
const answer = 42;
\`\`\`
```

The filename (minus `.md`) becomes the URL slug: `/blog/my-new-post`. Nothing
else needs to be registered — `getAllPostSummaries()` / `getPostSlugs()` in
[src/lib/posts.ts](src/lib/posts.ts) read the directory at build time.

## Writing a principle

Principles are the site's special, long-lived articles, listed at
`/principles`. Add one at `src/posts/principles/<category>/<slug>.md`, where
the category folder is `cloud`, `enterprise`, or `solution`:

```markdown
---
title: "Reliability"
short: "One-line summary shown on cards and as the page lead."
---
```

It's published at `/principles/<category>/<slug>`. While its body still
contains "Em Construção", it shows as **Coming soon** and isn't linked.

## Media / CDN

Images and video referenced from posts or components should go through
`mediaUrl()` in [src/lib/media.ts](src/lib/media.ts), which prefixes
root-relative paths (e.g. `/covers/foo.jpg`) with
`NEXT_PUBLIC_MEDIA_CDN_URL`. Absolute URLs pass through untouched. See
`src/.env.example` for the environment variables this reads.

Media lives in the `gsantana-dev` R2 bucket, served at
`https://cdn.gsantana.dev`. Keys mirror the site's URLs; nothing goes in
the bucket root:

| Prefix | For |
| --- | --- |
| `author/` | author avatar/photos |
| `shared/` | media reused across several posts (e.g. `jrdev.png`) |
| `posts/<slug>/` | media for one blog post |
| `principles/<category>/<slug>/` | media for one principle |

Reference them root-relative in markdown, e.g.
`<img src="/principles/cloud/cost-optimization/finops.svg">`. Upload from
`src/` with
`npm run r2:upload -- gsantana-dev/posts/my-post/diagram.svg --file=./diagram.svg`
(run `npx wrangler login` once first).

Because the site is statically exported, `next/image` runs with
`images.unoptimized: true` — resizing/format negotiation is expected to
happen at the CDN, not via Next's image server (which doesn't exist here).

## Deploying to Cloudflare Pages

1. Connect this repo in the Cloudflare Pages dashboard.
2. Set the project's **root directory** to `src`.
3. Build command: `npm run build`. Build output directory: `out`.
4. Add environment variables `NEXT_PUBLIC_SITE_URL` and
   `NEXT_PUBLIC_MEDIA_CDN_URL` in the Pages project settings.
5. Push to `main` — Cloudflare builds and deploys automatically.

To preview a production build locally against the Cloudflare runtime:

```bash
cd src
npm run build
npm run pages:preview
```

## License

All rights reserved — see [LICENSE](LICENSE). This is a personal site; the
source is visible for portfolio/reference purposes only and is **not**
licensed for reuse, redistribution, or self-hosting.
