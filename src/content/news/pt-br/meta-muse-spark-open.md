---
title: "Meta lança o Muse Spark Open, um modelo aberto de 816B feito para rodar em dois Mac Studio"
summary: "O modelo de mistura de especialistas ativa 42B dos seus 816B parâmetros por token, lê texto, imagem, vídeo e áudio e tem contexto de 1M de tokens. A Meta o chama de modelo de pesos abertos mais capaz dos EUA, e a própria tabela dela confirma isso, mas ainda o coloca atrás do GLM 5.3 e do Kimi K3 na maioria dos benchmarks de agentes e código."
date: '2026-10-16'
order: 0
category: ai
publisher: Meta
sourceUrl: 'https://research.meta.ai/blog/muse-spark-open'
image: /news/meta-muse-spark-open/cover.webp?v=1
sources:
  - url: 'https://research.meta.ai/blog/muse-spark-open'
    label: 'Meta AI Research: Muse Spark Open'
  - url: 'https://huggingface.co/meta-models/Muse-Spark-Open-816B-A42B'
    label: 'Hugging Face: model card do Muse-Spark-Open-816B-A42B'
  - url: 'https://techcrunch.com/2026/10/15/meta-launches-an-open-weight-model-that-runs-on-macs/'
    label: 'TechCrunch: Meta lança um modelo de pesos abertos que roda em Macs'
  - url: 'https://9to5mac.com/2026/10/15/meta-launches-new-muse-spark-open-model-optimized-to-run-on-mac-studio/'
    label: '9to5Mac: Meta lança o Muse Spark Open, otimizado para o Mac Studio'
  - url: 'https://www.engadget.com/2287833/meta-built-a-huge-open-weight-ai-model-for-macs-but-youll-need-1tb-of-ram-to-run-it/'
    label: 'Engadget: a Meta fez um modelo aberto enorme para Macs, mas ele pede 1 TB de RAM'
lead:
  - "A Meta liberou na quinta-feira os pesos do Muse Spark Open, uma versão aberta do modelo por trás da família Muse Spark. É um transformer de mistura de especialistas com 816 bilhões de parâmetros, dos quais 42 bilhões ficam ativos por token (8 de 256 especialistas por camada), janela de contexto de 1 milhão de tokens e entrada nativa de texto, imagem, vídeo e áudio. Os checkpoints em BF16 e NVFP4 estão no Hugging Face, atrás de um formulário de acesso, e as APIs hospedadas já funcionam na Baseten, Fireworks AI, Groq, Modal, Nebius, OpenRouter e Together AI."
  - "A Meta montou o lançamento em volta do hardware da Apple. Dois Mac Studio com M5 Ultra e 512 GB de memória unificada cada, ligados por Thunderbolt 5 e dividindo o modelo com o MLX, comportam o modelo inteiro, o que a Meta descreve como duas máquinas que \"se comportam como um supercomputador com um terabyte de memória unificada\". A configuração de 512 GB só chega no fim do mês; o Engadget lembra que quatro Mac Studio de 256 GB também servem e custam cerca de US$ 38 mil. Em servidor, o model card pede uns 2 TB de memória em BF16 e pelo menos 700 GB de VRAM em NVFP4."
---

## Onde ele fica na tabela da própria Meta

A Meta chama o modelo de "o modelo de pesos abertos mais capaz dos EUA até hoje", e os outros modelos americanos da tabela confirmam. O Muse Spark Open marca 39 no Intelligence Index da Artificial Analysis, contra 23 do Nemotron 3 Ultra, da Nvidia, e vence o [Beam, da Reflection AI](/pt-br/news/reflection-ai-beam-open-weight/), em 6 dos 8 benchmarks que os dois reportam. Também passa por pouco o [Mistral Large 4](/pt-br/news/mistral-large-4/), com 38 no índice. Lidera a tabela inteira no MCP-Atlas (89,2), no JobBench (61,8), no Humanity's Last Exam sem ferramentas (26,1) e no AA Omniscience (25).

A mesma tabela mostra onde está a fronteira dos modelos abertos. O GLM 5.3, da Z.ai, marca 45 no Intelligence Index e o Kimi K3, 44. Em código e terminal, o Muse Spark Open faz 60 no DeepSWE 1.1, contra 67 do GLM 5.3 e 68 do Kimi K3, e 76,4 no Terminal-Bench 2.1, abaixo dos dois e abaixo do Beam, com 80,1. Todos os números são da Meta, rodados no esforço de raciocínio mais alto, então resultados independentes vão pesar mais do que o normal.

As colunas de segurança são as mais marcantes. Sob ataques adaptativos do StrongREJECT, o modelo obedeceu em 0,5% dos casos, contra 62,9% a 86,4% dos outros modelos abertos testados, mas também recusou mais pedidos inofensivos no FORTRESS (17,4%, contra 2,7% do Kimi K3). A Meta diz que os pesos abertos receberam pós-treino extra de segurança e recomenda envolver o modelo em proteções no nível do sistema, já que o checkpoint não vem com nenhuma.

## A licença

A Muse Model License não tem limite de usuários mensais. O limite é de receita: uma empresa que vende acesso ao modelo ou a derivados como serviço precisa assinar um acordo separado com a Meta quando esse negócio passa de US$ 20 milhões de receita bruta em 12 meses, enquanto uso interno e embutir o modelo no seu próprio produto não acionam a regra. Produtos precisam mostrar "Built with Muse Spark Open", a Meta não reivindica direitos sobre as saídas, e baixar os pesos exige um formulário com nome completo, data de nascimento e organização.
