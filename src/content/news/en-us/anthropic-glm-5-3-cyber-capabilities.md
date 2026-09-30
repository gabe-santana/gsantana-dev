---
title: Anthropic says open-weight GLM-5.3 builds exploits almost as well as Claude Mythos Preview
summary: In Anthropic's tests, Z.ai's model turned known bugs in Chrome's V8 engine into working exploits in 12% of attempts, against 14% for Mythos Preview and close to zero for earlier models. Telling it that it was a red-team agent got past its refusals 64% of the time, and anyone can download the weights.
date: '2026-09-29'
order: 1
category: security
publisher: Anthropic
sourceUrl: 'https://www.anthropic.com/research/glm-5-3-and-the-spread-of-advanced-cyber-capabilities'
image: /news/anthropic-glm-5-3-cyber-capabilities/cover.webp?v=1
sources:
  - url: 'https://www.anthropic.com/research/glm-5-3-and-the-spread-of-advanced-cyber-capabilities'
    label: 'Anthropic: GLM-5.3 and the spread of advanced cyber capabilities'
  - url: 'https://www.nist.gov/news-events/news/2026/09/caisis-assessment-zais-glm-53-cyber-capabilities'
    label: 'NIST: CAISI''s assessment of GLM-5.3''s cyber capabilities'
  - url: 'https://the-decoder.com/anthropic-says-zhipus-open-weight-glm-5-3-nearly-matches-claude-mythos-preview-at-building-exploits/'
    label: 'The Decoder: GLM-5.3 nearly matches Mythos Preview at building exploits'
  - url: 'https://huggingface.co/zai-org/GLM-5.3'
    label: 'Hugging Face: the GLM-5.3 model card'
lead:
  - 'Anthropic''s Frontier Red Team published an evaluation on Tuesday of GLM-5.3, the open-weight model that Zhipu AI, which goes by Z.ai outside China, released in August. Its conclusion: "The release of GLM-5.3 is a meaningful step change in the cyber capabilities available to attackers." On ExploitBench, where a model receives a known bug in V8, the JavaScript engine in Chrome, and has to turn it into an exploit that runs code of its choosing, GLM-5.3 succeeded in 50 of 410 attempts (12%). Claude Mythos Preview succeeded in 56 (14%). Claude Opus 4.6, GLM-5.2, Kimi K3 and DeepSeek V4.1-Flash stayed close to zero.'
  - 'The weights of the 753-billion-parameter model are on Hugging Face, and its guardrails gave way easily in Anthropic''s tests. Telling GLM-5.3 that it was an autonomous red-team agent working on an exercise got it to engage with harmful cyber requests 64% of the time. Prefilling its reasoning so that it seemed to have already decided to help worked 92% of the time, and an abliterated copy, with the refusal behavior edited out of the weights, worked every time. Claude''s safeguards blocked the deceptive prompts, and the other two techniques can''t be used through Claude''s API.'
---

## What it did outside the benchmark

Anthropic also gave the model real targets. A researcher put GLM-5.3 on a sandboxed machine with a local Linux build of a popular web browser. Over the course of a day, with limited human attention, the model found several previously unknown vulnerabilities in the browser's JavaScript engine and chained them into a web page that, when visited, reads arbitrary files from the visitor's computer. Later runs found bugs in wireless drivers, graphics drivers and network-facing device software. Anthropic says it disclosed the vulnerabilities to the maintainers.

The case that matters most for patch schedules used GLM-5.3-Flash, the smaller and weaker version. Given the public details of CVE-2026-11645 and another known flaw, it built a reliable exploit chain for an ARM64 target that bypasses pointer authentication (PAC), with eight hours of model work and 20 minutes of a person's attention. It cost $20.40.

On 100 random tasks from Anthropic's internal binary exploitation benchmark, GLM-5.3 achieved full control-flow hijacks in 4% of trials, against 6% for Mythos Preview. Claude Opus 4.6 and GLM-5.2 did not succeed in any. In the report's words, "a meaningful threshold has clearly been crossed."

## Guardrails that come off

Removing the refusals is within reach of a small team. Anthropic spent about 2,200 GPU hours, around $4,400, making its own abliterated copy, which cut refusal rates from above 90% to 3% on JailbreakBench, 2% on HarmBench and 12% on StrongREJECT. Others had done the same before: CAISI, the AI evaluation center at the US National Institute of Standards and Technology, noted in its own assessment on September 17 that several developers published abliterated versions of GLM-5.3 within days of its release.

## Behind the US frontier, and downloadable

CAISI's numbers put the model in context. It calls GLM-5.3 "the most cyber-capable open-weight model released to date" and estimates that it trails the US frontier by about four months across its cyber benchmarks:

| Benchmark | GLM-5.3 | Best US model | Best earlier Chinese model |
|---|---|---|---|
| SEC-Bench Pro | 40.4% | 90.2% | 27.3% |
| ExploitGym | 9.4% | 44.4% | 2.6% |
| OSS-Fuzz | 7.7% | 23.2% | 2.4% |

The US models were tested with their cyber safeguards turned off, and nobody outside the labs can get those versions, while anyone can download GLM-5.3 and remove its refusals.

Anthropic is not a neutral judge here. It competes with Z.ai, and its report argues for giving defenders wider access to frontier models like its own: it says vetted defenders can now use Claude Mythos 5.1 through its trusted access programs, and that Project Glasswing let trusted defenders find more than 10,000 vulnerabilities. Its policy asks are that defenders use the best tools available and that governments test sufficiently capable models.

For anyone who maintains software, the $20.40 case is the one to plan around: public details of a bug became a reliable exploit chain in eight hours of model work. Shorten the patch window for browsers and for anything that embeds a JavaScript engine and runs code you don't control, such as Electron apps that load remote content.
