---
title: OpenAI leva GPT-6 Sol e Luna ao trabalho cotidiano com IA
summary: Os novos modelos buscam tornar programação e agentes mais rápidos e acessíveis na API e no Codex.
date: '2026-09-22'
order: 1
category: ai
publisher: OpenAI
sourceUrl: 'https://openai.com/index/introducing-gpt-6-sol-and-luna/'
image: /news/gpt-6-sol-luna/cover.webp
sources:
  - url: 'https://developers.openai.com/api/docs/models/gpt-6-sol'
    label: 'OpenAI API: detalhes do modelo GPT-6 Sol'
  - url: 'https://developers.openai.com/api/docs/models/gpt-6-luna'
    label: 'OpenAI API: detalhes do modelo GPT-6 Luna'
  - url: 'https://developers.openai.com/api/docs/changelog'
    label: Histórico de alterações da API OpenAI
lead:
  - 'A OpenAI apresentou GPT-6 Sol e GPT-6 Luna como opções mais rápidas e econômicas da família GPT-6. Segundo a empresa, os modelos levam avanços em programação, uso de computadores, precisão factual e trabalho profissional a tarefas que não exigem toda a capacidade do Astra.'
  - 'Os dois modelos estão disponíveis na API e no Codex. A OpenAI informa que os preços da API são 50% menores que os preços promocionais dos equivalentes GPT-5.6, enquanto melhorias no cache de prompts podem reduzir ainda mais o custo do contexto repetido em agentes de longa duração.'
---

## Dois trabalhos diferentes, um lançamento

A OpenAI posiciona o [Sol](https://developers.openai.com/api/docs/models/gpt-6-sol) para programação complexa e fluxos com agentes e o [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) para tarefas focadas e de alto volume. As páginas dos modelos mostram preços padrão de US$ 2 por milhão de tokens de entrada e US$ 10 de saída para o Sol, contra US$ 0,10 e US$ 0,50 para o Luna. Ambos apresentam janela de contexto de 1,05 milhão de tokens, mas uma janela maior não torna uma tarefa mal definida mais barata ou confiável.

O [artigo de lançamento](https://openai.com/index/introducing-gpt-6-sol-and-luna/) relata avanços em avaliações de programação e agentes e compara o custo por tarefa com modelos rivais. Esses benchmarks vêm da própria OpenAI; ajudam a orientar, mas não substituem testes com seus prompts, ferramentas, latência e modos de falha. O [histórico da API](https://developers.openai.com/api/docs/changelog) confirma os IDs e a disponibilidade nas APIs Responses e Chat Completions.

## O que eu testaria

Execute o mesmo conjunto de tarefas reais nos dois modelos. Acompanhe qualidade da tarefa concluída, tentativas extras, chamadas de ferramentas, tempo total e custo final, não apenas preço por token. Uma chamada barata que exige cinco tentativas pode sair cara. Sol pode fazer sentido para trabalhos ambíguos e de várias etapas; Luna pode vencer quando a tarefa é estreita e repetida em escala. A resposta está na sua carga de trabalho, não no nome do modelo.
