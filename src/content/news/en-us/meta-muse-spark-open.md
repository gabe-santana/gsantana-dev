---
title: "Meta releases Muse Spark Open, an 816B open-weight model built to run on two Mac Studios"
summary: "The mixture-of-experts model activates 42B of its 816B parameters per token, reads text, images, video and audio, and has a 1M-token context. Meta calls it the most capable US open-weight model, and its own table backs that up while still putting it behind GLM 5.3 and Kimi K3 on most agent and coding benchmarks."
date: '2026-10-16'
order: 0
category: ai
publisher: Meta
sourceUrl: 'https://research.meta.ai/blog/muse-spark-open'
image: /news/meta-muse-spark-open/cover.webp?v=1
sources:
  - url: 'https://research.meta.ai/blog/muse-spark-open'
    label: 'Meta AI Research: Muse Spark Open'
  - url: 'https://huggingface.co/meta-models/Muse-Spark-Open-816B-A42B'
    label: 'Hugging Face: Muse-Spark-Open-816B-A42B model card'
  - url: 'https://techcrunch.com/2026/10/15/meta-launches-an-open-weight-model-that-runs-on-macs/'
    label: 'TechCrunch: Meta launches an open-weight AI model that runs on Macs'
  - url: 'https://9to5mac.com/2026/10/15/meta-launches-new-muse-spark-open-model-optimized-to-run-on-mac-studio/'
    label: '9to5Mac: Meta launches new Muse Spark Open model, optimized to run on Mac Studio'
  - url: 'https://www.engadget.com/2287833/meta-built-a-huge-open-weight-ai-model-for-macs-but-youll-need-1tb-of-ram-to-run-it/'
    label: "Engadget: Meta built a huge open-weight AI model for Macs, but you'll need 1TB of RAM to run it"
lead:
  - "Meta released the weights of Muse Spark Open on Thursday, an open version of the model behind its Muse Spark family. It is a mixture-of-experts transformer with 816 billion parameters, of which 42 billion are active per token (8 of 256 experts per layer), a 1-million-token context window and native input of text, images, video and audio. The BF16 and NVFP4 checkpoints are on Hugging Face behind an access form, and hosted APIs are live on Baseten, Fireworks AI, Groq, Modal, Nebius, OpenRouter and Together AI."
  - "Meta built the launch around Apple hardware. Two Mac Studios with the M5 Ultra and 512 GB of unified memory each, linked over Thunderbolt 5 and splitting the model with MLX, hold the whole thing, which Meta describes as two machines that \"behave like one supercomputer with a terabyte of unified memory.\" The 512 GB configuration only ships later this month; Engadget notes that four 256 GB Mac Studios also work and cost about $38,000. On servers, the model card asks for about 2 TB of memory in BF16 and at least 700 GB of VRAM in NVFP4."
---

## Where it lands on Meta's own table

Meta calls it "the most capable US open-weight model to date," and the other US entries in its table back that up. Muse Spark Open scores 39 on the Artificial Analysis Intelligence Index, against 23 for Nvidia's Nemotron 3 Ultra, and beats [Reflection AI's Beam](/en-us/news/reflection-ai-beam-open-weight/) on 6 of the 8 benchmarks both report. It also edges [Mistral Large 4](/en-us/news/mistral-large-4/), at 38 on the index. It leads every model in the table on MCP-Atlas (89.2), JobBench (61.8), Humanity's Last Exam without tools (26.1) and AA Omniscience (25).

The same table shows where the open-weight frontier still is. Z.ai's GLM 5.3 scores 45 on the Intelligence Index and Kimi K3 scores 44. On coding and terminal work, Muse Spark Open gets 60 on DeepSWE 1.1 against 67 for GLM 5.3 and 68 for Kimi K3, and 76.4 on Terminal-Bench 2.1, below both of them and below Beam at 80.1. Every number is Meta's, run at its highest reasoning effort, so independent results will matter more than usual.

The safety columns are the starkest. Under adaptive StrongREJECT attacks the model complied 0.5% of the time, against 62.9% to 86.4% for the other open models tested, but it also refused more harmless requests on FORTRESS (17.4%, against 2.7% for Kimi K3). Meta says the open weights got extra safety post-training and recommends wrapping them in system-level guardrails, since none ship with the checkpoint.

## The license

The Muse Model License has no monthly-user cap. Its limit is on revenue: a company selling access to the model or its derivatives as a service must sign a separate agreement with Meta once that business passes $20 million in gross revenue over 12 months, while internal use and shipping it inside your own product don't trigger it. Products must show "Built with Muse Spark Open," Meta claims no rights to the outputs, and downloading the weights requires a form with your legal name, date of birth and organization.
