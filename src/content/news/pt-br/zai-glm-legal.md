---
title: "O GLM-Legal da Z.ai quase empata com o Gemini 4 Argon em trabalho jurídico com agentes, por um setenta avos do custo"
summary: O modelo jurídico, construído sobre o GLM-5.3-Flash com aprendizado por reforço em dezenas de milhares de ambientes jurídicos, resolve 19,2% das tarefas do Legal Agent Benchmark da Harvey e aparece em sétimo no placar da Vals AI, a 15 centavos de dólar por tarefa. Está em beta fechado para escritórios de advocacia, sem preço publicado e, por enquanto, sem pesos abertos.
date: '2026-10-13'
order: 0
category: ai
publisher: Z.ai
sourceUrl: 'https://z.ai/blog/glm-legal'
image: /news/zai-glm-legal/cover.webp?v=1
sources:
  - url: 'https://z.ai/blog/glm-legal'
    label: 'Z.ai: GLM-Legal, avançando a inteligência jurídica com agentes'
  - url: 'https://www.vals.ai/benchmarks/hlab'
    label: 'Vals AI: placar do Legal Agent Benchmark da Harvey'
  - url: 'https://www.artificiallawyer.com/2026/10/13/chinese-company-launches-legal-specific-llm/'
    label: 'Artificial Lawyer: empresa chinesa lança LLM específico para o direito'
  - url: 'https://www.unite.ai/z-ai-unveils-glm-legal-an-agentic-model-for-legal-workflows/'
    label: 'Unite.AI: Z.ai apresenta o GLM-Legal, um modelo com agentes para fluxos jurídicos'
  - url: 'https://cellcog.ai/blog/glm-legal/'
    label: 'CellCog: GLM-Legal, o modelo jurídico da Z.ai, com os benchmarks conferidos'
lead:
  - 'A Z.ai, empresa antes conhecida como Zhipu AI, anunciou na segunda-feira o GLM-Legal, um modelo treinado para trabalho jurídico, da revisão de contratos ao compliance regulatório. Ele parte do GLM-5.3-Flash, ganha uma etapa de midtraining com acervos jurídicos e aprendizado por reforço em "dezenas de milhares de ambientes jurídicos realistas", e transforma avaliações de advogados em atividade em mais sinal de treino.'
  - 'No Legal Agent Benchmark da Harvey, que testa um agente fazendo trabalho jurídico com documentos, planilhas, apresentações e ferramentas de sistema de arquivos, e só aprova uma tarefa se todos os critérios de avaliação passarem, o GLM-Legal faz 19,2%, contra 6,7% do modelo base. O placar independente da Vals AI o lista em sétimo, com 19,17%, logo atrás do Gemini 4 Argon, do Google, com 19,58%, a US$ 0,15 por tarefa contra US$ 10,55 do Argon. O acesso é por beta fechado para escritórios de advocacia, empresas de tecnologia jurídica e departamentos jurídicos, e a Z.ai não publicou preço.'
---

## O placar em volta dele

A tabela da Vals, atualizada na segunda-feira, é liderada pela família Muse Spark, com o Muse Spark 1.2 em 25,42%, e pelo Wonder Full, com 21,67%. Abaixo do GLM-Legal vêm o [Mistral Large 4](/pt-br/news/mistral-large-4/), com 15,83%, o Kimi K3, com 12,92%, o Claude Fable 5, com 11,25%, e o GPT-6 Astra, com 5,42%. O custo por tarefa separa os modelos mais do que as notas: os 15 centavos do GLM-Legal são o menor valor entre os 13 primeiros, contra US$ 19,23 do Fable 5 e US$ 26,16 do GPT-6 Astra. Ele também está entre os mais lentos, com média de 1 hora e 12 minutos por tarefa, três vezes os 24 minutos do líder.

Os números absolutos são baixos na tabela inteira porque a avaliação é rígida: dois modelos juízes pontuam cada tarefa, e um único critério perdido reprova tudo. Com 19%, cerca de quatro tarefas em cada cinco ainda dão errado em algum ponto, então um advogado ainda precisa revisar o que esses agentes entregam.

## O que os escritórios vão perguntar primeiro

A Z.ai não disse quais jurisdições o modelo cobre, e a outra afirmação jurídica dela, de paridade com sistemas de fronteira no PLawBench, se refere a consultoria, análise de casos e redação no direito chinês. O resultado no LegalBench também vem só da Z.ai: 86,2 contra 88,6 do Claude Fable 5, segundo o gráfico da Z.ai citado pela CellCog. O GLM-Legal não sai com pesos abertos por enquanto, então os documentos dos clientes iriam para a API da Z.ai, e, como resumiu a Artificial Lawyer, "os advogados, compreensivelmente, vão querer saber mais sobre para onde os dados vão". A Z.ai diz que o modelo também vai chegar ao AutoClaw, o agente de desktop dela, sem data.
