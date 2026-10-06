---
title: Reflection AI apresenta o Beam, um modelo de pesos abertos com 501B de parâmetros que sai sob Apache 2.0
summary: O modelo esparso de mixture-of-experts ativa 23B de parâmetros por token, lê até 1M de tokens e, pelos números da própria Reflection, compete com o GLM 5.2 em código e trabalho de agentes. Os pesos, o relatório técnico e as versões quantizadas saem ainda em outubro; por enquanto só existe um programa de acesso antecipado.
date: '2026-10-05'
order: 0
category: ai
publisher: Reflection AI
sourceUrl: 'https://reflection.ai/blog/introducing-beam'
image: /news/reflection-ai-beam-open-weight/cover.webp?v=1
sources:
  - url: 'https://reflection.ai/blog/introducing-beam'
    label: 'Reflection AI: apresentando o Beam, o modelo de pesos abertos de 501B da Reflection'
  - url: 'https://siliconangle.com/2026/10/05/reflection-ai-debuts-open-source-beam-model-with-501b-parameters/'
    label: 'SiliconANGLE: Reflection AI estreia o Beam, modelo open source com 501B de parâmetros'
  - url: 'https://alphasignal.ai/news/reflection-ai-s-beam-challenges-deepseek-with-501b-open-weight-reasoning-model'
    label: 'AlphaSignal: o Beam da Reflection AI, um modelo de raciocínio de pesos abertos com 501B'
lead:
  - 'A Reflection AI anunciou nesta segunda-feira o Beam, um modelo só de texto com 501 bilhões de parâmetros no total, dos quais 23 bilhões ficam ativos a cada token, treinado para código, raciocínio e trabalho de agentes. Ele foi pré-treinado com 23,8 trilhões de tokens em 6.144 GPUs NVIDIA GB300 em menos de quatro semanas e depois passou mais quatro semanas em aprendizado por reforço em cerca de 10.500 GB300, gerando mais de 100 milhões de rollouts avaliados em 1,3 bilhão de sandboxes. "O Beam avança a fronteira ocidental de pesos abertos", escreveu a empresa.'
  - 'Segundo a Reflection, os pesos saem sob a licença Apache 2.0 ainda este mês, junto com um relatório técnico, um model card, versões quantizadas em FP8 e NVFP4 e ferramentas para fazer fine-tuning. Até lá, o Beam só está disponível por um programa de acesso antecipado. A startup, fundada pelos ex-pesquisadores do Google DeepMind Misha Laskin e Ioannis Antonoglou, levantou dinheiro a uma avaliação de US$ 25 bilhões há alguns meses, segundo o SiliconANGLE.'
---

## Onde ele fica

A tabela da própria Reflection põe o Beam em 77,2% no SWE-Bench Pro v2-Hard, 80,1% no Terminal Bench v2.1, 44,4% no DeepSWE v1.1, 97,8% no AIME 2026 e 90,5% no GPQA Diamond. A empresa diz que ele é competitivo com o GLM 5.2, um modelo com cerca de 250 bilhões de parâmetros a mais, usando de três a quatro vezes menos computação de inferência para notas de raciocínio parecidas, e que chega perto do Qwen 3.8-Max em código e tarefas de agente. Também diz que o Kimi K3 continua à frente em capacidade bruta. Esses três são os modelos abertos da Zhipu, da Alibaba e da Moonshot que lideraram os pesos abertos este ano, e o Beam mira empresas que querem um modelo dessa classe vindo de um laboratório americano. No DeepSWE, o mais difícil dos testes de código, a fronteira fechada ainda está longe: o Google informou 77,9% para o [Gemini 4 Argon](/pt-br/news/google-gemini-4-argon/) na semana passada.

O projeto mira o custo de servir. Com 23 bilhões de parâmetros ativos, cada token custa mais ou menos a computação de um modelo denso de porte médio, mas os 501 bilhões continuam precisando caber na memória: cerca de 500 GB de pesos em FP8 e uns 280 GB em NVFP4, o que significa um servidor com várias GPUs, não uma estação de trabalho.

## O que ainda não saiu

Todos os números acima vêm do próprio harness de avaliação da Reflection, e ninguém de fora da empresa consegue conferi-los até os pesos e o código de serving ficarem públicos. O contexto de 1M de tokens foi alcançado no midtraining, enquanto o aprendizado por reforço rodou com 256K, e uma janela que a arquitetura suporta diz pouco sobre a precisão ao longo dela inteira. A parte firme do anúncio é a licença: a Apache 2.0 permite uso comercial, modificação e fine-tuning sem as restrições de uso que vêm com licenças próprias de modelos. Se o resto se sustenta, vai ficar claro quando os pesos saírem, ainda este mês.
