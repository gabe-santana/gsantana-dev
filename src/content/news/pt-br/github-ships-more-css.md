---
title: Por que o GitHub enviou mais CSS para acelerar o site
summary: O GitHub explica a saída do CSS-in-JS e os compromissos de desempenho na migração do Primer.
date: '2026-09-25'
order: 2
category: engineering
publisher: GitHub Engineering
sourceUrl: 'https://github.blog/engineering/architecture-optimization/improving-site-performance-by-shipping-more-css/'
image: /news/github-ships-more-css/cover.webp
sources:
  - url: 'https://github.com/primer/react'
    label: Código-fonte do Primer React
  - url: 'https://primer.style/product/getting-started/react/'
    label: Guia de uso do Primer React
lead:
  - 'A equipe do Primer no GitHub descreve a migração completa da antiga abordagem de CSS-in-JS. Com o crescimento do número de componentes, a inicialização de estilos no cliente e a coleta de estilos no servidor ficaram cada vez mais caras.'
  - O relato técnico mostra por que enviar mais CSS estático pode melhorar a experiência geral. É um bom lembrete de que a menor folha de estilos nem sempre produz a página mais rápida quando o custo da estilização em tempo de execução entra na conta.
---

## O que os números realmente mostram

No [relato de engenharia](https://github.blog/engineering/architecture-optimization/improving-site-performance-by-shipping-more-css/), o GitHub diz que os componentes do Primer tinham migrado para CSS Modules até dezembro de 2024. Depois, um grupo rotativo de oito engenheiros migrou 6.419 propriedades ao longo de seis meses. Os ganhos informados no tempo de renderização no servidor variaram de cerca de 1% a 22% nas páginas medidas. São medições do próprio GitHub em sua carga de trabalho, não um benchmark universal de CSS Modules.

A abordagem anterior trabalhava em tempo de execução: os estilos precisavam ser inicializados no navegador e coletados durante a renderização no servidor. Com mais componentes por página, esse custo cresceu. O CSS estático transfere parte do trabalho para o build e para o mecanismo nativo de estilos do navegador. Em compensação, o arquivo CSS pode ficar maior; a métrica relevante é a experiência completa da página, não só o tamanho da folha de estilos.

## A lição prática

Se sua aplicação React tem um gargalo parecido, meça o tempo de renderização no servidor e a inicialização no cliente antes de reescrever um design system. O [código do Primer React](https://github.com/primer/react) e o [guia de uso](https://primer.style/product/getting-started/react/) mostram a escala da migração. A decisão veio dos custos observados nessa escala. Enviar mais CSS parece contraditório até medir quanto JavaScript deixou de ser executado a cada requisição.
