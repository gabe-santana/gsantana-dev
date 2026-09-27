---
title: Quando uma caixa de chat não é a melhor interface para IA
summary: 'O GitHub defende os canvases: interfaces que dão ao trabalho dos agentes mais estrutura do que uma conversa.'
date: '2026-09-24'
order: 2
category: ai
publisher: GitHub
sourceUrl: 'https://github.blog/ai-and-ml/github-copilot/when-chat-is-the-wrong-ui/'
image: /news/when-chat-is-the-wrong-ui/cover.webp
sources:
  - url: 'https://docs.github.com/en/enterprise-cloud%40latest/copilot/how-tos/github-copilot-app/working-with-canvas-extensions'
    label: 'GitHub Docs: trabalho com canvases'
  - url: 'https://github.blog/ai-and-ml/github-copilot/github-copilot-app-for-beginners-how-to-build-custom-workflows-with-canvases/'
    label: 'GitHub: criando um canvas personalizado'
lead:
  - 'O chat continua sendo a interface padrão de muitas ferramentas de IA, mas o GitHub argumenta que algumas tarefas precisam de uma superfície que o usuário possa inspecionar e manipular diretamente. O ensaio apresenta os canvases do aplicativo Copilot como uma forma de ir além do histórico de mensagens.'
  - 'Para quem constrói produtos, a pergunta de design é se a tarefa é principalmente uma conversa ou um artefato em evolução. Planejamento, triagem e revisão costumam se beneficiar de estados e controles visíveis enquanto o agente trabalha.'
---

## O problema da superfície de trabalho que desaparece

No [ensaio do GitHub](https://github.blog/ai-and-ml/github-copilot/when-chat-is-the-wrong-ui/), a queixa é conhecida: chat serve para discutir uma tarefa, mas o resultado dela muitas vezes pertence a um quadro, documento, painel ou navegador. A última resposta do agente pode dizer o que foi feito; ela não cria automaticamente um lugar durável para conferir e alterar o resultado.

A [documentação dos canvases](https://docs.github.com/en/enterprise-cloud%40latest/copilot/how-tos/github-copilot-app/working-with-canvas-extensions) chama essas superfícies de bidirecionais. O usuário pode manipulá-las enquanto o agente as atualiza. O [tutorial](https://github.blog/ai-and-ml/github-copilot/github-copilot-app-for-beginners-how-to-build-custom-workflows-with-canvases/) traz um exemplo de notas de versão no qual uma visão estruturada é mais fácil de ler do que o histórico de mensagens.

## Meu teste de design

Antes de dar um canvas a todo agente, faça três perguntas: a tarefa tem estado que precisa continuar visível? O usuário consegue corrigir esse estado diretamente? A superfície continua útil depois que a conversa termina? Se não, chat pode bastar. Se sim, forçar tudo para o histórico de mensagens é como gerenciar um incidente em um grupo de chat: dá para fazer, mas ninguém gosta de procurar a verdade atual ali.
