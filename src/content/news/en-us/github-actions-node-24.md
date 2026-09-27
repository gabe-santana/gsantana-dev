---
title: GitHub Actions retires Node 20 for JavaScript actions
summary: 'Runners now use Node 24, and maintainers of JavaScript actions need to update their action metadata.'
date: '2026-09-23'
order: 2
category: engineering
publisher: GitHub
sourceUrl: 'https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/'
image: /news/github-actions-node-24/cover.webp
sources:
  - url: 'https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/'
    label: 'GitHub: Node 20 deprecation timeline'
  - url: 'https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax'
    label: 'GitHub Docs: action metadata syntax'
lead:
  - 'GitHub says Node 20 is no longer available on Actions runners. JavaScript actions now run on Node 24, and the temporary opt-out for the older runtime has been removed.'
  - Action maintainers should update `runs.using` to `node24` and release a new version. Workflow owners should move to current action releases that support Node 24. GitHub also flags compatibility limits for older macOS and ARM32 self-hosted runners.
---

## A migration with two owners

The [September 23 notice](https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/) closes the migration announced a year earlier. GitHub had already moved runners toward Node 24; now the `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION` escape hatch is gone. The earlier [deprecation timeline](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/) explains how the default changed and when the temporary opt-out would disappear.

If you maintain a JavaScript action, the runtime is declared in its metadata, so update `runs.using` to `node24`, test it, and publish a release. GitHub's [metadata reference](https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax) shows the syntax. If you only consume actions, inspect the versions pinned in your workflows and move to releases that support Node 24. Those are different jobs; upgrading the Node version inside your application does not update the runtime of an action you call.

## The infrastructure edge case

GitHub warns that Node 24 does not support macOS 13.4 and earlier in this runner context and has no official ARM32 support. Teams with self-hosted runners should check the runner OS and architecture before blaming a broken workflow on a JavaScript package. The less glamorous migration work is often in the machine that runs the action.
