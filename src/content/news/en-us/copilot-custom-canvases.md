---
title: Copilot canvases turn agent work into custom interfaces
summary: 'GitHub shows how developers can build shared, interactive surfaces for planning and tracking work with agents.'
date: '2026-09-25'
order: 5
category: ai
publisher: GitHub
sourceUrl: 'https://github.blog/ai-and-ml/github-copilot/github-copilot-app-for-beginners-how-to-build-custom-workflows-with-canvases/'
image: /news/copilot-custom-canvases/cover.webp
sources:
  - url: 'https://docs.github.com/en/enterprise-cloud%40latest/copilot/how-tos/github-copilot-app/working-with-canvas-extensions'
    label: 'GitHub Docs: canvas extensions'
  - url: 'https://github.blog/ai-and-ml/github-copilot/when-chat-is-the-wrong-ui/'
    label: 'GitHub: when chat is the wrong UI'
lead:
  - 'GitHub''s guide introduces canvases in the Copilot app as shared interfaces that both a developer and an agent can update. A canvas can take the shape of a board, checklist, dashboard, form, or spreadsheet.'
  - 'The point is practical: a workflow that needs status, controls, and structured information may work better in a purpose-built surface than in a long chat transcript. The article walks through creating one for a development task.'
---

## From conversation to working surface

The [tutorial](https://github.blog/ai-and-ml/github-copilot/github-copilot-app-for-beginners-how-to-build-custom-workflows-with-canvases/) shows a concrete example: ask Copilot to create a release-notes canvas that tracks work completed across sessions. A canvas is not just a prettier answer. The [documentation](https://docs.github.com/en/enterprise-cloud%40latest/copilot/how-tos/github-copilot-app/working-with-canvas-extensions) says the agent and user can both change the same interactive artifact, and that canvases can be packaged in plugins alongside other capabilities.

That changes the human review loop. Instead of searching a chat history for the current list of tasks, a developer can inspect the board or checklist as it evolves. GitHub's companion [essay about chat interfaces](https://github.blog/ai-and-ml/github-copilot/when-chat-is-the-wrong-ui/) argues for exactly this distinction between discussion and doing.

## The question for a team

Pick a workflow with real state: release preparation, incident triage, or code review. If a canvas makes status and next actions easier to verify, it earns its place. If it merely duplicates a chat transcript in boxes, it adds maintenance without clarity. The interesting part is not that an agent can generate UI; it is whether that UI helps a human remain in control of the work.
