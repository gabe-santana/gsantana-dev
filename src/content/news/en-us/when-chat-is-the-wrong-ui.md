---
title: When a chat box is the wrong interface for AI
summary: 'GitHub makes the case for canvases: interfaces that give agent work more structure than a conversation can.'
date: '2026-09-24'
order: 2
category: ai
publisher: GitHub
sourceUrl: 'https://github.blog/ai-and-ml/github-copilot/when-chat-is-the-wrong-ui/'
image: /news/when-chat-is-the-wrong-ui/cover.webp
sources:
  - url: 'https://docs.github.com/en/enterprise-cloud%40latest/copilot/how-tos/github-copilot-app/working-with-canvas-extensions'
    label: 'GitHub Docs: working with canvases'
  - url: 'https://github.blog/ai-and-ml/github-copilot/github-copilot-app-for-beginners-how-to-build-custom-workflows-with-canvases/'
    label: 'GitHub: building a custom canvas'
lead:
  - 'Chat remains the default interface for many AI tools, but GitHub argues that some tasks need a surface users can inspect and manipulate directly. Its essay points to canvases in the Copilot app as one way to move beyond a transcript.'
  - 'For builders, the design question is whether the task is primarily a conversation or an evolving artifact. Planning, triage, and review often benefit from visible state and controls that stay in place while the agent works.'
---

## The problem with a disappearing work surface

In GitHub's [essay](https://github.blog/ai-and-ml/github-copilot/when-chat-is-the-wrong-ui/), the complaint is familiar: chat is good at discussing a task, but the output of a task often belongs in a board, document, dashboard, or browser. An agent's latest answer can tell you what it did; it does not automatically give you a durable place to verify and change the result.

GitHub's [canvas documentation](https://docs.github.com/en/enterprise-cloud%40latest/copilot/how-tos/github-copilot-app/working-with-canvas-extensions) calls these surfaces bidirectional. The user can manipulate them while the agent updates them. Its [walkthrough](https://github.blog/ai-and-ml/github-copilot/github-copilot-app-for-beginners-how-to-build-custom-workflows-with-canvases/) gives a concrete release-notes example, where a structured view is easier to scan than a scrollback of messages.

## My design test

Ask three questions before giving every agent a canvas: Does the task have state that must remain visible? Can the user correct that state directly? Will the surface still be useful after the conversation ends? If the answer is no, chat may be enough. If it is yes, forcing the work into a transcript is like tracking an incident in a group chat: possible, but nobody enjoys finding the current truth.
