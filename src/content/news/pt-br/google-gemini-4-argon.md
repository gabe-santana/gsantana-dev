---
title: Google anuncia o Gemini 4 Argon, seu novo modelo de ponta, e entrega primeiro a quem faz ciberdefesa
summary: O Argon marca 77,9% no DeepSWE, contra 74,2% do Claude Opus 5.5 e 74,1% do GPT-6 Astra, e pode escrever até 1 milhão de tokens numa resposta. Ele estreia a US$ 2 e US$ 10 por milhão de tokens, que depois sobem para US$ 4 e US$ 20, quando chegar aos clientes pagos da API e ao Google AI Ultra.
date: '2026-09-30'
order: 0
category: ai
publisher: Google
sourceUrl: 'https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-4-argon/'
image: /news/google-gemini-4-argon/cover.webp?v=1
sources:
  - url: 'https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-4-argon/'
    label: 'Google: Gemini 4 Argon, a próxima era da inteligência de ponta'
  - url: 'https://9to5google.com/2026/09/30/gemini-4-argon-announcement/'
    label: '9to5Google: o Gemini 4 Argon é o novo modelo de ponta do Google'
  - url: 'https://thenewstack.io/google-gemini-4-argon/'
    label: 'The New Stack: o Gemini 4 Argon chegou, e você ainda não pode usar'
lead:
  - 'O Google anunciou na quarta-feira o Gemini 4 Argon, o primeiro modelo da sua nova geração, feito para engenharia de software, trabalho de conhecimento em empresas e ciberdefesa. Koray Kavukcuoglu, arquiteto-chefe de IA do Google DeepMind, escreveu que o Argon "está mudando de forma fundamental o jeito como trabalhamos e construímos no Google", onde ele já roda milhares de fluxos internos. Os primeiros usuários de fora são os defensores de confiança do Fairwind Program, o programa de ciberdefesa do Google. Assinantes do Google AI Ultra e clientes pagos da API recebem o modelo "em breve", ainda sem data.'
  - 'No DeepSWE v1.1, um benchmark de código, o Argon marca 77,9%, contra 74,2% do Claude Opus 5.5 e 74,1% do GPT-6 Astra. O limite de saída sobe de 64 mil tokens para 1 milhão, então uma única resposta pode levar centenas de milhares de tokens de raciocínio e código. O preço de lançamento é US$ 2 por milhão de tokens de entrada e US$ 10 por milhão de saída, com a entrada em cache 95% mais barata; depois do período de lançamento, passa a US$ 4 e US$ 20.'
---

## Os números que o Google publicou

Além do DeepSWE, o Google diz que o Argon ficou em primeiro no AutomationBench, o teste da Zapier para fluxos de trabalho de ponta a ponta em empresas, com 51,3%; é o estado da arte no LVBench, de vídeos longos, com 91,7%; e empatou em primeiro no CWE-bench v1, que mede a capacidade de corrigir vulnerabilidades, com 68%. A empresa também afirma que o Argon lidera o Vals Index em finanças, código, direito e tributos, e o benchmark da Harvey para agentes jurídicos.

Todos esses números vêm do anúncio do Google, e ninguém fora do Fairwind Program consegue conferir ainda. Como referência, a OpenAI publicou 75,2% no DeepSWE v1.1 para o [GPT-6.1 Sol](/pt-br/news/openai-devday-dots-gpt-6-1-sol/) na terça-feira, pelos mesmos US$ 2 e US$ 10 que o Argon cobra no período de lançamento. O preço normal do Argon, US$ 4 e US$ 20, é o que o Claude Opus 5.5 custa hoje.

## Uma resposta que pode chegar a 1 milhão de tokens

O limite de saída é a mudança que quem desenvolve vai notar primeiro. O GPT-6.1 Sol para em 128 mil tokens de saída; o Argon pode ir até 1 milhão, e o Google apresenta essa folga como o objetivo: "quando o modelo tem espaço para pensar a fundo e gerar centenas de milhares de tokens numa única trajetória, ganha um novo nível de profundidade no raciocínio para resolver problemas difíceis de uma vez".

Isso também muda a conta. Uma requisição que usa o limite inteiro custa US$ 10 de saída no preço de lançamento e US$ 20 no preço normal, e demora o tempo que leva gerar um milhão de tokens. Quando o Argon chegar à API, defina um máximo de saída por requisição e um alerta de gastos antes de apontar um agente para ele.

## Defensores primeiro

O Argon foi feito em parte para ciberdefesa, e o Google está entregando o modelo primeiro a defensores verificados, a mesma ordem que a Anthropic seguiu com o Claude Mythos Preview. As notícias da semana explicam o cuidado: na terça-feira, o red team da Anthropic mostrou que [um modelo de pesos abertos, o GLM-5.3, já monta exploits quase tão bem quanto o Mythos Preview](/pt-br/news/anthropic-glm-5-3-cyber-capabilities/). O Google não deu data para a liberação ampla, então, para todo o resto, os números acima são uma promessa para testar quando o acesso abrir.
