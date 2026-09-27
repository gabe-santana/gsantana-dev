---
title: GPT-6 prompt caching gets diagnostics and explicit breakpoints
summary: New tools help developers spot cache misses and control reused context in long-running agent workflows.
date: '2026-09-22'
order: 2
category: ai
publisher: OpenAI
sourceUrl: 'https://openai.com/index/better-prompt-caching-for-gpt-6/'
image: /news/gpt-6-prompt-caching/cover.webp
sources:
  - url: 'https://developers.openai.com/api/docs/guides/prompt-caching'
    label: 'OpenAI API: prompt caching guide'
  - url: 'https://developers.openai.com/api/docs/guides/prompt-caching/diagnostics'
    label: 'OpenAI API: cache diagnostics'
lead:
  - 'OpenAI has updated prompt caching for GPT-6 with higher default hit rates, a dashboard for monitoring reuse, and diagnostics that explain why a request missed the cache. Developers can also place explicit breakpoints in prompt prefixes.'
  - 'The changes target agents that make many related API calls and repeatedly send the same instructions, tools, and context. OpenAI says cached input can receive discounts of up to 90%, making cache behavior a meaningful part of production agent costs.'
---

## The part of an agent bill you can design

The [caching guide](https://developers.openai.com/api/docs/guides/prompt-caching) says reuse depends on an exact shared prefix and compatible request settings. For GPT-5.6 and later, at least 1,024 eligible input tokens are needed. A stable block of instructions and tool definitions can be cached; frequently changing context belongs after it. Explicit breakpoints let an application choose where a reusable prefix ends.

There is a cost tradeoff. OpenAI documents cache writes at 1.25 times the uncached input rate and reads at 0.1 times that rate for these models. If a prefix will only be used once, writing it is no bargain. Reused across a long agent session, it can be. The [diagnostics guide](https://developers.openai.com/api/docs/guides/prompt-caching/diagnostics) lets a developer compare requests and inspect reasons such as changed tools or settings when an expected hit fails.

## Measure before celebrating

The [announcement](https://openai.com/index/better-prompt-caching-for-gpt-6/) includes customer savings examples, but those are specific workloads. Track cache hit rate, cache-write tokens, latency, and total cost across representative conversations. A session ID by itself does not guarantee a hit. If the prompt structure changes every turn, the cache cannot rescue an unstable architecture.
