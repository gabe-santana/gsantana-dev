---
title: "Anthropic diz que modelos abertos pequenos podem estar a meses de se copiar sozinhos para TV boxes e fornos inteligentes"
summary: "O Frontier Red Team da Anthropic rodou um modelo de 26B dividido entre 15 TV boxes Android baratas e viu o GLM-5.2 se replicar por uma rede emulada de oito aparelhos. A etapa de invasão foi facilitada de propósito, então os resultados são um teto, mas a tendência coloca modelos de até 30B parâmetros nesse nível até o fim de 2026."
date: '2026-10-14'
order: 0
category: security
publisher: Anthropic
sourceUrl: 'https://www.anthropic.com/research/self-replicating-ai'
image: /news/anthropic-small-models-self-replication-iot/cover.webp?v=1
sources:
  - url: 'https://www.anthropic.com/research/self-replicating-ai'
    label: 'Anthropic: modelos de IA podem ser capazes de se autorreplicar sem acesso a um datacenter'
  - url: 'https://aiweekly.co/alerts/anthropic-small-open-models-months-from-iot-self-replication'
    label: 'AI Weekly: Anthropic diz que modelos abertos pequenos estão a meses da autorreplicação em IoT'
  - url: 'https://cryptobriefing.com/anthropic-small-ai-models-self-replicate-iot/'
    label: 'Crypto Briefing: Anthropic alerta que modelos pequenos podem logo se autorreplicar em dispositivos IoT'
lead:
  - "O Frontier Red Team da Anthropic publicou na segunda-feira uma pesquisa que diz que modelos pequenos de pesos abertos \"podem estar a meses\" de conseguir se autorreplicar em aparelhos comerciais de internet das coisas, como fornos inteligentes e TV boxes Android sem marca. Os autores, William Zhou e Daniel Freeman, dividiram a replicação em quatro etapas (achar alvos, conseguir executar código neles, montar a inferência e se espalhar) e se concentraram na terceira, em que o modelo precisa colocar os próprios pesos para rodar num hardware que nunca viu."
  - "O Qwen3.5-9B conseguiu subir um servidor de inferência em 8 dos 9 tipos de hardware testados, de Jetson Nanos a Macs, e o Gemma4-26B-A4B rodou dividido entre 15 TV boxes Android de cerca de US$ 55 cada, a 0,39 token por segundo. Num teste de ponta a ponta com oito aparelhos Android emulados e uma porta de depuração sem autenticação, o GLM-5.2 foi o único modelo aberto a se copiar até o fim: chegou aos 8 nós em 4 de 5 tentativas e a 7 na quinta. Os outros modelos falharam de forma consistente."
---

## Lento, e difícil de desligar

Um worm assim andaria devagar. Montar a inferência levou de 28 a 51 horas por salto no Qwen3.5-9B e de 71 a 150 horas no Gemma sem otimização. A Anthropic também fez a conta com o Kimwolf, uma botnet com mais de 2 milhões de aparelhos relatados: uma cópia do Gemma a cada 15 TV boxes daria cerca de 133 mil réplicas gerando uns 80 mil tokens por segundo no total, mais ou menos o que 40 H100 servem. É pouca computação espalhada por um número enorme de casas, e, nas palavras dos autores, "não existe um ponto central para desligar".

Os modelos também melhoraram sem treino novo. O harness da Anthropic, o Memento, reinicia o agente com anotações deixadas pelas tentativas que falharam antes, e em seis gerações a taxa de sucesso do Qwen3.5-9B na montagem da inferência subiu de 45% para algo entre 61% e 84%. Dar ao modelo pequeno o Claude Opus 4.8 como conselheiro não fez diferença significativa. Na tendência, modelos de até 30B parâmetros vêm ganhando 13,7 pontos por ano no índice de capacidades da Epoch, o que colocaria um deles no nível do GLM-5.2 até o fim de 2026. A Anthropic estima ainda que os chips de IA de borda já instalados somam de 9 mil a 35 mil equivalentes de H100, mas espera que a parte alcançável seja dez vezes menor ou menos.

## As ressalvas, e a defesa

Os autores chamam os resultados de "sinais de vida" e dizem que ainda não têm um replicador rebelde completo. A rede de teste deixou a porta de depuração do Android aberta e sem autenticação, então as taxas de sucesso são um teto, e o prazo se apoia num índice geral de capacidade, que não mede replicação. Os modelos pequenos também foram mal em spearphishing, algo que os autores esperam que modelos maiores façam.

As defesas propostas são antigas, aplicadas a uma carga nova. Provedores de internet podem monitorar transferências de modelos de vários gigabytes e tráfego estranho de inferência entre aparelhos, e honeypots podem capturar o harness do worm. Quando provedores colocaram em quarentena e avisaram os clientes infectados pelo Mirai, 92% das infecções sumiram em 14 dias, contra 74% sem aviso. Fabricantes podem reduzir o número de alvos com configurações seguras de fábrica, como o Reino Unido fez ao proibir senhas padrão em IoT. O objetivo é levar a taxa de propagação de cada replicador para baixo de um, para ele morrer sozinho. Para quem fabrica ou configura aparelhos, a leitura prática é direta: uma porta de depuração aberta na rede agora também é um lugar onde o modelo de outra pessoa pode rodar.
