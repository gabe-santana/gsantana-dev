---
title: Reflection AI unveils Beam, a 501B open-weight model it will release under Apache 2.0
summary: The sparse mixture-of-experts model activates 23B parameters per token, reads up to 1M tokens and, by Reflection's own numbers, competes with GLM 5.2 on coding and agent work. The weights, technical report and quantized versions are due later in October; for now there is only an early access program.
date: '2026-10-05'
order: 0
category: ai
publisher: Reflection AI
sourceUrl: 'https://reflection.ai/blog/introducing-beam'
image: /news/reflection-ai-beam-open-weight/cover.webp?v=1
sources:
  - url: 'https://reflection.ai/blog/introducing-beam'
    label: "Reflection AI: Introducing Beam, Reflection's 501B open-weight model"
  - url: 'https://siliconangle.com/2026/10/05/reflection-ai-debuts-open-source-beam-model-with-501b-parameters/'
    label: 'SiliconANGLE: Reflection AI debuts open-source Beam model with 501B parameters'
  - url: 'https://alphasignal.ai/news/reflection-ai-s-beam-challenges-deepseek-with-501b-open-weight-reasoning-model'
    label: "AlphaSignal: Reflection AI's Beam, a 501B open-weight reasoning model"
lead:
  - 'Reflection AI announced Beam on Monday, a text-only model with 501 billion total parameters, 23 billion of them active for each token, trained for coding, reasoning and agent work. It was pretrained on 23.8 trillion tokens on 6,144 NVIDIA GB300 GPUs in under four weeks, then spent another four weeks in reinforcement learning on about 10,500 GB300s, generating more than 100 million rollouts graded in 1.3 billion sandboxes. "Beam advances the Western open-weight frontier," the company wrote.'
  - 'Reflection says the weights will ship under the Apache 2.0 license later this month, together with a technical report, a model card, FP8 and NVFP4 quantized versions and tools to fine-tune it. Until then Beam is available only through an early access program. The startup, founded by former Google DeepMind researchers Misha Laskin and Ioannis Antonoglou, raised money at a $25 billion valuation a few months ago, according to SiliconANGLE.'
---

## Where it sits

Reflection's own table puts Beam at 77.2% on SWE-Bench Pro v2-Hard, 80.1% on Terminal Bench v2.1, 44.4% on DeepSWE v1.1, 97.8% on AIME 2026 and 90.5% on GPQA Diamond. The company calls it competitive with GLM 5.2, a model with about 250 billion more parameters, at three to four times less inference compute for similar reasoning scores, and close to Qwen 3.8-Max on coding and agent tasks. It also says Kimi K3 stays ahead on raw capability. Those three are the open models from Zhipu, Alibaba and Moonshot that have led open weights this year, and Beam is pitched at companies that want a model of that class from an American lab. On DeepSWE, the hardest of the coding tests, the closed frontier is still far off: Google reported 77.9% for [Gemini 4 Argon](/en-us/news/google-gemini-4-argon/) last week.

The design aims at serving cost. With 23 billion active parameters, each token costs about as much compute as a mid-size dense model, but all 501 billion still have to sit in memory: roughly 500 GB of weights in FP8 and about 280 GB in NVFP4, which means a multi-GPU server, not a workstation.

## What isn't out yet

Every number above comes from Reflection's own evaluation harness, and nobody outside the company can check them until the weights and serving code are public. The 1M-token context was reached during midtraining, while reinforcement learning ran at 256K, and a window the architecture supports says little about accuracy across all of it. The firm part of the announcement is the license: Apache 2.0 allows commercial use, modification and fine-tuning without the usage restrictions that come with custom model licenses. Whether the rest holds up will be clear once the weights ship later this month.
