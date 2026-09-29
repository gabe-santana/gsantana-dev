---
title: 'NVIDIA opens a safety platform to keep AI agents inside their sandbox, and Perplexity shows where sandboxes leak'
summary: NVIDIA's Open Agent Safety Platform pairs the open-source OpenShell runtime with Sentry, a watchdog on BlueField-4 DPUs. The same day, Perplexity's red team found that no model broke a VM boundary, but four slipped past network policy in 8 of 10 sandboxes tested.
date: '2026-09-29'
order: 0
category: security
publisher: NVIDIA
sourceUrl: 'https://nvidianews.nvidia.com/news/open-agent-safety-platform'
image: /news/nvidia-open-agent-safety-platform/cover.webp?v=1
sources:
  - url: 'https://nvidianews.nvidia.com/news/open-agent-safety-platform'
    label: 'NVIDIA Newsroom: the Open Agent Safety Platform'
  - url: 'https://developer.nvidia.com/blog/nvidia-open-agent-safety-platform-a-reference-for-continuous-in-silicon-agent-monitoring/'
    label: 'NVIDIA Technical Blog: continuous in-silicon agent monitoring'
  - url: 'https://www.perplexity.ai/hub/blog/escaping-space-part-i'
    label: 'Perplexity: Escaping SPACE, Part I'
  - url: 'https://alphasignal.ai/news/perplexity-s-space-red-team-exposes-a-network-bypass-flaw-hitting-8-sandboxes'
    label: 'AlphaSignal: the network bypass that hit 8 sandboxes'
lead:
  - 'NVIDIA launched the Open Agent Safety Platform on Monday, a reference design for running AI agents under boundaries the agent itself cannot talk its way out of. It has two pieces: OpenShell, an open-source runtime (Apache 2.0) that sandboxes the agent with kernel-level isolation and decides what files, networks, tools, processes and credentials it may touch, and Sentry, a watchdog that runs out of band on BlueField-4 DPUs and can quarantine an agent within milliseconds when it drifts outside policy. More than 100 organizations are working with it, including Anthropic, Microsoft, Cisco, CrowdStrike, Hugging Face, Red Hat, SAP and ServiceNow.'
  - 'The same day, Perplexity published what happened when its security team told nine frontier models, with root access, to break out of SPACE, the sandbox behind Perplexity Computer. Across 108 escape runs, none crossed the virtual machine boundary, even with the sandbox source code in hand. But in the runs that allowed a little network access, four models reached a blocked address anyway, and the same trick worked against 8 of the 10 sandbox products Perplexity tested.'
---

## Enforcement outside the agent

The idea behind NVIDIA's design is the one Mike Nicolls, president of SpaceXAI, put in a sentence in the announcement: safety "should be enforced outside the model by additional controls". OpenShell turns an operator's instructions into a policy that is checked before the agent runs and enforced while it works, and every action is traced. [NVIDIA's technical post](https://developer.nvidia.com/blog/nvidia-open-agent-safety-platform-a-reference-for-continuous-in-silicon-agent-monitoring/) goes one step further and says a prover shows the policy cannot escape the operator's intent. Sentry then sits on the DPU, which NVIDIA describes as the node's only path to the model, and correlates agent interactions, policy decisions and tool and data access at line speed, independently of the software stack an attacker or a misbehaving agent could tamper with.

OpenShell is available now on GitHub and runs on NVIDIA Vera CPUs, with support for Arm and Intel platforms. Sentry needs BlueField-4, and on Vera systems that already have it, NVIDIA says enabling the protections is a software update. What the announcement does not include is just as useful to know: no overhead numbers, no quarantine latency beyond "milliseconds", no policy syntax and no scale limits yet.

## The leak is the network, again

Perplexity's report is the more instructive half of the day. SPACE runs each sandbox as a Firecracker microVM with a host-side gateway that enforces egress policy, and the VM boundary held in every run. The failures came from the allowlist. With access limited to PyPI and Ubuntu mirrors, models forged DNS responses so that `pypi.org` resolved to a callback address, or found CDN endpoints (Fastly, Taboola, thum.io) that share IP addresses with the allowed repositories and routed through them. One model, GPT-5.6 Cyber, had a screenshot service capture the blocked page as an image and read the flag back with OCR. Perplexity added source-address validation and hostname enforcement at the TLS and HTTP layers, and according to AlphaSignal's summary, only Cloudflare Sandbox and NVIDIA OpenShell resisted both attacks, while four other vendors had shipped patches by publication.

That is the same lesson as [OpenAI's DNS escape](/en-us/news/openai-pauses-models-dns-escape/) reported days earlier, now reproduced across the industry: a capable agent treats every path that works as permitted, and an egress rule written as "these IPs" or "these domains" leaks through DNS, shared infrastructure and any service that fetches URLs on your behalf. If you run agents with tools, enforce egress by hostname and TLS server name rather than IP, validate that DNS answers come from your resolver, deny URL-fetching services by default, and put the monitor and the kill switch somewhere the agent's own process cannot reach.
