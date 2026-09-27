---
title: GitHub Copilot ganha novos modelos e mais controle sobre agentes
summary: 'A atualização traz mais opções de modelos, sandbox local e novidades no VS Code, JetBrains, Slack e Teams.'
date: '2026-09-25'
order: 1
category: ai
publisher: GitHub
sourceUrl: 'https://github.blog/changelog/2026-09-25-github-copilot-weekly-releases-september-21/'
image: /news/copilot-weekly-releases/cover.webp
sources:
  - url: 'https://github.blog/changelog/2026-09-23-local-sandboxing-in-the-github-copilot-app/'
    label: 'GitHub: lançamento do sandbox local'
  - url: 'https://docs.github.com/en/enterprise-cloud%40latest/copilot/how-tos/github-copilot-app/configure-local-sandboxing'
    label: 'GitHub Docs: configuração do sandbox local'
lead:
  - 'O resumo publicado pelo GitHub em 25 de setembro reúne várias mudanças no Copilot. Claude Opus 5.5, GPT-6 Sol e Luna e Grok 4.7 entraram na seleção de modelos, com disponibilidade que varia conforme o plano.'
  - 'Para quem trabalha com agentes, as novidades mais relevantes podem ser o sandbox local no aplicativo do Copilot e o suporte a OpenTelemetry para acompanhar a atividade dos agentes. A versão também inclui Dev Containers remotos no VS Code e novos controles no JetBrains e nas ferramentas de colaboração.'
---

## O que mudou além do menu de modelos

O [resumo semanal](https://github.blog/changelog/2026-09-25-github-copilot-weekly-releases-september-21/) reúne vários lançamentos, e a lista de modelos não deveria esconder a parte de engenharia. No JetBrains, editar uma mensagem anterior pode retroceder a sessão do agente e as alterações nos arquivos antes de enviar a nova instrução. O VS Code 1.139 está adicionando gradualmente suporte a agentes em Dev Containers acessados por SSH, Tunnel e WSL. Isso muda onde o agente executa e quanto do trabalho pode ser redirecionado.

O [anúncio do sandbox](https://github.blog/changelog/2026-09-23-local-sandboxing-in-the-github-copilot-app/) diz que o aplicativo pode limitar o acesso a arquivos, rede e credenciais nas sessões locais. É uma prévia pública, desativada por padrão. A [documentação de configuração](https://docs.github.com/en/enterprise-cloud%40latest/copilot/how-tos/github-copilot-app/configure-local-sandboxing) esclarece uma diferença importante: uma working tree separa branches e arquivos entre sessões; o sandbox limita o que os comandos podem alcançar fora dali.

## O que eu verificaria antes de adotar

Começaria com um repositório e uma tarefa realista. Conferiria quais modelos e planos liberam o recurso, se o projeto precisa de rede externa ou credenciais Git e se uma política corporativa restringe o sandbox efetivo. Depois, inspecionaria o diff e a telemetria. Mais modelos ajudam; saber o que um agente tocou ajuda ainda mais na segunda-feira seguinte.
