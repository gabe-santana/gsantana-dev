---
title: OpenAI brings GPT-6 Sol and Luna to everyday AI work
summary: The new models aim to make stronger coding and agent capabilities faster and more affordable across the API and Codex.
date: '2026-09-22'
order: 1
category: ai
publisher: OpenAI
sourceUrl: 'https://openai.com/index/introducing-gpt-6-sol-and-luna/'
image: /news/gpt-6-sol-luna/cover.webp
sources:
  - url: 'https://developers.openai.com/api/docs/models/gpt-6-sol'
    label: 'OpenAI API: GPT-6 Sol model details'
  - url: 'https://developers.openai.com/api/docs/models/gpt-6-luna'
    label: 'OpenAI API: GPT-6 Luna model details'
  - url: 'https://developers.openai.com/api/docs/changelog'
    label: OpenAI API changelog
lead:
  - 'OpenAI has introduced GPT-6 Sol and GPT-6 Luna as faster, lower-cost additions to the GPT-6 family. The company says the models bring improvements in coding, computer use, factuality, and professional work to tasks that do not need the full depth of Astra.'
  - 'Both models are available through the API and Codex. OpenAI says their API prices are 50% lower than the promotional prices of their GPT-5.6 counterparts, while improved prompt caching can further reduce the cost of repeated context in long-running agents.'
---

## Two different jobs, one release

OpenAI positions [Sol](https://developers.openai.com/api/docs/models/gpt-6-sol) for complex coding and agent workflows and [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) for focused, high-volume work. The model pages list standard prices of $2 input and $10 output per million tokens for Sol, versus $0.10 input and $0.50 output for Luna. Both list a 1.05-million-token context window, but a larger window does not make a poorly scoped task cheaper or more reliable.

The [launch article](https://openai.com/index/introducing-gpt-6-sol-and-luna/) reports improvements on coding and agent evaluations and compares cost per task with rival models. Those benchmark comparisons come from OpenAI; they are useful directional evidence, not a substitute for testing your own prompts, tools, latency, and failure cases. The [API changelog](https://developers.openai.com/api/docs/changelog) confirms the model IDs and availability in the Responses and Chat Completions APIs.

## What I would benchmark

Run the same real task set through both models. Track finished-task quality, retries, tool calls, wall time, and total bill, not only token price. A cheap call that needs five retries can be the expensive choice. Sol may make sense for ambiguous, multi-step work; Luna may win when the task is narrow and repeated at scale. The right answer is in your workload, not in the model name.
