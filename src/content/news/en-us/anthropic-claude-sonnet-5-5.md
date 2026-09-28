---
title: 'Anthropic releases Claude Sonnet 5.5: Opus-level agentic coding at a Sonnet price'
summary: The second model in the 5.5 family runs over 30% faster than Sonnet 5, costs up to 30% less per task, keeps the $2 and $10 per million token prices, and beats Opus 5.5 on Terminal-Bench.
date: '2026-09-28'
order: 0
category: ai
publisher: Anthropic
sourceUrl: 'https://www.anthropic.com/claude-sonnet-5-5'
image: /news/anthropic-claude-sonnet-5-5/cover.webp?v=1
sources:
  - url: 'https://www.anthropic.com/claude-sonnet-5-5'
    label: 'Anthropic: introducing Claude Sonnet 5.5'
  - url: 'https://techcrunch.com/2026/09/28/anthropic-releases-sonnet-5-5-which-it-calls-a-significantly-cheaper-faster-work-partner/'
    label: 'TechCrunch: Anthropic releases a cheaper, faster Sonnet 5.5'
  - url: 'https://thenextweb.com/news/sonnet-5-5-cyber-distillation'
    label: 'The Next Web: Sonnet 5.5 ships with the cyber limits of the top models'
lead:
  - 'Anthropic released Claude Sonnet 5.5 today, the second model in the 5.5 family, a few days after Opus 5.5. It is pitched as the everyday work partner: over 30% faster than Sonnet 5 at generating output and up to 30% cheaper per task, because it gets the same work done with fewer tokens and fewer tool calls. The per-token price did not change: $2 per million input tokens and $10 per million output tokens.'
  - 'The biggest jump is in agentic coding. On Terminal-Bench 4.0, Sonnet 5.5 scores 70.6%, against 10.3% for Sonnet 5 and 66.4% for Opus 5.5, which costs twice as much. It is available now on the Claude Platform, AWS, Google Cloud and Microsoft Azure as claude-sonnet-5-5, and Haiku 5.5 is coming "in the coming weeks".'
---

## The numbers that matter

Anthropic positions Sonnet 5.5 as strongest at well-scoped everyday tasks: fixing bugs and producing polished documents, slides and spreadsheets. The launch benchmarks show a model that comes close to Opus 5.5 on almost everything and beats it on one:

| Benchmark | Sonnet 5 | Sonnet 5.5 | Opus 5.5 |
|---|---|---|---|
| Terminal-Bench 4.0 | 10.3% | **70.6%** | 66.4% |
| CursorBench 4.0 | 34.1% | 55.5% | 57.8% |
| FrontierCode 1.1 (Max) | 42.4% | 46.2% | 54.4% |
| OSWorld 2.1 (computer use) | 57.0% | 80.1% | 81.8% |
| GDPval-AA v2.1 (knowledge work) | 1449 | 1844 | 1846 |
| Humanity's Last Exam (with tools) | 54.9% | 64.5% | 67.7% |

It is also the first Sonnet to beat Pokémon Red working only from screenshots, a test of stamina on long tasks and of image understanding.

## Cheaper per task, not per token

The list price is the same as Sonnet 5's, so the savings come from spending less. The customers quoted in the announcement give the scale: Balyasny Asset Management ran 2,441 finance tasks and saw the average drop from 497,000 to 121,000 tokens per answer; Box measured runs 2.4 times faster with 12% fewer tokens; Base44, across 118 real app builds, needed 3.6 iterations on average against 7.7 for Opus 5. For anyone running many agents in parallel, that is where Sonnet 5.5 beats Opus: nearly the same quality, half the price per token and fewer tokens per task.

## The first Sonnet with Opus-grade guardrails

Two safety changes reach a Sonnet for the first time. Higher-risk cybersecurity requests now visibly fall back to Sonnet 5, the same safeguards that used to exist only on the flagship models; defenders can apply for wider access through the Cyber Verification Program. And the model launches with classifiers that block reasoning extraction: preserved thinking is tied to the account that produced it. According to The Next Web, it answers the August episode in which researchers decoded 315,320 thinking blocks from 6,708 public agent traces and recovered credentials.

In practice, if you run Sonnet in production, the switch is mostly the model ID. Check two things first: the migration notes ask you to move the reasoning setting from `thinking_off` to `between_tools`, and binding reasoning to the account affects anyone who switches accounts in the middle of a Claude Code session.
