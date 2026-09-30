---
title: Reddit turns off RSS feeds on November 13 and its public API in March, blaming AI scraping
summary: RSS has become a "common surface for large-scale scraping and automated abuse," Reddit says. Moderators get a Discord relay app, other RSS users get nothing, and developers must register their apps by January 12 or lose API access.
date: '2026-09-30'
order: 1
category: engineering
publisher: Reddit
sourceUrl: 'https://www.reddit.com/r/modnews/comments/1wubgvt/continuing_our_infrastructure_updates_whats/'
image: /news/reddit-ends-rss-public-api/cover.webp?v=1
sources:
  - url: 'https://www.reddit.com/r/modnews/comments/1wubgvt/continuing_our_infrastructure_updates_whats/'
    label: 'r/modnews: the announcement to moderators'
  - url: 'https://www.reddit.com/r/redditdev/comments/1wubcvf/moving_data_api_apps_to_the_developer_platform/'
    label: 'r/redditdev: moving Data API apps to the Developer Platform'
  - url: 'https://techcrunch.com/2026/09/30/reddit-is-killing-rss-feeds-ending-public-api-access-because-of-ai-bots/'
    label: 'TechCrunch: Reddit is killing RSS feeds and ending public API access'
  - url: 'https://thenextweb.com/news/reddit-rss-feeds-shut-down-old-reddit-ai-scraping'
    label: 'The Next Web: RSS ends on November 13, and old Reddit narrows'
lead:
  - 'Reddit announced on Wednesday that it will turn off RSS feeds on November 13 and end its public API in March 2027. The reason it gives is AI scraping: RSS has become a "common surface for large-scale scraping and automated abuse." "We know RSS has been a beloved part of the open web for a long time, and we''re grateful to everyone who used it," the company told moderators.'
  - 'The API change reaches every tool that reads Reddit conversations programmatically, from social listening products and research projects to AI assistants. Developers of approved third-party apps and bots have until January 12 to register them; after that, Reddit will cut API access for anyone who hasn''t. Old Reddit, which already requires a login, will stay open only to moderators and to people who used it in the last 90 days.'
---

## What replaces what

For moderators who follow their communities through RSS, Reddit points to Discord Relay, an app on its Developer Platform (Devvit) that forwards activity to Discord, and asks mod teams to switch before November 13. People who read feeds from communities they don't moderate get nothing: for that use, Reddit says, "there is no replacement."

The post to developers is about moving Data API apps to the Developer Platform, where apps run inside Reddit. According to The Next Web, Reddit will pay $1,000 to each eligible app that completes the move, from a $1 million fund, and more than 14,000 apps and bots have registered so far. For commercial AI use, the remaining route is a paid licensing deal with Reddit.

## Why Reddit is closing the open doors

Reddit sells its data to AI companies. Its "other revenue" line, where that licensing lands, was $43 million in the second quarter, up 24% from a year earlier, according to TechCrunch. Every open feed is a way to get the same threads without paying, and this is the next step after the 2023 API pricing change that ended apps like Apollo and the login wall that already covers old Reddit.

## What to check in your stack

If anything you run reads Reddit through RSS, it stops working on November 13: feed readers, automations in Zapier, IFTTT or n8n, Slack and Discord bots that post new threads. Scripts that use the API, such as PRAW collectors and research scrapers, need a registered app before January 12 and a plan for March. And if an AI product of yours uses Reddit threads as a source, through search or retrieval, that source goes away unless you license it.
