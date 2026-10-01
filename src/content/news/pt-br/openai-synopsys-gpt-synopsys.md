---
title: OpenAI e Synopsys criam o GPT-Synopsys, um modelo que opera sozinho as ferramentas de projeto de chips
summary: O engenheiro passa um objetivo de projeto e o modelo roda as ferramentas de EDA da Synopsys, lê os resultados, faz mudanças e repete até o projeto passar na verificação. A OpenAI licencia as ferramentas e as duas dividem a receita, mas ainda não há data de lançamento, preço nem benchmark.
date: '2026-10-01'
order: 0
category: ai
publisher: Synopsys
sourceUrl: 'https://news.synopsys.com/2026-09-30-OpenAI-and-Synopsys-Announce-GPT-Synopsys-Frontier-Intelligence-to-Revolutionize-Chip-Design'
image: /news/openai-synopsys-gpt-synopsys/cover.webp?v=1
sources:
  - url: 'https://news.synopsys.com/2026-09-30-OpenAI-and-Synopsys-Announce-GPT-Synopsys-Frontier-Intelligence-to-Revolutionize-Chip-Design'
    label: 'Synopsys: OpenAI e Synopsys anunciam o GPT-Synopsys'
  - url: 'https://www.investing.com/news/company-news/synopsys-openai-partner-on-ai-model-for-chip-design-93CH-4925728'
    label: 'Investing.com: Synopsys e OpenAI se unem num modelo de IA para projeto de chips'
  - url: 'https://www.business-standard.com/technology/artificial-intelligence/gpt-synopsys-openai-synopsys-team-up-to-build-gpt-model-for-ai-powered-chip-design-126100100428_1.html'
    label: 'Business Standard: OpenAI e Synopsys criam um modelo GPT para projeto de chips'
lead:
  - 'A OpenAI e a Synopsys anunciaram na quarta-feira o GPT-Synopsys, um modelo especializado, construído sobre os modelos de ponta da OpenAI, que opera o software de automação de projeto eletrônico (EDA) da Synopsys. O engenheiro passa um objetivo de projeto, e o modelo roda as ferramentas, interpreta os resultados, implementa as mudanças e repete até chegar a um resultado verificado. "Com a Synopsys, estamos levando esse trabalho para o projeto de chips, ajudando engenheiros a explorar mais projetos e chegar mais rápido a um chip que funciona", disse Greg Brockman, presidente da OpenAI.'
  - 'Pelo acordo de vários anos, a OpenAI licencia as ferramentas de EDA da Synopsys para construir o modelo, e as duas empresas dividem a receita e vendem juntas. O GPT-Synopsys roda na infraestrutura da OpenAI e se conecta ao Synopsys.ai e ao Synopsys Autopilot, a plataforma de agentes da empresa. Já há testes com "clientes líderes de semicondutores", que nenhuma das duas nomeou, e não há data de lançamento.'
---

## O ciclo que ele automatiza

Projetar um chip é uma longa cadeia de execuções de ferramentas: síntese, posicionamento, análise de timing, verificação, e volta tudo de novo sempre que uma restrição falha. Cada execução gera relatórios que um engenheiro lê para decidir a próxima mudança. O GPT-Synopsys mira esse ciclo, o mesmo formato de um agente de código que roda os testes e corrige o que quebra, só que aplicado a ferramentas com licenças caras e execuções que podem levar horas. Ele também foi feito para funcionar dentro dos próprios harnesses de agentes dos clientes, então um time de chips pode chamá-lo a partir da automação que já tem.

As condições sobre os dados são a parte que as empresas de semicondutores vão ler primeiro, porque projetos de chips estão entre os arquivos mais protegidos da indústria. A Synopsys diz que os dados dos clientes não são usados para treinar o modelo, ficam criptografados em repouso e em trânsito e vêm com controles configuráveis de retenção, auditoria e permissão. O modelo continua rodando na nuvem da OpenAI, e não nas máquinas do cliente.

## O que falta

O anúncio deixa de fora tudo o que seria preciso para avaliar o produto: o modelo de base, qualquer benchmark ou número de produtividade, preços, os nomes dos clientes que estão testando e uma data. Sassine Ghazi, CEO da Synopsys, resumiu o objetivo como levar "inteligência de ponta ao projeto de chips para ajudar mais empresas a desenvolver e acelerar silício avançado". Até os primeiros clientes mostrarem resultados, só as empresas desses primeiros testes conseguem usar o modelo.
