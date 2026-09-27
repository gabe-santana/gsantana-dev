---
title: Why GitHub shipped more CSS to make its site faster
summary: GitHub details its move away from CSS-in-JS and the performance tradeoffs behind the Primer migration.
date: '2026-09-25'
order: 2
category: engineering
publisher: GitHub Engineering
sourceUrl: 'https://github.blog/engineering/architecture-optimization/improving-site-performance-by-shipping-more-css/'
image: /news/github-ships-more-css/cover.webp
sources:
  - url: 'https://github.com/primer/react'
    label: Primer React source code
  - url: 'https://primer.style/product/getting-started/react/'
    label: Primer React usage guide
lead:
  - 'GitHub''s Primer team describes a full migration away from its previous CSS-in-JS approach. As component counts grew, client-side style initialization and server-side style collection became increasingly expensive.'
  - The engineering write-up explains why sending more static CSS can improve the overall experience. It is a useful reminder that the smallest stylesheet is not always the fastest page when runtime styling work is part of the bill.
---

## What the numbers actually say

In the [engineering account](https://github.blog/engineering/architecture-optimization/improving-site-performance-by-shipping-more-css/), GitHub says Primer components had moved to CSS Modules by December 2024. A rotating group of eight engineers then migrated 6,419 props over six months. The reported server-rendering improvements ranged from about 1% to 22% on measured pages. Those are GitHub's own measurements on GitHub's own workload, not a universal CSS Modules benchmark.

The old approach did work at runtime: styles needed to be initialized in the browser and collected during server rendering. With more components per page, that cost grew. Static CSS shifts some of the work into the build and the browser's native stylesheet machinery. The tradeoff is that the CSS payload can get larger; the relevant metric is the full page experience, not the stylesheet byte count in isolation.

## The practical lesson

If your React app has a similar bottleneck, profile server render time and client initialization before rewriting a design system. GitHub's [Primer React code](https://github.com/primer/react) and [usage guide](https://primer.style/product/getting-started/react/) show the scale of the system they were migrating. The decision came from observed costs at that scale. Shipping more CSS sounds backwards until you measure how much JavaScript you stopped asking every request to execute.
