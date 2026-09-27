---
title: Correção automática com agentes passa a usar o Copilot Memory
summary: As correções de segurança podem reutilizar o contexto do repositório e guardar padrões para alertas futuros.
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
    label: 'GitHub Docs: correção automática do code scanning'
lead:
  - 'Segundo o GitHub, a correção automática com agentes agora pode consultar entradas existentes do Copilot Memory ao resolver alertas de segurança, quando o recurso está habilitado pelo cliente. Depois de criar uma correção, o padrão pode ser salvo para trabalhos futuros.'
  - Esse contexto pode ajudar em alertas posteriores e informar outros recursos do Copilot sobre os padrões de desenvolvimento seguro daquele repositório. O GitHub classifica tanto a correção com agentes quanto o Copilot Memory como prévias públicas.
---

## Por que a memória do repositório importa

Um alerta de análise de código identifica um caminho arriscado, mas raramente traz toda a arquitetura. A [documentação de correção automática](https://docs.github.com/en/code-security/concepts/code-scanning/autofix-for-code-scanning) diz que uma sessão com agente pode investigar o repositório, propor uma correção, validá-la e abrir um pull request. A nova [integração com Memory](https://github.blog/changelog/2026-09-25-agentic-autofix-now-uses-copilot-memory/) acrescenta fatos aprendidos em trabalhos anteriores, como padrões de correção específicos do projeto.

A [visão geral do Memory](https://docs.github.com/en/copilot/concepts/agents/copilot-memory) diferencia fatos do repositório de preferências pessoais e diz que conhecimentos obtidos por um recurso do Copilot podem ser usados por outro. Isso é útil em bases grandes, nas quais a remediação correta depende das convenções locais. Também significa que uma memória ruim pode se espalhar além do alerta que a gerou; a revisão importa.

## A ressalva de segurança

Ainda é uma ferramenta para propor mudanças, não uma aprovação de segurança. O GitHub classifica a correção com agentes como prévia pública. A equipe deve inspecionar o patch, executar novamente suas verificações e testar o comportamento do caminho vulnerável. Se o agente guardar um padrão, confirme que ele foi de fato a correção certa antes de transformá-lo em precedente.
