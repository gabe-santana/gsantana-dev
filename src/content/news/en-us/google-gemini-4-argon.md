---
title: Google announces Gemini 4 Argon, its new frontier model, and gives it to cyber defenders first
summary: Argon scores 77.9% on DeepSWE, against 74.2% for Claude Opus 5.5 and 74.1% for GPT-6 Astra, and can write up to 1 million tokens in one answer. It launches at $2 and $10 per million tokens, rising later to $4 and $20, once it reaches paid API customers and Google AI Ultra.
date: '2026-09-30'
order: 0
category: ai
publisher: Google
sourceUrl: 'https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-4-argon/'
image: /news/google-gemini-4-argon/cover.webp?v=1
sources:
  - url: 'https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-4-argon/'
    label: 'Google: Gemini 4 Argon, our next era of frontier intelligence'
  - url: 'https://9to5google.com/2026/09/30/gemini-4-argon-announcement/'
    label: '9to5Google: Gemini 4 Argon is Google''s new frontier model'
  - url: 'https://thenewstack.io/google-gemini-4-argon/'
    label: 'The New Stack: Gemini 4 Argon is here, and you can''t have it yet'
lead:
  - 'Google announced Gemini 4 Argon on Wednesday, the first model of its next generation, built for software engineering, enterprise knowledge work and cyber defense. Koray Kavukcuoglu, Google DeepMind''s chief AI architect, wrote that Argon "is fundamentally changing the way we work and build at Google," where it already runs thousands of internal workflows. The first outside users are the trusted cyber defenders in Google''s Fairwind Program. Google AI Ultra subscribers and paid API customers get it "soon", with no date yet.'
  - 'On DeepSWE v1.1, a coding benchmark, Argon scores 77.9%, against 74.2% for Claude Opus 5.5 and 74.1% for GPT-6 Astra. Its output limit goes from 64,000 tokens to 1 million, so a single answer can carry hundreds of thousands of tokens of reasoning and code. The introductory price is $2 per million input tokens and $10 per million output tokens, with cached input 95% cheaper; after the introductory period it becomes $4 and $20.'
---

## The numbers Google published

Besides DeepSWE, Google claims first place on AutomationBench, Zapier's test of end-to-end business workflows, with 51.3%; state of the art on LVBench, for long video, with 91.7%; and a tie for first on CWE-bench v1, which measures how well a model fixes security vulnerabilities, at 68%. It also says Argon leads the Vals Index across finance, coding, legal and tax work, and Harvey's benchmark for legal agents.

All of these come from Google's announcement, and nobody outside the Fairwind Program can check them yet. For reference, OpenAI published 75.2% on DeepSWE v1.1 for [GPT-6.1 Sol](/en-us/news/openai-devday-dots-gpt-6-1-sol/) on Tuesday, at the same $2 and $10 that Argon charges during its introductory period. Argon's standard price, $4 and $20, is what Claude Opus 5.5 costs today.

## An answer that can reach 1 million tokens

The output limit is the change developers will notice first. GPT-6.1 Sol stops at 128,000 output tokens; Argon can keep going to 1 million, and Google presents that headroom as the point: "When the model has the headroom to think deeply and generate hundreds of thousands of tokens in a single trajectory, it adds a new level of depth in reasoning to solve tough problems in one go."

It also changes the bill. A request that uses the whole limit costs $10 in output at the introductory price and $20 at the standard one, and it takes as long as generating a million tokens takes. When Argon reaches the API, set a maximum output per request and a spending alert before you point an agent at it.

## Defenders first

Argon was built partly for cyber defense, and Google is giving it first to vetted defenders, the same order Anthropic followed with Claude Mythos Preview. The week's news explains the caution: on Tuesday Anthropic's red team reported that [an open-weight model, GLM-5.3, already builds exploits almost as well as Mythos Preview](/en-us/news/anthropic-glm-5-3-cyber-capabilities/). Google hasn't given a date for the wider rollout, so for everyone else the numbers above are a promise to test when access opens.
