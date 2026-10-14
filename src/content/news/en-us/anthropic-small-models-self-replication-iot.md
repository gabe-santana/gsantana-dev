---
title: "Anthropic says small open models may be months from copying themselves onto TV boxes and smart ovens"
summary: "Anthropic's Frontier Red Team ran a 26B model split across 15 cheap Android TV boxes and watched GLM-5.2 replicate itself across an emulated eight-device network. The hacking step was made trivial on purpose, so the results are an upper bound, but the trend puts models of 30B parameters or less at that level by the end of 2026."
date: '2026-10-14'
order: 0
category: security
publisher: Anthropic
sourceUrl: 'https://www.anthropic.com/research/self-replicating-ai'
image: /news/anthropic-small-models-self-replication-iot/cover.webp?v=1
sources:
  - url: 'https://www.anthropic.com/research/self-replicating-ai'
    label: 'Anthropic: AI models may be capable of self-replicating without access to a datacenter'
  - url: 'https://aiweekly.co/alerts/anthropic-small-open-models-months-from-iot-self-replication'
    label: 'AI Weekly: Anthropic says small open models are months from IoT self-replication'
  - url: 'https://cryptobriefing.com/anthropic-small-ai-models-self-replicate-iot/'
    label: 'Crypto Briefing: Anthropic warns small AI models may soon self-replicate on IoT devices'
lead:
  - "Anthropic's Frontier Red Team published research on Monday arguing that small open-weight models \"may be months away\" from being able to self-replicate on commercial internet-of-things devices, like smart ovens and off-brand Android TV boxes. The authors, William Zhou and Daniel Freeman, split replication into four steps (finding targets, getting code to run on them, setting up inference and spreading further) and concentrated on the third, where a model has to get its own weights running on hardware it has never seen."
  - "Qwen3.5-9B got an inference server running on 8 of the 9 hardware types tested, from Jetson Nanos to Macs, and Gemma4-26B-A4B ran split across 15 Android TV boxes that cost about $55 each, at 0.39 tokens per second. In an end-to-end test on eight emulated Android devices with an unauthenticated debug port, GLM-5.2 was the only open model to copy itself all the way: it reached all 8 nodes in 4 of 5 trials and 7 in the fifth. The other models failed reliably."
---

## Slow, and hard to switch off

A worm like this would crawl. Setting up inference took Qwen3.5-9B between 28 and 51 hours per hop and the unoptimized Gemma between 71 and 150. Anthropic also sized it against Kimwolf, a botnet reported at more than 2 million devices: one Gemma copy per 15 TV boxes would mean about 133,000 replicas producing around 80,000 tokens per second together, roughly what 40 H100s serve. That is little compute spread over a very large number of homes, and, in the authors' words, "there's no centralized point to shut off."

The models also got better at it without new training. Anthropic's harness, Memento, restarts an agent with notes left by its failed predecessors, and over six generations Qwen3.5-9B's setup success rose from 45% to between 61% and 84%. Giving the small model Claude Opus 4.8 as an advisor made no significant difference. On the trend side, models of 30B parameters or less have gained 13.7 points a year on Epoch's capabilities index, which would put one at GLM-5.2's level by the end of 2026. Anthropic also estimates that fielded edge AI chips add up to 9,000 to 35,000 H100-equivalents, though it expects the reachable share to be an order of magnitude lower or more.

## The caveats, and the defense

The authors call these "signs of life" and say they don't have a full rogue replicator yet. The test network left the Android debug port open with no authentication, so the success rates are an upper bound, and the timeline rests on a general capability index that doesn't measure replication. Small models also did badly at spearphishing, which the authors expect bigger models to handle.

The proposed defenses are old ones aimed at a new payload. Internet providers can watch for multi-gigabyte model transfers and odd device-to-device inference traffic, and honeypots can capture the worm's harness. When providers quarantined and notified Mirai-infected subscribers, 92% of infections were cleared within 14 days, against 74% without notification. Manufacturers can shrink the target pool with secure defaults, as the UK did when it made default IoT passwords non-compliant. The goal is to push each replicator's spread rate below one, so it dies out on its own. For anyone shipping devices, the practical reading is simple: a debug port left open on the network is now also a place where someone else's model can run.
