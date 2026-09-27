---
title: GitHub Actions aposenta o Node 20 para actions em JavaScript
summary: 'Os runners agora usam Node 24, e mantenedores de actions em JavaScript precisam atualizar seus metadados.'
date: '2026-09-23'
order: 2
category: engineering
publisher: GitHub
sourceUrl: 'https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/'
image: /news/github-actions-node-24/cover.webp
sources:
  - url: 'https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/'
    label: 'GitHub: cronograma de descontinuação do Node 20'
  - url: 'https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax'
    label: 'GitHub Docs: sintaxe dos metadados de actions'
lead:
  - 'Segundo o GitHub, o Node 20 não está mais disponível nos runners do Actions. As actions em JavaScript agora usam Node 24, e a opção temporária de continuar no runtime antigo foi removida.'
  - Mantenedores de actions devem atualizar `runs.using` para `node24` e publicar uma nova versão. Responsáveis por workflows devem usar versões atuais das actions compatíveis com Node 24. O GitHub também aponta limitações para runners próprios com macOS antigo e ARM32.
---

## Uma migração com dois responsáveis

O [aviso de 23 de setembro](https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/) encerra a migração anunciada um ano antes. O GitHub já vinha direcionando os runners para o Node 24; agora a saída temporária `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION` acabou. O [cronograma de descontinuação](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/) explica quando o padrão mudou e quando a exceção deixaria de funcionar.

Se você mantém uma action em JavaScript, o runtime é declarado nos metadados: atualize `runs.using` para `node24`, teste e publique uma versão. A [referência de metadados](https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax) mostra a sintaxe. Se você apenas usa actions, confira as versões fixadas nos workflows e migre para versões compatíveis com Node 24. São tarefas distintas; atualizar o Node da sua aplicação não atualiza o runtime de uma action chamada por ela.

## O caso especial da infraestrutura

O GitHub alerta que o Node 24 não suporta macOS 13.4 ou anterior nesse contexto e não tem suporte oficial a ARM32. Equipes com runners próprios devem conferir sistema e arquitetura antes de culpar um pacote JavaScript por um workflow quebrado. O trabalho menos vistoso da migração muitas vezes está na máquina que executa a action.
