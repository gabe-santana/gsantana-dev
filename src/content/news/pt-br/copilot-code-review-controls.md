---
title: Revisão de código do Copilot ganha controles pessoais e corporativos
summary: É possível ajustar revisões automáticas e esforço de análise; empresas podem definir um padrão para seus repositórios.
date: '2026-09-23'
order: 3
category: ai
publisher: GitHub
sourceUrl: 'https://github.blog/changelog/2026-09-23-copilot-code-review-more-ways-to-request-and-configure-reviews/'
image: /news/copilot-code-review-controls/cover.webp
sources:
  - url: 'https://docs.github.com/en/copilot/how-tos/copilot-on-github/set-up-copilot/configure-code-review'
    label: 'GitHub Docs: configuração da revisão do Copilot'
  - url: 'https://docs.github.com/en/copilot/how-tos/use-copilot-agents/request-a-code-review/use-code-review'
    label: 'GitHub Docs: como solicitar uma revisão do Copilot'
lead:
  - 'O GitHub ampliou as configurações de revisão de código do Copilot entre seus planos. Pessoas desenvolvedoras agora têm uma página dedicada às preferências de revisão automática, incluindo pull requests em rascunho e novos pushes, além de um nível de esforço padrão.'
  - 'Administradores corporativos podem definir um esforço de revisão herdado pelos repositórios das organizações, que ainda podem substituí-lo. Segundo o GitHub, as mudanças já estão disponíveis de forma geral.'
---

## Os controles que realmente mudaram

O [lançamento](https://github.blog/changelog/2026-09-23-copilot-code-review-more-ways-to-request-and-configure-reviews/) separa decisões que antes eram fáceis de confundir. A pessoa desenvolvedora pode ativar revisões automáticas nos próprios pull requests, decidir se rascunhos e novos pushes entram nessa regra e escolher um nível de esforço padrão. A empresa define uma base, enquanto organizações e repositórios podem substituí-la.

O [guia de configuração](https://docs.github.com/en/copilot/how-tos/copilot-on-github/set-up-copilot/configure-code-review) descreve os níveis Lite e Balanced e como preferências pessoais e regras do repositório interagem. O [guia de revisão](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/request-a-code-review/use-code-review) cobre solicitações manuais. O detalhe operacional é que uma revisão automática disparada por uma configuração não necessariamente cancela outra solicitada por uma regra; a equipe deve entender qual política iniciou o trabalho.

## Uma adoção sensata

Comece onde o feedback automático é mais útil: repositórios com filas ativas de revisão e responsáveis bem definidos. Decida se revisar rascunhos ajuda ou só produz ruído antes de o código estar pronto. Meça achados úteis e tempo de revisão, não só o número de comentários do Copilot. Revisores humanos ainda respondem pela arquitetura, pelo comportamento e pela decisão final de merge.
