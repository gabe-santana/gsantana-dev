---
title: Agentic autofix now learns from Copilot Memory
summary: Security fixes can reuse repository context and save successful fix patterns for later alerts.
date: '2026-09-25'
order: 3
category: security
publisher: GitHub
sourceUrl: 'https://github.blog/changelog/2026-09-25-agentic-autofix-now-uses-copilot-memory/'
image: /news/agentic-autofix-copilot-memory/cover.webp
sources:
  - url: 'https://docs.github.com/en/copilot/concepts/agents/copilot-memory'
    label: 'GitHub Docs: Copilot Memory'
  - url: 'https://docs.github.com/en/code-security/concepts/code-scanning/autofix-for-code-scanning'
    label: 'GitHub Docs: autofix for code scanning'
lead:
  - 'GitHub says agentic autofix can now read existing Copilot Memory entries when resolving security alerts, if the customer has enabled the feature. Once a fix is created, its pattern can be stored as a memory for future work.'
  - That context can help autofix with subsequent alerts and inform other Copilot features about a repository's secure development patterns. GitHub lists both agentic autofix and Copilot Memory as public previews.
---

## Why repository memory matters

A code scanning alert identifies a risky path; it rarely contains the whole architecture. The [autofix documentation](https://docs.github.com/en/code-security/concepts/code-scanning/autofix-for-code-scanning) says an agentic session can inspect more of the repository, propose a fix, validate it and open a pull request. The new [Memory integration](https://github.blog/changelog/2026-09-25-agentic-autofix-now-uses-copilot-memory/) adds facts learned during earlier work, such as project-specific fix patterns.

GitHub's [Memory overview](https://docs.github.com/en/copilot/concepts/agents/copilot-memory) distinguishes repository-level facts from user preferences and says facts learned by one Copilot feature can be used by another. That is useful in a large codebase where the correct remediation depends on local conventions. It also means a bad memory could travel beyond the single alert that produced it, so review matters.

## The security caveat

This is still a proposal generator, not a security sign-off. GitHub lists agentic autofix as a public preview. A team should inspect the patch, rerun its security checks, and test behavior around the vulnerable path. If the agent remembers a pattern, verify that the pattern was actually the right fix before it becomes precedent.
