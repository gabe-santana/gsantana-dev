---
title: CodeQL 2.27.1 amplia a cobertura de linguagens e segurança
summary: Novas consultas para C/C++ e C# chegam com suporte a Kotlin 2.4.20 e modelos de fluxo de dados mais precisos.
date: '2026-09-25'
order: 4
category: security
publisher: GitHub
sourceUrl: 'https://github.blog/changelog/2026-09-25-codeql-2-27-1-adds-c-and-c-query-and-kotlin-2-4-20-support/'
image: /news/codeql-2-27-1/cover.webp
sources:
  - url: 'https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-code-scanning'
    label: 'GitHub Docs: análise de código com CodeQL'
  - url: 'https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-query-suites'
    label: 'GitHub Docs: conjuntos de consultas CodeQL'
lead:
  - 'O CodeQL 2.27.1 do GitHub adiciona consultas para C/C++, C#, suporte a Kotlin 2.4.20 e melhorias nos modelos de análise. Também atualiza o tratamento do fluxo de dados para APIs mais recentes da biblioteca padrão do Go.'
  - 'Para equipes que usam análise de código, vale verificar tanto os novos achados quanto a redução de falsos positivos. O GitHub distribui automaticamente as novas versões do CodeQL para usuários do code scanning no github.com.'
---

## O que mudou no analisador

As [notas da versão](https://github.blog/changelog/2026-09-25-codeql-2-27-1-adds-c-and-c-query-and-kotlin-2-4-20-support/) descrevem uma nova consulta para C/C++ que detecta atribuições ambíguas de resultados de comparações e outra para C# sobre loops que poderiam usar `FirstOrDefault`. A atualização também adiciona modelos de fluxo em bibliotecas, atualiza o rust-analyzer do extrator Rust e melhora o tratamento de algumas referências no GitHub Actions. Nem toda mudança gera um novo alerta: modelos melhores e menos falsos positivos também importam.

A [visão geral do CodeQL](https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-code-scanning) explica que os resultados aparecem como alertas de análise de código, enquanto os [conjuntos de consultas](https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-query-suites) determinam quais verificações rodam. Uma consulta nova só afeta seu repositório quando faz parte do conjunto escolhido. É um detalhe fácil de perder diante de uma lista grande de linguagens no anúncio.

## O que fazer agora

Confira as mudanças nos resultados da próxima análise e confirme o conjunto configurado antes de interpretar uma execução sem alertas como prova de que todas as novas consultas rodaram. Se você fixa a versão do CLI ou do bundle CodeQL fora do serviço hospedado pelo GitHub, planeje a atualização em vez de presumir que recebeu a nova versão.
