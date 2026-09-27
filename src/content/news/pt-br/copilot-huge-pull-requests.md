---
title: Por dentro do renderizador de pull requests com um milhão de linhas
summary: 'A equipe do aplicativo Copilot refez a visualização de diffs para manter revisões enormes responsivas, mesmo com centenas de comentários.'
date: '2026-09-23'
order: 1
category: engineering
publisher: GitHub Engineering
sourceUrl: 'https://github.blog/engineering/user-experience/rendering-huge-pull-requests-in-the-github-copilot-app/'
image: /news/copilot-huge-pull-requests/cover.webp
sources:
  - url: 'https://docs.github.com/en/copilot/how-tos/github-copilot-app/managing-issues-and-pull-requests'
    label: 'GitHub Docs: revisão de pull requests no aplicativo'
  - url: 'https://react.dev/reference/react/Profiler'
    label: 'React: medição de desempenho de renderização'
lead:
  - 'O GitHub Engineering descreve a reconstrução da visualização de pull requests do aplicativo Copilot para mudanças excepcionalmente grandes. O caso de teste tinha 2.200 arquivos, mais de um milhão de linhas alteradas e mais de 400 comentários em linha.'
  - 'O artigo acompanha o trabalho de desempenho por trás de um diff responsivo: instrumentação de renderizações, testes de rolagem e redimensionamento e validação no aplicativo de desktop. É um exemplo concreto de engenharia de interface sob um volume extremo de dados.'
---

## Um caso extremo de verdade

O [relato de engenharia](https://github.blog/engineering/user-experience/rendering-huge-pull-requests-in-the-github-copilot-app/) usa um pull request real de código aberto com 2.200 arquivos, mais de um milhão de linhas alteradas e mais de 400 comentários. Está muito além do que a maioria das equipes encontra, e por isso testa bem as suposições sobre rolagem, expansão e renderização de comentários. O produto precisa permitir a revisão na [visualização de arquivos alterados](https://docs.github.com/en/copilot/how-tos/github-copilot-app/managing-issues-and-pull-requests), não só carregar uma página de resumo.

O GitHub descreve duas frentes de validação: um teste automatizado que acompanha contagens de renderização, tempos e fluidez dos quadros; e uma execução no aplicativo real, com comentários ainda carregando e depois já carregados. Essa diferença importa. Um benchmark sintético encontra regressões rapidamente, enquanto o fluxo real revela interações incômodas que um número não descreve.

## Um padrão útil para qualquer interface grande

Meça as transições de estado caras, não apenas a primeira pintura. Abra detalhes, redimensione a janela, avance na lista de arquivos e volte aos comentários. A [documentação do Profiler do React](https://react.dev/reference/react/Profiler) mostra como medir o trabalho de renderização dos componentes; ele é um instrumento, não a história inteira. A lição é colocar a pior jornada realista na validação antes de alguém aparecer com o PR de um milhão de linhas.
