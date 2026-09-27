---
title: GitHub Copilot adds new models and tighter agent controls
summary: 'The latest release brings more model choice, local sandboxing, and updates across VS Code, JetBrains, Slack, and Teams.'
date: '2026-09-25'
order: 1
category: ai
publisher: GitHub
sourceUrl: 'https://github.blog/changelog/2026-09-25-github-copilot-weekly-releases-september-21/'
image: /news/copilot-weekly-releases/cover.webp
sources:
  - url: 'https://github.blog/changelog/2026-09-23-local-sandboxing-in-the-github-copilot-app/'
    label: 'GitHub: local sandboxing release'
  - url: 'https://docs.github.com/en/enterprise-cloud%40latest/copilot/how-tos/github-copilot-app/configure-local-sandboxing'
    label: 'GitHub Docs: configuring local sandboxing'
lead:
  - 'GitHub''s September 25 roundup puts several changes to Copilot in one place. Claude Opus 5.5, GPT-6 Sol and Luna, and Grok 4.7 have joined its model lineup, with availability varying by plan.'
  - 'For developers working with agents, the more consequential additions may be local sandboxing in the Copilot app and OpenTelemetry support for monitoring agent activity. The release also covers remote Dev Container support in VS Code and new controls in JetBrains and collaboration tools.'
---

## The changes behind the model menu

The [weekly release](https://github.blog/changelog/2026-09-25-github-copilot-weekly-releases-september-21/) is a bundle, so the model list should not swallow the engineering story. In JetBrains, an edited earlier message can rewind an agent session and its file changes before the replacement instruction is sent. VS Code 1.139 is gradually adding agent support in Dev Containers on SSH, Tunnel, and WSL hosts. These are workflow changes: where the agent runs and how much of its work you can steer.

GitHub's [sandbox announcement](https://github.blog/changelog/2026-09-23-local-sandboxing-in-the-github-copilot-app/) says the app can limit file, network, and credential access for local sessions. It is a public preview and is off by default. The [configuration guide](https://docs.github.com/en/enterprise-cloud%40latest/copilot/how-tos/github-copilot-app/configure-local-sandboxing) makes an important distinction: a working tree isolates branches and files between sessions; a sandbox restricts what commands can reach elsewhere on the machine.

## What I would check before rolling it out

Start with one repository and a realistic task. Check which model and plan actually expose the feature, whether your project needs outbound network or Git credentials, and whether an enterprise policy narrows the effective sandbox. Then inspect the resulting diff and the telemetry. More models are useful; knowing what an agent touched is useful on Monday morning after it has touched it.
