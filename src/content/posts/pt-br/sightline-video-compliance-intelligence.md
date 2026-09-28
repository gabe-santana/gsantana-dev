---
title: "Sightline: transformando horas de vídeo em respostas auditáveis na AWS"
description: "Como construí um pipeline orientado a eventos na AWS que transcreve, indexa e consulta vídeos longos, e por que o modelo nunca escreve as próprias citações."
date: "2026-09-27"
tags: [Software Architecture, AI Agents, RAG, AWS, Terraform]
# ?v= busts the 404 some CDN edges cached before the image was uploaded.
cover: "/posts/sightline-video-compliance-intelligence/cover.webp?v=2"
tldr:
  - "O Sightline responde perguntas de compliance sobre vídeos gravados com JSON validado por schema: cada finding traz o ID do vídeo, o timestamp e um score de confiança."
  - "A ingestão são três etapas no EventBridge, cada uma com política de retry e dead-letter queue própria; a rota de consulta nunca deixa o modelo informar ID de vídeo ou timestamp."
  - "A computação roda em subnets privadas sem NAT gateway: todo serviço da AWS é alcançado por VPC endpoint, e o App Runner é o único recurso exposto à internet."
---

Times de compliance no mercado financeiro gravam tudo: sessões de assessoria, teleconferências de resultados, treinamentos. Depois alguém precisa assistir. O pedido que deu origem ao [Sightline](https://github.com/gabe-santana/sightline) veio exatamente dessa dor: mais de 3.000 horas de vídeo por mês, revisão manual custando mais de um milhão e meio de dólares por ano, ciclos que levam semanas e violações que mesmo assim passam. O cliente queria três coisas que costumam brigar entre si: **centavos por vídeo de duas horas**, respostas para perguntas como *"encontre todas as vezes em que um assessor falou de criptoativos não aprovados e me dê os timestamps"* e **uma saída que sobreviva a uma auditoria**.

Esse último requisito definiu todo o resto. Um chatbot que responde em prosa fluente não serve para nada aqui. O analista de compliance precisa pular para o minuto 47 de uma gravação específica e ouvir a frase com os próprios ouvidos. Por isso o Sightline não devolve prosa. Ele devolve um documento JSON em que cada finding aponta para um `video_id` e um `timestamp_s`, e esses dois campos nunca vêm do modelo de linguagem.

Este texto segue o código: como cada parte funciona e por que ela tem esse formato.

## A arquitetura em uma tela

<div id="sightline-system-slot"></div>

Tudo roda em **uma VPC com subnets privadas em camadas**, criada pelo [Terraform](https://github.com/gabe-santana/sightline/tree/main/infra): uma para o app, uma para o banco e uma para os jobs, espalhadas por duas zonas de disponibilidade. O isolamento entre as camadas é feito por [security groups](https://github.com/gabe-santana/sightline/blob/main/infra/security_groups.tf) que só liberam saída para o Postgres na porta 5432, para os VPC endpoints na 443 e para o S3 pela prefix list do gateway. Nada além disso. Cada responsabilidade fica separada sem que o app precise de peering ou Transit Gateway para alcançar o armazenamento.

<figure style="margin:2rem 0;">
  <img src="/posts/sightline-video-compliance-intelligence/infra.svg" alt="Infraestrutura do Sightline na AWS: uma VPC em duas zonas de disponibilidade com três subnets privadas. O app-service fica na primeira, o Amazon RDS na segunda e as Lambdas transcriber-job e embedding-job na terceira. Elas acessam o Amazon Bedrock, o Amazon EventBridge, o Amazon Transcribe e o armazenamento no S3, fora das subnets." width="671" height="681" style="display:block;width:100%;max-width:671px;height:auto;margin:0 auto;" />
  <figcaption style="margin-top:8px;text-align:center;font-size:0.9rem;color:#8b93a7;font-style:italic;">A infraestrutura como foi implantada, no <a href="https://github.com/gabe-santana/sightline/blob/main/docs/res/img/infra.svg" target="_blank" rel="noopener noreferrer">diagrama draw.io</a> do repositório.</figcaption>
</figure>

**Não existe NAT gateway.** Todo serviço da AWS de que a camada de computação precisa (Bedrock, Transcribe, EventBridge, Secrets Manager, S3 Vectors) é acessado por um interface endpoint, e o S3 por um gateway endpoint, tudo declarado no [`vpc.tf`](https://github.com/gabe-santana/sightline/blob/main/infra/vpc.tf). Uma Lambda dentro dessa VPC não alcança a internet aberta nem se o código quisesse. Com conteúdo regulado, prefiro essa garantia imposta pela rede a uma promessa feita pelo código.

A entrada é igualmente enxuta. O `app-service`, um app Next.js que serve tanto a interface do analista quanto a API de consulta, roda no **AWS App Runner, no próprio domínio**. O App Runner já faz TLS, balanceamento de carga e autoscaling, então ele é o único recurso exposto à internet, sem gateway ou load balancer extra na frente, e alcança a VPC por um VPC connector para falar com o banco e os endpoints. O [README da infra](https://github.com/gabe-santana/sightline/blob/main/infra/README.md) documenta essa topologia de rede.

## Ingestão: três etapas, zero polling

<div id="sightline-ingestion-slot"></div>

O Amazon Transcribe é assíncrono. Uma gravação longa leva minutos, tempo demais para segurar uma Lambda esperando. Por isso o pipeline é uma cadeia de **três etapas no EventBridge**, e o `transcriber-job` cuida de duas delas. O mesmo handler recebe os dois eventos "Object Created" do S3, e o prefixo da chave decide qual metade do trabalho fazer. Do [`transcriber-job/handler.py`](https://github.com/gabe-santana/sightline/blob/main/src/transcriber-job/handler.py#L309-L321):

```python title="src/transcriber-job/handler.py"
def handler(event: dict, context) -> None:
    if config.TRANSCRIBE_ENDPOINT:
        return _handle_local_mock(event)

    detail = event["detail"]
    s3_key = detail["object"]["key"]

    if s3_key.startswith(config.TRANSCRIBE_OUTPUT_PREFIX):
        process_transcription_result(s3_key)
    else:
        video_id = parse_video_id(s3_key)
        db.ensure_video(video_id, s3_key)
        start_transcription(video_id, s3_key)
```

A primeira etapa inicia um job do Transcribe com identificação de falantes e retorna na hora. O nome do job deriva do `video_id`, `sightline-{video_id}`, o que torna inofensiva a reentrega de um evento de upload: o Transcribe responde com `ConflictException` em vez de transcrever (e cobrar) o mesmo vídeo duas vezes. Quando o Transcribe grava o resultado em `transcribe-output/`, a segunda etapa lê o arquivo, agrupa a saída palavra por palavra em segmentos que quebram em pontuação de fim de frase, na troca de falante ou num limite de 40 itens, salva tudo no RDS e publica um evento `transcript_ready`. A terceira etapa, o `embedding-job`, é invocada por esse evento com o `video_id` exato a processar. Ela nunca varre uma tabela procurando trabalho: um evento, um vídeo.

Cada etapa tem sua regra, sua política de retry e sua dead-letter queue. Do [`eventbridge.tf`](https://github.com/gabe-santana/sightline/blob/main/infra/eventbridge.tf):

```hcl title="infra/eventbridge.tf"
retry_policy {
  maximum_retry_attempts       = 3
  maximum_event_age_in_seconds = 3600
}

dead_letter_config {
  arn = aws_sqs_queue.video_uploaded_dlq.arn
}
```

Um erro de throttling do Transcribe repete a primeira etapa sem mexer nos embeddings de vídeos que já estão mais adiante, e um evento envenenado vai parar numa fila que alguém pode inspecionar, em vez de sumir. As colunas `transcript_status` e `embedding_status` no RDS deixam a posição de cada vídeo no pipeline consultável, a base para relatórios de SLA e alertas de job travado.

### Só o áudio viaja

O pipeline aceita os formatos que os times de compliance realmente gravam, MKV incluído. Antes de transcrever, o [`_normalize_for_transcribe`](https://github.com/gabe-santana/sightline/blob/main/src/transcriber-job/handler.py#L111-L153) roda o ffmpeg direto contra uma **URL GET pré-assinada** do vídeo, sem baixá-lo, descarta a trilha de vídeo (`-vn`) e envia só o áudio AAC extraído. Uma gravação de vários gigabytes vira um arquivo de áudio pequeno, e só ele passa pelo `/tmp` da Lambda. O timeout do ffmpeg (780 s) fica abaixo dos 840 s da própria função, então um arquivo problemático falha de forma limpa e cai no retry. Uma regra de ciclo de vida no [`s3.tf`](https://github.com/gabe-santana/sightline/blob/main/infra/s3.tf) apaga esses arquivos normalizados depois de 7 dias, porque ninguém os lê duas vezes.

As Lambdas rodam em arm64, e o build no [`lambda.tf`](https://github.com/gabe-santana/sightline/blob/main/infra/lambda.tf) monta o pacote sem Docker nem Lambda layer: `pip install --platform manylinux2014_aarch64 --only-binary=:all:` baixa wheels já compiladas para o destino, inclusive o `psycopg2-binary` e um ffmpeg estático pelo wheel `imageio-ffmpeg`. O zip é publicado a partir de um objeto no S3 e o Terraform atualiza o código da função sempre que o hash do pacote muda.

## A citação que o modelo não consegue inventar

<div id="sightline-query-slot"></div>

A rota de consulta é onde o requisito de auditoria vira código. A pergunta vira embedding com o Titan Text Embeddings V2 (1024 dimensões), e o S3 Vectors devolve os cinco segmentos de transcrição mais próximos. O Claude, no Bedrock, recebe esses trechos numerados e uma tarefa estreita: dizer **quais índices** realmente sustentam uma resposta e escrever uma afirmação de uma frase para cada um. Ele nunca é perguntado sobre ID de vídeo ou timestamp. Do [`app/api/query/route.ts`](https://github.com/gabe-santana/sightline/blob/main/src/app-service/app/api/query/route.ts#L111-L124):

```ts title="src/app-service/app/api/query/route.ts"
const plan = await synthesizePlan(question, evidence);
findings = plan.relevant_indices
  .filter((i) => Number.isInteger(i) && i >= 0 && i < evidence.length)
  .map((i) => ({
    video_id: evidence[i].video_id,
    timestamp_s: evidence[i].timestamp_s,
    claim: plan.claims[String(i)] ?? evidence[i].text,
    confidence: Math.max(0, Math.min(1, evidence[i].score)),
    source: "transcript" as const,
  }));
```

A saída do modelo é tratada como um conjunto de ponteiros para evidências que o código já tem em mãos. Índices fora do intervalo são descartados, então o modelo não consegue citar um trecho que não existe. `video_id` e `timestamp_s` são copiados do resultado da busca vetorial, então uma citação alucinada não tem caminho até a resposta. A confiança é o score da busca limitado entre 0 e 1, não um número inventado pelo modelo. Se o modelo responde algo que não é o JSON esperado, a rota tenta mais uma vez com uma instrução corretiva e depois falha com um erro tipado. E quando a busca não encontra nada, o modelo nem é chamado: `findings: []` é uma resposta válida e honesta, e ninguém recebe um palpite de baixa confiança fantasiado de resultado.

Antes de qualquer coisa sair da API, a resposta é validada com Ajv contra o [schema compartilhado](https://github.com/gabe-santana/sightline/blob/main/packages/schemas/compliance-query-response.schema.json). Ele é estrito de propósito: `additionalProperties: false` em todos os níveis, para o modelo não conseguir enfiar um campo de "explicação" junto dos dados. O `source` é um enum, hoje com o valor `transcript`, para que novas fontes de evidência entrem sem mudar o formato dos dados existentes. Uma resposta que falha na validação vira um 502, não um "melhor esforço".

O único texto que o modelo escreve é o `claim`: uma frase curta, restrita a um trecho, exibida ao lado do timestamp que o analista confere em segundos. A estrutura garante a citação, e a pessoa confere o resumo.

## Custo: pagar pelo que foi processado

O pedido colocou a régua em centavos por vídeo de duas horas, então todo custo por vídeo é função da duração do áudio e do volume de transcrição. O Transcribe cobra por segundo de áudio, e como só o áudio é enviado, o tamanho do arquivo de vídeo não pesa. Os embeddings escalam com o número de segmentos, então uma gravação quase toda em silêncio custa menos que uma cheia de discussão.

O índice vetorial é o **Amazon S3 Vectors**, que cobra por vetor armazenado e por consulta, sem cluster ocioso de madrugada. Ele suporta filtro de metadados e tem interface endpoint próprio, o que mantém o desenho sem NAT. A definição do índice no [`s3vectors.tf`](https://github.com/gabe-santana/sightline/blob/main/infra/s3vectors.tf) usa distância de cosseno e marca o texto do segmento como metadado não filtrável, para ele acompanhar o vetor sem inchar o índice filtrável.

O que é fixo fica pequeno: uma instância RDS enxuta, o App Runner e os VPC endpoints. Nenhum serviço fica ligado esperando vídeo, e os vídeos originais descem para Infrequent Access depois de 90 dias e para Glacier depois de um ano, conforme o ciclo de vida do bucket.

## O que o projeto diz sobre o meu jeito de trabalhar

O Sightline é o tipo de sistema que eu gosto de construir. O requisito que mais importa, a auditabilidade, é garantido pela estrutura e não pelo prompt: o modelo escolhe entre evidências, e o código escreve as citações. A rede impede o que o código não deveria fazer, cada etapa do pipeline falha e se recupera sozinha, e o custo acompanha o volume de vídeo. **Quando a garantia está na arquitetura, ninguém precisa confiar no modelo para confiar na resposta.**

<div class="project-repo-card">
  <p class="project-repo-label">Projeto open source</p>
  <div class="project-repo-title">Sightline</div>
  <p>Explore o Terraform, os jobs Lambda, a rota de consulta e os documentos de design no repositório.</p>
  <a href="https://github.com/gabe-santana/sightline" target="_blank" rel="noopener noreferrer">Ver o código no GitHub <span aria-hidden="true">↗</span></a>
</div>
