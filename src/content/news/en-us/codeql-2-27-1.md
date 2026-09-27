---
title: CodeQL 2.27.1 expands language and security coverage
summary: New C/C++ and C# queries arrive alongside Kotlin 2.4.20 support and more accurate data-flow models.
date: '2026-09-25'
order: 4
category: security
publisher: GitHub
sourceUrl: 'https://github.blog/changelog/2026-09-25-codeql-2-27-1-adds-c-and-c-query-and-kotlin-2-4-20-support/'
image: /news/codeql-2-27-1/cover.webp
sources:
  - url: 'https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-code-scanning'
    label: 'GitHub Docs: CodeQL code scanning'
  - url: 'https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-query-suites'
    label: 'GitHub Docs: CodeQL query suites'
lead:
  - 'GitHub''s CodeQL 2.27.1 release adds queries for C/C++ and C#, support for Kotlin 2.4.20, and improvements to its analysis models. It also updates data-flow handling for newer Go standard-library APIs.'
  - 'For teams that rely on code scanning, the release is worth checking for both new findings and reduced false positives. GitHub deploys new CodeQL versions automatically to code scanning users on github.com.'
---

## What changed in the analyzer

The [release notes](https://github.blog/changelog/2026-09-25-codeql-2-27-1-adds-c-and-c-query-and-kotlin-2-4-20-support/) describe a new C/C++ query for assignments of comparison results that can be read ambiguously, plus a C# query for loops that could use `FirstOrDefault`. The update also adds library-flow models, updates the Rust extractor's rust-analyzer, and improves handling of some GitHub Actions references. Not every change is a new alert: better models and fewer false positives matter too.

The [CodeQL overview](https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-code-scanning) explains that findings appear as code scanning alerts, while [query suites](https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-query-suites) determine which checks run. A new query only affects your repository when it belongs to the suite you use. That detail is easy to miss when a release headline lists a long menu of languages.

## What to do with it

Check the next scan for changed findings and confirm the configured suite before treating a quiet scan as proof that every new query ran. If you pin a CodeQL CLI or bundle version outside GitHub's hosted scanning, plan an update instead of assuming you received the hosted rollout.
