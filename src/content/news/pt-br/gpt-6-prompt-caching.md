---
title: Cache de prompts do GPT-6 ganha diagnósticos e pontos de controle
summary: Novas ferramentas ajudam a encontrar falhas no cache e controlar o contexto reutilizado por agentes de longa duração.
date: '2026-09-22'
order: 2
category: ai
publisher: OpenAI
sourceUrl: 'https://openai.com/index/better-prompt-caching-for-gpt-6/'
image: /news/gpt-6-prompt-caching/cover.webp
sources:
  - url: 'https://developers.openai.com/api/docs/guides/prompt-caching'
    label: 'OpenAI API: guia do cache de prompts'
  - url: 'https://developers.openai.com/api/docs/guides/prompt-caching/diagnostics'
    label: 'OpenAI API: diagnóstico do cache'
lead:
  - 'A OpenAI atualizou o cache de prompts do GPT-6 com taxas de acerto maiores por padrão, um painel para acompanhar a reutilização e diagnósticos que explicam por que uma requisição não usou o cache. Também é possível definir pontos explícitos nos prefixos dos prompts.'
  - 'As mudanças são voltadas a agentes que fazem muitas chamadas relacionadas à API e enviam repetidamente as mesmas instruções, ferramentas e contexto. Segundo a OpenAI, entradas em cache podem receber descontos de até 90%, tornando o comportamento do cache relevante para o custo de agentes em produção.'
---

## A parte da conta de um agente que dá para projetar

O [guia de cache](https://developers.openai.com/api/docs/guides/prompt-caching) diz que a reutilização exige um prefixo compartilhado exatamente igual e configurações compatíveis. Para GPT-5.6 e posteriores, são necessários pelo menos 1.024 tokens de entrada elegíveis. Um bloco estável de instruções e definições de ferramentas pode ser armazenado; o contexto que muda com frequência deve vir depois. Pontos explícitos permitem escolher onde termina o prefixo reutilizável.

Há uma troca de custos. Para esses modelos, a OpenAI documenta a escrita em cache a 1,25 vez o preço da entrada sem cache e a leitura a 0,1 vez. Se o prefixo será usado uma vez só, gravá-lo não compensa. Reutilizado ao longo de uma sessão extensa, pode compensar. O [guia de diagnósticos](https://developers.openai.com/api/docs/guides/prompt-caching/diagnostics) permite comparar requisições e investigar diferenças nas ferramentas ou configurações quando um acerto esperado não acontece.

## Meça antes de comemorar

O [anúncio](https://openai.com/index/better-prompt-caching-for-gpt-6/) traz exemplos de economia de clientes, mas são cargas de trabalho específicas. Acompanhe taxa de acerto, tokens escritos no cache, latência e custo total em conversas representativas. Um ID de sessão sozinho não garante acerto. Se a estrutura do prompt muda a cada turno, o cache não salva uma arquitetura instável.
