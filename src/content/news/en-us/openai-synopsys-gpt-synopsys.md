---
title: OpenAI and Synopsys build GPT-Synopsys, a model that runs chip design tools on its own
summary: Engineers give it a design goal and the model runs Synopsys' EDA tools, reads the results, makes changes and iterates until the design checks out. OpenAI licenses the tools and the two share revenue, but there is no launch date, price or benchmark yet.
date: '2026-10-01'
order: 0
category: ai
publisher: Synopsys
sourceUrl: 'https://news.synopsys.com/2026-09-30-OpenAI-and-Synopsys-Announce-GPT-Synopsys-Frontier-Intelligence-to-Revolutionize-Chip-Design'
image: /news/openai-synopsys-gpt-synopsys/cover.webp?v=1
sources:
  - url: 'https://news.synopsys.com/2026-09-30-OpenAI-and-Synopsys-Announce-GPT-Synopsys-Frontier-Intelligence-to-Revolutionize-Chip-Design'
    label: 'Synopsys: OpenAI and Synopsys announce GPT-Synopsys'
  - url: 'https://www.investing.com/news/company-news/synopsys-openai-partner-on-ai-model-for-chip-design-93CH-4925728'
    label: 'Investing.com: Synopsys and OpenAI partner on an AI model for chip design'
  - url: 'https://www.business-standard.com/technology/artificial-intelligence/gpt-synopsys-openai-synopsys-team-up-to-build-gpt-model-for-ai-powered-chip-design-126100100428_1.html'
    label: 'Business Standard: OpenAI and Synopsys team up on a GPT model for chip design'
lead:
  - 'OpenAI and Synopsys announced GPT-Synopsys on Wednesday, a specialized model built on OpenAI''s frontier models that operates Synopsys'' electronic design automation (EDA) software. An engineer hands it a design objective, and the model runs the tools, interprets the results, implements changes and iterates toward a verified outcome. "With Synopsys, we''re bringing that work to chip design, helping engineers explore more designs and get to a working chip faster," said OpenAI president Greg Brockman.'
  - 'Under the multi-year agreement, OpenAI licenses Synopsys'' EDA tools to build the model, and the two companies share revenue and sell it together. GPT-Synopsys runs on OpenAI-hosted infrastructure and plugs into Synopsys.ai and Synopsys Autopilot, the company''s agentic platform. Early engagements with "leading semiconductor customers" are under way, and neither company named them or gave a launch date.'
---

## The loop it automates

Chip design is a long chain of tool runs: synthesis, placement, timing analysis, verification, and back again whenever a constraint fails. Each run produces reports that an engineer reads to decide the next change. GPT-Synopsys is pitched at that loop, the same shape as a coding agent that runs tests and fixes what breaks, applied to tools whose licenses are expensive and whose runs can take hours. It is also built to work inside customers' own agent harnesses, so a chip team can call it from the automation it already has.

The data terms are the part semiconductor companies will read first, because chip designs are some of the most guarded files in the industry. Synopsys says customer data is not used to train the model, is encrypted at rest and in transit, and comes with configurable retention, audit and permission controls. The model still runs in OpenAI's cloud, not on the customer's machines.

## What is missing

The announcement leaves out everything needed to judge it: the underlying model, any benchmark or productivity number, prices, the names of the customers testing it, and a date. Synopsys CEO Sassine Ghazi framed the goal as bringing "frontier intelligence to chip design to help more companies develop and accelerate advanced silicon." Until the first customers report results, only the companies in those early engagements can try it.
