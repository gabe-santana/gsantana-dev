---
title: 'Anthropic lança o Claude Sonnet 5.5: código agêntico no nível do Opus pelo preço de um Sonnet'
summary: O segundo modelo da família 5.5 é mais de 30% mais rápido que o Sonnet 5, custa até 30% menos por tarefa, mantém os preços de US$ 2 e US$ 10 por milhão de tokens e passa o Opus 5.5 no Terminal-Bench.
date: '2026-09-28'
order: 0
category: ai
publisher: Anthropic
sourceUrl: 'https://www.anthropic.com/claude-sonnet-5-5'
image: /news/anthropic-claude-sonnet-5-5/cover.webp?v=1
sources:
  - url: 'https://www.anthropic.com/claude-sonnet-5-5'
    label: 'Anthropic: apresentando o Claude Sonnet 5.5'
  - url: 'https://techcrunch.com/2026/09/28/anthropic-releases-sonnet-5-5-which-it-calls-a-significantly-cheaper-faster-work-partner/'
    label: 'TechCrunch: Anthropic lança o Sonnet 5.5, mais barato e mais rápido'
  - url: 'https://thenextweb.com/news/sonnet-5-5-cyber-distillation'
    label: 'The Next Web: o Sonnet 5.5 chega com os limites de ciber dos modelos topo de linha'
lead:
  - 'A Anthropic lançou hoje o Claude Sonnet 5.5, o segundo modelo da família 5.5, poucos dias depois do Opus 5.5. A proposta é ser o parceiro de trabalho do dia a dia: mais de 30% mais rápido que o Sonnet 5 para gerar resposta e até 30% mais barato por tarefa, porque resolve o mesmo trabalho com menos tokens e menos chamadas de ferramenta. O preço por token não mudou: US$ 2 por milhão de tokens de entrada e US$ 10 por milhão de saída.'
  - 'O salto maior está em código agêntico. No Terminal-Bench 4.0, o Sonnet 5.5 marca 70,6%, contra 10,3% do Sonnet 5 e 66,4% do Opus 5.5, que custa o dobro. Ele já está disponível na Claude Platform, na AWS, no Google Cloud e na Microsoft Azure com o ID claude-sonnet-5-5, e o Haiku 5.5 vem "nas próximas semanas".'
---

## Os números que importam

A Anthropic posiciona o Sonnet 5.5 como o mais forte em tarefas bem delimitadas do dia a dia: corrigir bugs e produzir documentos, apresentações e planilhas bem acabados. Os benchmarks do anúncio mostram um modelo que encosta no Opus 5.5 em quase tudo e passa dele em uma prova:

| Benchmark | Sonnet 5 | Sonnet 5.5 | Opus 5.5 |
|---|---|---|---|
| Terminal-Bench 4.0 | 10,3% | **70,6%** | 66,4% |
| CursorBench 4.0 | 34,1% | 55,5% | 57,8% |
| FrontierCode 1.1 (Max) | 42,4% | 46,2% | 54,4% |
| OSWorld 2.1 (uso do computador) | 57,0% | 80,1% | 81,8% |
| GDPval-AA v2.1 (trabalho de escritório) | 1449 | 1844 | 1846 |
| Humanity's Last Exam (com ferramentas) | 54,9% | 64,5% | 67,7% |

Também é o primeiro Sonnet a zerar Pokémon Red olhando só para capturas de tela, um teste de fôlego em tarefas longas e de leitura de imagem.

## Mais barato por tarefa, não por token

O preço de tabela é o mesmo do Sonnet 5, então a economia vem de gastar menos. Os clientes citados no anúncio dão a medida: a Balyasny Asset Management rodou 2.441 tarefas de finanças e viu a média cair de 497 mil para 121 mil tokens por resposta; a Box mediu execuções 2,4 vezes mais rápidas com 12% menos tokens; a Base44, em 118 apps reais, precisou em média de 3,6 iterações contra 7,7 do Opus 5. Para quem roda muitos agentes em paralelo, é aí que o Sonnet 5.5 passa o Opus: quase a mesma qualidade, metade do preço por token e menos tokens por tarefa.

## O primeiro Sonnet com as travas de um Opus

Duas mudanças de segurança chegam ao Sonnet pela primeira vez. Pedidos de cibersegurança de maior risco agora caem, de forma visível, para o Sonnet 5, as mesmas salvaguardas que antes só existiam nos modelos topo de linha; quem trabalha com defesa pode pedir acesso ampliado pelo Cyber Verification Program. E o modelo estreia com classificadores que bloqueiam a extração do raciocínio: o pensamento preservado fica preso à conta que o gerou. Segundo o The Next Web, é uma resposta ao episódio de agosto em que pesquisadores decodificaram 315.320 blocos de raciocínio a partir de 6.708 traces públicos de agentes e recuperaram credenciais.

Na prática, se você usa o Sonnet em produção, a troca é quase só o ID do modelo. Vale conferir duas coisas antes: as notas de migração pedem trocar a configuração de raciocínio `thinking_off` por `between_tools`, e a amarração do raciocínio à conta afeta quem troca de conta no meio de uma sessão do Claude Code.
