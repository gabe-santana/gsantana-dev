---
title: "Sightline: transformando horas de vídeo em respostas auditáveis na AWS"
description: "Como construí um pipeline orientado a eventos na AWS que transcreve, indexa e consulta vídeos longos, e por que o modelo nunca escreve as próprias citações."
date: "2026-09-27"
tags: [Software Architecture, AI Agents, RAG, AWS, Terraform]
tldr:
  - "O Sightline responde perguntas de compliance sobre vídeos gravados com JSON validado por schema: cada finding traz o ID do vídeo, o timestamp e um score de confiança."
  - "A ingestão são três etapas no EventBridge, cada uma com política de retry e dead-letter queue própria; a rota de consulta nunca deixa o modelo informar ID de vídeo ou timestamp."
  - "O pipeline de transcrição roda em recursos reais da AWS; autenticação, o loop de agente em várias etapas, reprocessamento idempotente e análise visual são a lista honesta do que falta."
---

Times de compliance no mercado financeiro gravam tudo: sessões de assessoria, teleconferências de resultados, treinamentos. Depois alguém precisa assistir. O pedido que deu origem ao [Sightline](https://github.com/gabe-santana/sightline) veio exatamente dessa dor: mais de 3.000 horas de vídeo por mês, revisão manual custando mais de um milhão e meio de dólares por ano, ciclos que levam semanas e violações que mesmo assim passam. O cliente queria três coisas que costumam brigar entre si: **centavos por vídeo de duas horas**, respostas para perguntas como *"encontre todas as vezes em que um assessor falou de criptoativos não aprovados e me dê os timestamps"* e **uma saída que sobreviva a uma auditoria**.

Esse último requisito definiu todo o resto. Um chatbot que responde em prosa fluente não serve para nada aqui. O analista de compliance precisa pular para o minuto 47 de uma gravação específica e ouvir a frase com os próprios ouvidos. Por isso o Sightline não devolve prosa. Ele devolve um documento JSON em que cada finding aponta para um `video_id` e um `timestamp_s`, e esses dois campos nunca vêm do modelo de linguagem.

Este texto segue o código: o que roda, por que tem esse formato e o que eu ainda exigiria antes de deixar um time de compliance de verdade depender dele.

## A arquitetura em uma tela

<div id="sightline-system-slot"></div>

O desenho original tinha cinco VPCs, uma por responsabilidade: entrada, app, jobs, IA e armazenamento. O [Terraform](https://github.com/gabe-santana/sightline/tree/main/infra) cria **uma VPC com subnets privadas em camadas** no lugar delas. Cinco VPCs exigiriam uma malha de peering ou um Transit Gateway só para o app alcançar o armazenamento e os jobs alcançarem a IA: custo e infraestrutura de verdade para um isolamento que security groups já entregam dentro de um único workload. O isolamento que o diagrama defendia continua lá: os [security groups](https://github.com/gabe-santana/sightline/blob/main/infra/security_groups.tf) só liberam saída para o Postgres na porta 5432, para os VPC endpoints na 443 e para o S3 pela prefix list do gateway. Nada além disso.

Também **não existe NAT gateway**. Todo serviço da AWS de que a camada de computação precisa (Bedrock, Transcribe, EventBridge, Secrets Manager, S3 Vectors) é acessado por um interface endpoint, e o S3 por um gateway endpoint, tudo declarado no [`vpc.tf`](https://github.com/gabe-santana/sightline/blob/main/infra/vpc.tf). Uma Lambda dentro dessa VPC não alcança a internet aberta nem se o código quisesse. Com conteúdo regulado, prefiro essa garantia imposta pela rede a uma promessa feita pelo código.

A entrada passou por três versões, e a última é a menos intuitiva. O `app-service`, um app Next.js que serve tanto a interface do analista quanto a API de consulta, roda no **AWS App Runner, acessível publicamente no próprio domínio**, sem gateway nem load balancer na frente. A primeira versão mantinha o App Runner privado atrás de API Gateway, VPC Link e VPC Ingress Connection. Funcionava, mas era muita engrenagem para chegar em um único backend. A segunda ideia foi um Application Load Balancer, que parecia o encaixe natural para um app web. Não funciona: o endpoint de entrada privada do App Runner é compartilhado e roteia pelo header `Host`, e um ALB consegue rotear *com base* no `Host`, mas não consegue *reescrevê-lo*. A opção correta mais simples foi deixar o App Runner, que já faz balanceamento e autoscaling atrás do próprio domínio, ser o único recurso exposto à internet. O [README da infra](https://github.com/gabe-santana/sightline/blob/main/infra/README.md) registra o raciocínio completo, inclusive o tradeoff.

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

Um erro de throttling do Transcribe repete a primeira etapa sem mexer nos embeddings de vídeos que já estão mais adiante, e um evento envenenado vai parar numa fila que alguém pode inspecionar, em vez de sumir. As colunas `transcript_status` e `embedding_status` no RDS deixam a posição de cada vídeo no pipeline consultável, e é isso que torna possíveis, depois, os relatórios de SLA e os alertas de job travado.

### Os detalhes que só aparecem no deploy

Dois problemas nunca aparecem num diagrama. O primeiro: o Transcribe não aceita MKV, um dos formatos do pedido. A solução em [`_normalize_for_transcribe`](https://github.com/gabe-santana/sightline/blob/main/src/transcriber-job/handler.py#L111-L153) roda o ffmpeg contra uma **URL GET pré-assinada** em vez de baixar o vídeo, descarta a trilha de vídeo por completo (`-vn`) e envia só o áudio AAC extraído. Apenas o arquivo de áudio, bem menor, passa pelo `/tmp` da Lambda, e o timeout do ffmpeg (780 s) deixa folga abaixo dos 840 s da própria função. Uma regra de ciclo de vida no [`s3.tf`](https://github.com/gabe-santana/sightline/blob/main/infra/s3.tf) apaga esses arquivos normalizados depois de 7 dias, porque ninguém os lê duas vezes.

O segundo é o empacotamento. O `psycopg2-binary` tem uma extensão nativa que precisa bater com o Amazon Linux da Lambda em arm64. Compilar sob QEMU numa máquina de desenvolvimento gerou um binário com ABI incompatível (`undefined symbol: _PyInterpreterState_Get` no import). O build no [`lambda.tf`](https://github.com/gabe-santana/sightline/blob/main/infra/lambda.tf) pula a compilação: `pip install --platform manylinux2014_aarch64 --only-binary=:all:` baixa um wheel já compilado para o destino. O mesmo truque embute um ffmpeg estático pelo wheel `imageio-ffmpeg`, sem Docker e sem Lambda layer. Isso levou o zip a uns 44 MB, perto do limite de 50 MB para upload direto, então as duas funções passaram a ser publicadas a partir de um objeto no S3. E como um zip gerado no Windows nem sempre preserva o bit de execução do Unix, o handler copia o binário do ffmpeg para o `/tmp` e aplica `chmod 755` ali, uma vez por cold start. Nada disso é arquitetura no sentido de slide. Tudo isso decide se a arquitetura roda.

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

Antes de qualquer coisa sair da API, a resposta é validada com Ajv contra o [schema compartilhado](https://github.com/gabe-santana/sightline/blob/main/packages/schemas/compliance-query-response.schema.json). Ele é estrito de propósito: `additionalProperties: false` em todos os níveis, para o modelo não conseguir enfiar um campo de "explicação" junto dos dados. O `source` é um enum com um único valor hoje, `transcript`, mantido como enum para que uma fonte `visual_frame` possa chegar depois sem mudar o formato dos dados existentes. Uma resposta que falha na validação vira um 502, não um "melhor esforço".

Uma coisa que isso **não** garante: o texto do `claim` continua sendo escrito pelo modelo. Ele é curto, restrito a um trecho e fica ao lado de um timestamp que o analista confere em segundos, mas é texto gerado. Por isso a [estratégia de avaliação](https://github.com/gabe-santana/sightline/blob/main/docs/evaluation-strategy.md) avalia os claims contra um golden set anotado por especialistas, com LLM-as-judge e amostragem de auditoria humana, em vez de confiar neles.

## Custo: o que escala e o que não escala

O pedido colocou a régua em centavos por vídeo de duas horas, então todo custo por vídeo aqui é função da duração do áudio e do volume de transcrição. O Transcribe cobra por segundo de áudio. Os embeddings escalam com o número de segmentos, então uma gravação quase toda em silêncio custa menos que uma cheia de discussão. O S3 Vectors cobra por vetor armazenado e por consulta, sem cluster ocioso de madrugada.

Essa última escolha substituiu o domínio OpenSearch do desenho original, e não a fiz só lendo documentação. Antes de decidir, rodei de verdade `create-vector-bucket`, `create-index`, `put-vectors` e `query-vectors` na conta, **com filtro de metadados**, confirmei que existe interface endpoint do S3 Vectors para manter o desenho sem NAT e subi o provider da AWS para a versão 6.x depois de revisar o guia de upgrade contra cada recurso da stack. A definição do índice no [`s3vectors.tf`](https://github.com/gabe-santana/sightline/blob/main/infra/s3vectors.tf) usa distância de cosseno e marca o texto do segmento como metadado não filtrável, para ele acompanhar o vetor sem inchar o índice filtrável.

A parte honesta do modelo de custo é o piso fixo. O ambiente de desenvolvimento custa algo como **US$ 70 a US$ 100 por mês antes de qualquer tráfego**: uma instância RDS pequena em uma única AZ, o App Runner e, principalmente, os interface endpoints, que custam o mesmo com zero vídeos ou com três mil horas. Tirar o OpenSearch e o gateway da frente do App Runner cortou as maiores linhas fixas. Os vídeos originais descem para Infrequent Access depois de 90 dias e para Glacier depois de um ano.

## O que o projeto prova e o que eu exigiria antes de produção

Os dois jobs Lambda são código real chamando Transcribe, Bedrock e S3 Vectors via boto3, publicados pelo Terraform numa conta real da AWS. A rota de consulta também é código real, mas a imagem do container ainda não foi enviada ao ECR, então o App Runner continua rodando a imagem de bootstrap da AWS. A stack local com Docker Compose (LocalStack, Postgres, OpenSearch e pequenos mocks de Transcribe e Bedrock) cobre só a ingestão e não foi revalidada desde que o pipeline passou a ser orientado a eventos. Se isso virasse um sistema do qual um time de compliance depende, estas seriam minhas primeiras decisões, em ordem de risco:

1. **Colocar autenticação na frente de tudo.** O endpoint do App Runner é público e as rotas não autenticam ninguém: hoje, quem tiver a URL consegue pedir uma URL de upload pré-assinada ou consultar o acervo. Identidade do analista (SSO via Cognito ou o IdP da empresa), autorização por time sobre os vídeos e um log de auditoria de quem perguntou o quê vêm antes de qualquer outra funcionalidade.
2. **Tornar o reprocessamento idempotente de ponta a ponta.** A etapa de upload está protegida pelo nome determinístico do job. A segunda etapa não: um evento `transcribe-output` reentregue roda o parsing de novo e, como os IDs de segmento são `uuid4` aleatórios, insere linhas duplicadas e grava vetores extras. IDs de segmento determinísticos (um `uuid5` do ID do vídeo com a posição do segmento) e um delete-and-insert na mesma transação resolveriam. Além disso, nada no caminho de produção marca um vídeo como `failed`: quando os retries acabam, o evento vai para a DLQ e o status fica `transcribing` para sempre. Um consumidor da DLQ ou um alarme precisa ser dono dessa transição.
3. **Construir o loop de agente que a documentação descreve.** A rota faz uma única passada de busca e síntese. O [documento de orquestração](https://github.com/gabe-santana/sightline/blob/main/docs/agent-orchestration.md) especifica um loop limitado com as ferramentas `get_video_metadata` e `get_transcript_window`, orçamento de passos e timeout. Isso importa mais do que parece: os metadados dos vetores só guardam `video_id`, `timestamp_s` e o texto, então *"no segundo trimestre"* não tem como ser filtrado hoje. As datas de gravação precisam chegar ao índice. E o `evidence_complete` deveria ser calculado pelo código a partir do orçamento, não autodeclarado pelo modelo como acontece agora.
4. **Adicionar os circuit breakers e os alarmes.** O documento de confiabilidade prevê circuit breakers por dependência. O que o código dos jobs usa hoje são os retries do EventBridge e as dead-letter queues. Breakers em volta do Bedrock e do Transcribe, mais alarmes de profundidade das DLQs e de vídeos parados num status, transformam um incidente numa dependência em um alerta, em vez de uma fila crescendo em silêncio.
5. **Sair dos padrões de desenvolvimento.** Publicar a imagem real, mover o state do Terraform para um backend remoto com lock, ligar Multi-AZ no RDS, trocar a criação de schema no cold start por migrações versionadas e colocar o RDS Proxy na frente do Postgres antes que a concorrência abra uma conexão por invocação.
6. **Lidar com o que o formato atual não comporta.** O teto de 15 minutos da Lambda limita o tamanho da gravação que a etapa de normalização consegue processar: as mais longas pedem Step Functions ou MediaConvert, não um timeout maior. O idioma está fixo em `en-US`, quando a identificação de idioma do Transcribe resolveria. E a metade visual do pedido, amostragem de frames e resumo do que aparece na tela, não foi construída. É uma lacuna deliberada e documentada, mas é uma lacuna.
7. **Provar a precisão antes de anunciá-la.** A estratégia de avaliação prioriza recall (uma violação perdida é justamente a falha que o sistema existe para evitar), mede a precisão do timestamp em segundos e verifica a calibração da confiança. O golden dataset precisa existir antes de alguém citar um número. Até lá, o score da busca é uma similaridade, não uma probabilidade.

## O que o projeto diz sobre o meu jeito de trabalhar

O Sightline é o tipo de sistema que eu gosto de construir: o requisito que mais importa (auditabilidade) é garantido pela estrutura, não pelo prompt, as decisões de infraestrutura foram testadas numa conta real antes de virar documentação e a documentação separa o que existe do que está planejado. A lista acima é longa de propósito. **Saber exatamente onde um sistema deixa de ser confiável faz parte de projetá-lo.**

<div class="project-repo-card">
  <p class="project-repo-label">Projeto open source</p>
  <div class="project-repo-title">Sightline</div>
  <p>Explore o Terraform, os jobs Lambda, a rota de consulta e os documentos de design no repositório.</p>
  <a href="https://github.com/gabe-santana/sightline" target="_blank" rel="noopener noreferrer">Ver o código no GitHub <span aria-hidden="true">↗</span></a>
</div>
