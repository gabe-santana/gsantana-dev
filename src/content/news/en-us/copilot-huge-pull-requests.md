---
title: Inside GitHub's million-line pull request renderer
summary: 'The Copilot app team rebuilt its diff surface to keep enormous reviews responsive, even with hundreds of comments.'
date: '2026-09-23'
order: 1
category: engineering
publisher: GitHub Engineering
sourceUrl: 'https://github.blog/engineering/user-experience/rendering-huge-pull-requests-in-the-github-copilot-app/'
image: /news/copilot-huge-pull-requests/cover.webp
sources:
  - url: 'https://docs.github.com/en/copilot/how-tos/github-copilot-app/managing-issues-and-pull-requests'
    label: 'GitHub Docs: reviewing pull requests in the app'
  - url: 'https://react.dev/reference/react/Profiler'
    label: 'React: measuring render performance'
lead:
  - 'GitHub Engineering describes rebuilding the Copilot app''s pull request view for unusually large changes. Their stress case contained 2,200 files, more than a million changed lines, and over 400 inline comments.'
  - 'The article follows the performance work behind a responsive diff: instrumenting renders, testing scrolling and resizing, and checking the experience in the actual desktop app. It is a concrete look at UI engineering under extreme data volume.'
---

## A real stress case

The [engineering post](https://github.blog/engineering/user-experience/rendering-huge-pull-requests-in-the-github-copilot-app/) uses an actual open-source pull request with 2,200 files, more than a million changed lines, and over 400 comments. That is far beyond the pull request most teams see, which makes it a useful test of assumptions about scrolling, expansion, and comment rendering. The product must support review in its [Files changed view](https://docs.github.com/en/copilot/how-tos/github-copilot-app/managing-issues-and-pull-requests), not merely load a summary page.

GitHub describes two validation lanes: a headless probe that tracks render counts, performance timing, and frame smoothness; and an automated run through the real desktop app with cold and warm comment states. The distinction matters. A synthetic benchmark can show regressions quickly, while the real workflow catches awkward interactions a number cannot describe.

## A useful pattern for any large UI

Measure the expensive state transitions, not just first paint. Open details, resize the window, move deep into a file list, then return to comments. React's [Profiler documentation](https://react.dev/reference/react/Profiler) explains how to count component render work; it is one instrument, not the whole performance story. The lesson here is to make the worst realistic user journey part of the test suite before someone arrives with the million-line PR.
