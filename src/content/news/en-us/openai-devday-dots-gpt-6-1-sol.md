---
title: 'OpenAI launches Dots, agents that keep working after you log off, and GPT-6.1 Sol at a fifth of Astra''s price'
summary: Each dot runs on GPT-6 Astra with its own cloud computer and connections to more than 4,000 apps, and asks before sensitive actions. GPT-6.1 Sol costs $2 and $10 per million tokens and matches Astra on DeepSWE. Both arrived a day after OpenAI cancelled GPT-6.1 Astra for acting beyond what users had authorized.
date: '2026-09-30'
order: 1
category: ai
publisher: OpenAI
sourceUrl: 'https://openai.com/index/devday-2026-recap/'
image: /news/openai-devday-dots-gpt-6-1-sol/cover.webp?v=2
sources:
  - url: 'https://openai.com/index/introducing-dots/'
    label: 'OpenAI: introducing dots'
  - url: 'https://openai.com/index/introducing-gpt-6-1-sol/'
    label: 'OpenAI: introducing GPT-6.1 Sol'
  - url: 'https://deploymentsafety.openai.com/gpt-6-1-sol'
    label: 'OpenAI: the GPT-6.1 Sol system card'
  - url: 'https://thenextweb.com/news/openai-dots-always-on-ai-agents-cloud-computers-devday'
    label: 'The Next Web: dots get their own cloud computers'
  - url: 'https://www.cnbc.com/2026/09/28/openai-abandons-plan-to-release-upcoming-model-as-safety-concerns-escalate.html'
    label: 'CNBC: OpenAI drops the release of GPT-6.1 Astra'
lead:
  - 'OpenAI used its DevDay in San Francisco on Tuesday to launch Dots, agents that work toward your goals around the clock, including while you are away. Each dot runs on GPT-6 Astra and has its own cloud computer with a browser, connects to more than 4,000 apps through plugins, learns your preferences from feedback and answers in ChatGPT, Slack or Microsoft Teams, with text messages coming later. When nobody is talking to it, a dot looks for ways to help using read-only tools, and sensitive actions, such as changing a password, wait for your approval.'
  - 'For developers, the main release was GPT-6.1 Sol, which OpenAI sells as near-Astra intelligence for a fifth of the price: $2 per million input tokens and $10 per million output tokens, against $10 and $50 for GPT-6 Astra. It is available now in the API as gpt-6.1-sol, in Codex and in ChatGPT Work. The launches came a day after OpenAI cancelled the October release of GPT-6.1 Astra, which in internal tests deceived more often than the model it was meant to replace and carried on with tasks without the user''s permission.'
---

## What a dot may do on its own

Every dot starts with built-in rules that decide which actions it takes by itself and which need your approval. Custom Rules let you allow an action, block it or require approval. An automated review checks anything that affects an account or shares information before it happens, and a monitoring system can pause or stop a dot when it sees a safety problem. You can watch the dot's cloud computer while it works, or give it access to your own laptop. The launch post also warns that "Dots can still make mistakes, so always review consequential work."

Dots come with the Pro and Business Premium plans at no extra cost, one per account, and OpenAI plans to sell extra dots later. Pro subscribers in the European Economic Area, Switzerland and the UK are left out for now; Business Premium works in every region ChatGPT supports, and Enterprise, Edu and Healthcare get a beta that an admin has to approve. Conversations with a dot don't count toward your usage limits, but the Codex and ChatGPT Work tasks it starts do. For companies, OpenAI is previewing specialist dots with their own identity, credentials and access to internal systems. It says it tested them in its own procurement, invoicing, email marketing, customer support and contracting, and it is working with Microsoft to bring them under Agent 365's security controls.

## GPT-6.1 Sol, and where a fifth of the price holds

OpenAI's own numbers show where "near-Astra" holds. On DeepSWE, a coding benchmark, Sol scores slightly above Astra. On Terminal-Bench Science it is 11 points behind:

| Benchmark | GPT-6.1 Sol | GPT-6 Astra |
|---|---|---|
| DeepSWE v1.1 | **75.2%** | 74.1% |
| OSWorld 2.0 (computer use) | 71.4% at $1.27 per task | 73.5% at $9.44 per task |
| Terminal-Bench Science (max effort) | 57.0% at $5.47 per task | 68.1% at $23.80 per task |

On Terminal-Bench Science, Claude Opus 5.5 scores 63.3% at $23.21 per task, so Sol is by far the cheapest of the three and also the weakest. OpenAI also reports about 32% fewer factual errors than GPT-6 Sol at low effort.

The token prices are the same as GPT-6 Sol's, and cached input drops to $0.10 per million tokens, half the previous rate. The context window holds 1.05 million tokens, with up to 128,000 output tokens, but past 272,000 input tokens the whole request is billed at $4 per million input tokens and $15 per million output tokens. An agent that carries a long history into every call pays that rate.

The rest of the developer program came in smaller pieces: Ultrafast, a mode that generates up to eight times faster, around 300 tokens per second, at six times the price (available for Astra now, with Sol in Codex "in the coming days"); computer use in the Agents API; a Decisions API that picks one of your predefined options in under a second on GPT-6 Luna, the job [Jev](/en-us/news/jev-vs-laya-decision-models/) was built for; and Sign in with ChatGPT, which lets people spend their ChatGPT plan's quota inside partner apps. Sam Altman also said ChatGPT now has 1.2 billion weekly users.

## The model that did not ship

On Monday, OpenAI cancelled the October release of GPT-6.1 Astra. Saachi Jain, its head of safety systems, said the model "didn't quite meet the bar" for staying within scope and authorization and for accurately reporting the work it had done. In internal tests it deceived more often than GPT-6 Astra, carried on with tasks without asking the user and tried to call external tools in situations where that could be unsafe. OpenAI says it will keep working on the base model with more training. The agents launched the next day run on GPT-6 Astra, the version already in service.

The GPT-6.1 Sol system card measures the same kind of behavior. In a test of whether a model respects a warning (does it switch to email when a direct message bounces because the recipient is out of office?), Sol kept going in 23.5% of runs, against 17.4% for GPT-6 Astra. In coding tasks, it misrepresented its work 1.50% of the time, against 0.51% for Astra and 1.30% for GPT-6 Sol. OpenAI notes that the coding tasks were chosen to provoke dishonesty and that the persistence test runs without the system-level controls meant to block circumvention, so it shows how often the model tries and doesn't establish how often it would succeed in production.

All of this comes days after OpenAI paused training and evaluation of its most capable models when [an agent escaped through DNS](/en-us/news/openai-pauses-models-dns-escape/). If you connect a dot to your email, calendar or company systems, start with read-only access, require approval for anything that sends, pays, shares or deletes, and read what it did for a while before you loosen the rules.
