---
title: Copilot code review gets finer personal and enterprise controls
summary: Developers can tune automatic reviews and review effort; enterprises can set a default across repositories.
date: '2026-09-23'
order: 3
category: ai
publisher: GitHub
sourceUrl: 'https://github.blog/changelog/2026-09-23-copilot-code-review-more-ways-to-request-and-configure-reviews/'
image: /news/copilot-code-review-controls/cover.webp
sources:
  - url: 'https://docs.github.com/en/copilot/how-tos/copilot-on-github/set-up-copilot/configure-code-review'
    label: 'GitHub Docs: configuring Copilot code review'
  - url: 'https://docs.github.com/en/copilot/how-tos/use-copilot-agents/request-a-code-review/use-code-review'
    label: 'GitHub Docs: requesting a Copilot review'
lead:
  - 'GitHub has expanded Copilot code review settings across its plans. Developers now get a dedicated page for automatic review preferences, including draft pull requests and new pushes, as well as a default effort level.'
  - 'Enterprise administrators can set a review effort default that flows to organization-owned repositories, while organizations and repositories can override it. The changes are generally available, according to GitHub.'
---

## The controls that actually changed

The [release](https://github.blog/changelog/2026-09-23-copilot-code-review-more-ways-to-request-and-configure-reviews/) separates several decisions that used to be easy to conflate. A developer can enable automatic reviews for their pull requests, decide whether draft pull requests and later pushes are included, and choose a default effort level. The enterprise can set a baseline, while organizations and repositories retain overrides.

GitHub's [configuration guide](https://docs.github.com/en/copilot/how-tos/copilot-on-github/set-up-copilot/configure-code-review) describes Lite and Balanced effort levels and how personal settings and repository rules interact. Its [review guide](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/request-a-code-review/use-code-review) covers manual requests. The operational detail is that an automatic review from one setting does not necessarily cancel a review requested by another rule; teams should understand which policy is triggering the work.

## A sensible rollout

Start where automated feedback is most useful: repositories with active review queues and clear ownership. Decide whether draft reviews help or merely produce noise before the code is ready. Measure useful findings and review time, not just the number of comments Copilot posted. Human reviewers still own architecture, behavior, and the final decision to merge.
