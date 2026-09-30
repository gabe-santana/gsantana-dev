---
title: "Vectorless RAG posto à prova: PageIndex vs RAG vetorial no FinanceBench"
description: "O PageIndex troca o banco vetorial por uma árvore do documento e um agente LLM que a navega. Comparei com dois pipelines de RAG vetorial no FinanceBench: respostas melhores, 40 vezes o custo."
date: 2026-09-30
tags: [RAG, LLMs, Evaluation, Python]
tldr:
  - "Em 46 perguntas do FinanceBench sobre 11 relatórios, com o mesmo modelo de resposta (gpt-4.1) em todos os sistemas, o PageIndex acertou 87,0%, contra 80,4% do RAG vetorial denso e 78,3% do RAG híbrido com reranker. Ele nunca errou uma pergunta que os pipelines de RAG acertaram, mas com 46 perguntas a diferença não é estatisticamente significativa."
  - "Custou 40 vezes mais por pergunta (US$ 0,33 contra US$ 0,008) e leu 50 vezes mais tokens (165 mil contra 3,3 mil), porque o agente reenvia a árvore do documento a cada turno. A indexação foi barata: cerca de US$ 2 por 2.690 páginas."
  - "Vectorless não quer dizer sem retrieval: o PageIndex leu a página da evidência de referência menos vezes (63%) que o RAG híbrido (78%). A vantagem dele é navegar até a tabela certa, a capa, o balanço patrimonial, onde a busca por similaridade encontra texto que fala sobre a resposta em vez da própria resposta."
---

No FinanceBench, um benchmark de perguntas sobre relatórios reais entregues à SEC, o README do PageIndex mostra um gráfico de barras: 98,7% de acurácia para o PageIndex, cerca de 50% para RAG vetorial. O PageIndex se apresenta como "vectorless RAG": sem embeddings, sem chunks, sem banco vetorial, só uma árvore do documento e um LLM que raciocina para percorrê-la, do jeito que um analista vai direto à seção certa de um 10-K. O repositório está nas listas de trending do GitHub, e a pergunta que todo time com banco vetorial está se fazendo é a óbvia: devemos jogar o nosso fora?

Eu não quis responder isso a partir de um gráfico de barras. Então montei um benchmark em que o PageIndex e dois pipelines de RAG vetorial, um ingênuo e um ajustado, respondem às mesmas perguntas do FinanceBench a partir do mesmo texto de página com o mesmo modelo, e medi acurácia, se cada sistema de fato leu a página onde está a resposta, tokens, custo e tempo. O código, as árvores, cada resposta e cada veredito são públicos. Este post é o que saiu disso, incluindo as partes que me surpreenderam.

## O problema e o contexto

### O que o RAG vetorial faz com um 10-K

Um 10-K é o pior caso para retrieval por chunk e embedding, e vale a pena ser preciso sobre o porquê. O retriever corta o relatório em chunks de algumas centenas de palavras, gera o embedding de cada um, gera o embedding da pergunta e entrega ao modelo os chunks cujos vetores ficam mais perto do vetor da pergunta. Esse pipeline faz três apostas, e um relatório financeiro quebra as três.

A primeira aposta é que a resposta se parece com a pergunta. "Qual é o valor de capital expenditure da 3M no FY2018?" é respondida por uma linha da demonstração de fluxo de caixa que diz "Purchases of property, plant and equipment (PP&E) (1,577)". As palavras "capital expenditure" não aparecem em nenhum lugar dessa linha. A busca por similaridade encontra os parágrafos que *falam sobre* gastos de capital, os comentários da MD&A e o outlook, e esses parágrafos são parecidos com a pergunta e inúteis para respondê-la. O README do PageIndex resume em quatro palavras: similaridade não é relevância.

A segunda aposta é que um chunk carrega o próprio contexto. Uma linha de tabela recortada de um balanço patrimonial perdeu o cabeçalho, os anos das colunas e o "in millions" no canto. O chunk diz "(1,577) (1,373) (1,420)" e nada diz ao modelo qual número pertence a qual ano.

A terceira aposta é que a resposta mora num lugar só. Relatórios são cheios de referências cruzadas: "see Note 12", "as described in Item 7". Um analista humano segue essas referências. Um retriever top-k não consegue: ele tem uma única chance, com as palavras da pergunta, e o que a primeira busca deixou passar está perdido.

Nada disso é novo. O [artigo do FinanceBench](https://arxiv.org/abs/2311.11944) (Islam et al., 2023) montou 10.231 perguntas sobre relatórios públicos, avaliou 16 configurações à mão numa amostra de 150 perguntas e relatou que o GPT-4-Turbo com um sistema de retrieval respondeu errado ou se recusou a responder 81% das perguntas. As respostas de sempre são chunking melhor ([chunks pai e filho](/pt-br/blog/chunking-enterprise-documents/)), [busca híbrida com reranker](/pt-br/blog/hybrid-search-bm25-vectors-rrf/), filtros de metadados. Todas mantêm o mesmo formato: escolher chunks por similaridade, uma vez.

### O que o PageIndex faz no lugar

O [PageIndex](https://github.com/VectifyAI/PageIndex), da Vectify AI, joga esse formato fora. Não há chunks, nem embeddings, nem banco vetorial. Ele constrói uma **árvore** do documento, o sumário que um humano gostaria de ter, em que cada nó tem um título, o intervalo de páginas que cobre e um resumo curto, e na hora da consulta entrega a um agente LLM duas ferramentas: uma que devolve a árvore e outra que devolve o texto de um intervalo de páginas. O agente lê o sumário, decide qual seção deve conter a resposta, lê aquelas páginas e decide se já tem o suficiente ou se deve procurar em outro lugar. Os autores dizem que a ideia vem do AlphaGo (busca em árvore guiada pelo julgamento de um modelo); a descrição mais simples é que ele lê um relatório como um analista lê, do sumário para dentro.

<div id="pageindex-vs-rag-pipelines-slot"></div>

A promessa é forte. O README do PageIndex relata que o Mafin 2.5, o produto de QA financeiro da Vectify construído sobre o PageIndex, chegou a **98,7% de acurácia no FinanceBench**, contra um baseline de RAG vetorial perto de 50%.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>98,7% contra 50%? Então os bancos vetoriais morreram. Vou apagar nosso cluster do Qdrant na segunda-feira.</span>
    </div>
  </div>
</div>

Leia o que o número mede antes de apagar qualquer coisa. Os 98,7% pertencem ao [Mafin 2.5](https://github.com/VectifyAI/Mafin2.5-FinanceBench), um produto: um sistema de QA financeiro construído sobre o PageIndex, rodando com GPT-4o e DeepSeek-V3, com todos os documentos numa única base, e avaliado com anotações de especialistas humanos nas perguntas que os autores consideraram ambíguas ou inválidas. Ele mostra que um sistema bem construído sobre modelos de fronteira consegue quase resolver o FinanceBench. Ele não diz o que você ganha com `pip install pageindex` e o modelo que cabe no seu orçamento, e compara contra um baseline cuja configuração você não consegue inspecionar. Essa lacuna é o motivo deste post.

## Mergulho na arquitetura

Tudo daqui para baixo vem da leitura do código-fonte do SDK (`pageindex` 0.2.20 no PyPI), não da página de marketing, porque são os detalhes que decidem onde ele ganha e onde ele quebra.

### Construindo a árvore

A indexação no modo local acontece em três passadas, e só duas delas usam um LLM.

**1. O sumário, só pelo layout.** O indexador padrão é o PageIndex Flash. Ele faz o parsing do PDF no nível de caractere com o pdfium e encontra os títulos estatisticamente: tamanho e peso da fonte comparados com o corpo do texto, padrões de numeração ("Note 12.", "Item 7A"), cabeçalhos e rodapés repetidos para ignorar, boilerplate de sumário. Se o PDF tem bookmarks embutidos que parecem confiáveis, ele usa esses bookmarks. Nenhum modelo entra aqui, então essa passada leva segundos até para um relatório de 500 páginas. Cada nó ganha um título, uma página inicial e uma página final, e toda página pertence a algum nó: o que vem antes do primeiro título detectado vira um "Preface".

**2. Otimização, com preço em páginas.** O sumário cru raramente é a árvore que você quer navegar. O otimizador mede um nó pelo pior número de páginas que um agente teria que varrer para achar algo dentro dele. Um nó é *expandido* quando rotear pelos filhos propostos sairia mais barato do que varrer o nó inteiro: o modelo recebe as páginas do nó (até 6.000 caracteres cada) e propõe subseções, e uma proposta só vale se o título dela estiver de fato impresso na página que ela indica. Uma subárvore é *mesclada* de volta no pai quando rotear por ela custa mais do que simplesmente lê-la; os títulos mesclados sobrevivem no pai como `key_items`, então as palavras continuam ajudando no roteamento. A mesclagem é determinística. A expansão precisa do modelo de indexação e, num nó grande, manda um prompt grande: num dos 10-Ks, uma única chamada de expansão precisou de 120 mil tokens.

**3. Resumos.** Todo nó ganha um resumo de no máximo 150 palavras, escrito pelo modelo de indexação. Folhas curtas (menos de 200 tokens) ficam com o próprio texto, e um pai é resumido a partir dos resumos dos filhos mais até três das suas próprias páginas de introdução.

O README diz que um modelo básico basta para indexar, e os números concordam: indexei os 18 relatórios, 2.690 páginas, com o `gpt-5.6-luna` por cerca de US$ 2 (2.586 chamadas ao modelo, 4,6 milhões de tokens de entrada), menos de US$ 0,001 por página, em linha com o número do próprio README.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Então o índice é só um sumário com resumos. O que tem de tão difícil nisso? Todo 10-K tem um na página 2.</span>
    </div>
  </div>
</div>

Tem, e é exatamente essa a armadilha. O sumário impresso é texto, não estrutura: "Note 5. Restructuring Actions 64" é uma linha de caracteres com um número no final, e o número é o rótulo impresso da página, não a página do PDF. O Flash nem lê esse sumário; ele olha para como os títulos são *desenhados*. Relatórios da SEC gerados a partir do HTML do EDGAR muitas vezes desenham os títulos de seção com a mesma fonte, o mesmo tamanho e o mesmo peso do corpo do texto, enquanto os anexos no final (contratos de concessão de ações, documentos de planos) têm títulos grandes e em negrito como "ARTICLE I". Nesses relatórios o detector de layout enxerga os anexos com clareza e o 10-K em si quase nada, e aí tudo depende do LLM do otimizador para recuperar a estrutura. Guarde isso: aparece nos resultados.

### Recuperando: um agente com duas ferramentas

Na hora da consulta não existe uma etapa de retrieval no sentido usual. O SDK roda um agente (sobre o OpenAI Agents SDK, com qualquer modelo do LiteLLM) cujas instruções e ferramentas espelham o servidor MCP em nuvem do PageIndex:

- `get_document_structure(doc_name, part)` devolve a árvore: títulos, ids dos nós, páginas iniciais, resumos. É paginado, porque a resposta de uma ferramenta tem limite de 100.000 caracteres.
- `get_page_content(doc_name, pages)` devolve o texto de uma especificação de páginas como `"5-7,12"`, com a instrução de manter os intervalos enxutos.

A regra do fluxo é simples: para documentos com mais de 20 páginas, leia a estrutura primeiro e depois puxe páginas específicas. O modelo faz o resto.

<div id="pageindex-agent-loop-slot"></div>

Duas consequências aparecem antes de qualquer benchmark rodar. Primeiro, toda pergunta paga pela leitura da árvore: num 10-K de 250 páginas com algumas centenas de nós, só a estrutura já são dezenas de milhares de tokens, reenviados a cada turno do loop. O RAG vetorial paga por oito chunks. Segundo, a qualidade do retrieval agora é a qualidade do raciocínio do modelo de chat, e é por isso que o README manda usar "o melhor modelo que você puder pagar" no chat. Um modelo fraco que escolhe a seção errada não ganha uma segunda chance independente, como acontece com um retriever mais um reranker: ganha mais um turno do mesmo julgamento.

## Implementação na prática

O benchmark é público: [gabe-santana/pageindex-vs-rag-benchmark](https://github.com/gabe-santana/pageindex-vs-rag-benchmark). Ele é pequeno de propósito, algumas centenas de linhas de Python, para que você possa ler cada decisão. Aqui estão as que importam.

### Os dados e os controles

O conjunto open source do FinanceBench tem 150 perguntas sobre 84 relatórios. Escolhi os 18 relatórios com pelo menos três perguntas cada (70 perguntas, 2.690 páginas, de um earnings release de 9 páginas ao 10-K de 503 páginas da PepsiCo) e indexei todos eles com os dois sistemas. A rodada tinha um orçamento fixo de US$ 20 no Azure AI Foundry, e o PageIndex gastou mais rápido do que eu estimei, então as respostas pararam depois de **46 perguntas sobre 11 relatórios** (1.797 páginas, da 3M à Johnson & Johnson em ordem alfabética). Os três sistemas responderam exatamente essas 46. A maioria é do tipo que um analista faz: "O que causou a variação da margem operacional?", "A 3M é intensiva em capital?", "O quick ratio melhorou?" (33 perguntas de domínio, 12 inéditas e uma única extração pura de métrica), e muitas exigem um cálculo.

<div id="pageindex-benchmark-harness-slot"></div>

Um benchmark assim só vale alguma coisa se os sistemas diferirem em uma única coisa. Então:

- **Mesmo texto de página.** O PageIndex guarda o texto de cada página como extraído pelo PyPDF2. Os pipelines de RAG fazem o chunking exatamente desse texto (`LocalAPI._extract_page_texts`), então ninguém ganha por ter um parser de PDF melhor.
- **Mesmo modelo de resposta, mesmas instruções.** Todo sistema responde com `gpt-4.1` e as mesmas instruções de analista (mostrar os insumos, arredondar como pedido, terminar com "Final answer:"), passadas ao PageIndex pelo argumento `instructions=`, que as anexa ao prompt do próprio agente do SDK.
- **Mesmo escopo.** Cada pergunta é feita contra o próprio relatório. O RAG busca só nos chunks daquele documento; o PageIndex recebe o id do documento. O cenário mais difícil do FinanceBench, o "shared store", com todos os relatórios num único índice, é outro experimento.
- **Indexação como recomendado.** O PageIndex constrói as árvores com o `gpt-5.6-luna`, o modelo básico que o README recomenda para essa tarefa. O RAG gera os embeddings com o `text-embedding-3-large`.

### Dois baselines de RAG vetorial, não um

Comparar contra um RAG ingênuo prova pouco, então são dois:

| | Chunks | Retrieval | Contexto |
|---|---|---|---|
| `rag-dense` | 300 palavras, 50 de sobreposição, nunca atravessando páginas | top 8 por cosseno | 8 chunks |
| `rag-hybrid` | igual | top 40 denso + top 40 BM25, [reciprocal rank fusion](/pt-br/blog/hybrid-search-bm25-vectors-rrf/), rerank com cross-encoder (Qwen3-Reranker-0.6B) | 8 chunks |

Os chunks nunca atravessam o limite de uma página, então todo chunk tem exatamente um número de página, e cada chunk ganha o embedding com o nome do relatório e a página na frente ("PEPSICO_2022_10K, page 61: ..."), de modo que até uma linha de tabela solta ainda diz a qual empresa pertence.

```python title="bench/rag.py"
def chunk_pages(pages: list[str]) -> list[Chunk]:
    """Word windows that never cross a page, so every chunk has one page."""
    out = []
    step = CHUNK_WORDS - CHUNK_OVERLAP_WORDS
    for number, text in enumerate(pages, start=1):
        words = text.split()
        if not words:
            continue
        for start in range(0, max(len(words) - CHUNK_OVERLAP_WORDS, 1), step):
            out.append(Chunk(number, " ".join(words[start:start + CHUNK_WORDS])))
    return out
```

O retriever híbrido é o mesmo do post de busca híbrida, restrito a um documento:

```python title="bench/rag.py"
def retrieve(self, query: str, mode: str) -> list[int]:
    if mode == "dense":
        return self.dense(query, TOP_K)
    # Reciprocal rank fusion of both lists, then a cross-encoder decides.
    fused: dict[int, float] = {}
    for ranking in (self.dense(query, CANDIDATES),
                    self.lexical(query, CANDIDATES)):
        for rank, i in enumerate(ranking):
            fused[i] = fused.get(i, 0.0) + 1.0 / (60 + rank)
    pool = sorted(fused, key=fused.get, reverse=True)[:CANDIDATES]
    scores = rerank(query, [self.chunks[i].text for i in pool])
    order = sorted(range(len(pool)), key=lambda j: scores[j], reverse=True)
    return [pool[j] for j in order[:TOP_K]]
```

### Observando o PageIndex trabalhar

O PageIndex roda pelo próprio SDK, sem alterações. O que o harness adiciona é visibilidade: `client.chat(..., stream=True).events` emite cada chamada de ferramenta com seus argumentos, então o runner registra quais páginas o agente pediu.

```python title="bench/run.py"
stream = client.chat(q.question, doc_id=did, stream=True, max_turns=20)
for ev in stream.events:
    if ev["type"] == "answer":
        answer.append(ev["delta"])
    elif ev["type"] == "tool_call":
        args = ev.get("arguments")
        trace.append({"tool": ev["name"], "arguments": args})
        if ev["name"] == "get_page_content" and isinstance(args, dict):
            pages.update(expand_pages(args.get("pages", "")))
```

Isso habilita a métrica em que eu mais confio neste benchmark. O FinanceBench registra a página de onde veio cada evidência, então para cada resposta eu posso fazer uma pergunta que nenhum juiz consegue deixar ambígua: **o sistema chegou a ler a página da evidência de referência?** Para os pipelines de RAG, "ler" significa que um dos oito chunks veio daquela página; para o PageIndex, que o agente a buscou com `get_page_content`. Um sistema ainda pode acertar sem ela (o mesmo número costuma aparecer na MD&A e nas demonstrações) ou lê-la e mesmo assim errar, mas ao longo de dezenas de perguntas a taxa diz muito sobre o retrieval.

### Avaliação

As respostas são avaliadas contra a resposta de referência do FinanceBench por um juiz LLM (`gpt-5.6-luna`, um modelo diferente do que escreveu as respostas), com tolerância de 1% em números e regras explícitas para unidades e sinais. O juiz nunca vê qual sistema escreveu a resposta. Depois, cada veredito foi revisado um a um contra a resposta de referência e o relatório, e 6 dos 138 foram corrigidos; os vereditos revisados estão no repositório ao lado dos do juiz, cada um com uma nota. Com [juízes LLM](/pt-br/blog/llm-as-judge-calibration/), a revisão não é opcional: no FinanceBench, muitas respostas de referência são frases ("Não, a empresa está gerenciando seu CAPEX...") e um juiz precisa decidir se "a 3M é intensiva em capital" contradiz essas frases.

## Os resultados

### A tabela principal

| | PageIndex | rag-dense | rag-hybrid |
|---|---|---|---|
| **Respostas corretas** | **40 / 46 (87,0%)** | 37 / 46 (80,4%) | 36 / 46 (78,3%) |
| Disse "não está no documento" | 0 | 2 | 3 |
| Leu a página de referência | 63,0% | 71,7% | **78,3%** |
| Páginas distintas lidas por pergunta | 7,3 | 6,4 | 7,3 |
| Chamadas ao LLM por pergunta | 5,5 | 1 | 1 |
| Tokens de entrada por pergunta (média) | 165.476 | 3.299 | 3.400 |
| Custo por pergunta (média) | US$ 0,334 | US$ 0,008 | US$ 0,006 |
| Latência mediana | 11,4 s | 2,7 s | (veja abaixo) |

Os três sistemas responderam com `gpt-4.1` a preço de tabela (US$ 2 por milhão de tokens de entrada, US$ 8 por milhão de saída). A latência do pipeline híbrido não é comparável: o reranker rodou na GPU do meu notebook, oito requisições por vez, e a fila dominou o tempo. Um reranker hospedado adiciona algumas centenas de milissegundos.

O PageIndex ganha em acurácia, por três e quatro perguntas. Esse é o tamanho honesto da vantagem, então mais dois fatos precisam ficar ao lado das porcentagens:

- **Ele nunca perdeu uma pergunta que os outros ganharam.** Contra o RAG denso, o PageIndex acertou e o RAG errou em 3 perguntas, e o contrário aconteceu 0 vezes. Contra o híbrido, 4 e 0.
- **Com 46 perguntas, isso não é estatisticamente significativo.** Um teste exato de McNemar sobre essas discordâncias dá p = 0,25 contra o denso e p = 0,125 contra o híbrido. Uma direção consistente, não uma prova. E não chega nem perto dos 98,7% contra 50% do README: numa disputa justa, com o mesmo modelo e o mesmo texto, a diferença fica em um dígito.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Peraí. O PageIndex leu a página certa menos vezes que o RAG híbrido e mesmo assim acertou mais respostas? Não faz sentido.</span>
    </div>
  </div>
</div>

Faz sentido quando você olha o que "a página certa" significa num 10-K. O mesmo fato aparece impresso em vários lugares: um número da demonstração de resultados reaparece na MD&A, o crescimento de um segmento aparece na nota de segmentos e na discussão dos resultados. Os anotadores do FinanceBench registraram um desses lugares. O PageIndex acertou 13 vezes sem tocar na página registrada, porque navegou até outro lugar que diz a mesma coisa; o RAG híbrido fez isso só 4 vezes. A métrica de página mede um caminho até a resposta, e o PageIndex pega outros caminhos. Por essa métrica, o RAG híbrido é o melhor *retriever* deste benchmark, e mesmo assim converte retrieval em respostas pior: leu a página de referência e errou a resposta 4 vezes, e 3 vezes disse que o documento não tinha a resposta.

### Onde o PageIndex ganhou

As perguntas que o PageIndex acertou e pelo menos um pipeline de RAG errou são as linhas mais instrutivas da rodada, e elas têm algo em comum.

- **"Quais títulos de dívida estão registrados para negociação em uma bolsa de valores nacional em nome da 3M?"** A resposta é uma pequena tabela na capa do 10-Q: três séries de notes com seus códigos de negociação. O RAG denso disse que o documento não continha isso. A capa não *soa como* a pergunta; é uma grade de boilerplate jurídico. O agente, lendo a árvore, foi direto para a capa.
- **A mesma pergunta para a American Express.** A resposta é "nenhum", o que é mais difícil: você precisa achar a capa e perceber o que está faltando. O RAG denso disse que a informação não estava no documento, o que é uma afirmação diferente de "não há nenhum".
- **"O quick ratio da Amcor melhorou ou piorou entre o FY2023 e o FY2022?"** Os dois pipelines de RAG disseram "piorou". A referência é 0,67 para 0,69, melhorou. O quick ratio precisa de quatro linhas do balanço patrimonial em dois anos. Os chunks que mais se parecem com "quick ratio" são comentários sobre liquidez, não o balanço; o PageIndex leu o balanço.
- **"Qual era o maior passivo no balanço patrimonial da American Express?"** O RAG híbrido disse que não conseguia dizer. O PageIndex abriu o balanço: depósitos de clientes, US$ 110.239 milhões.

Esse é o argumento do "similaridade não é relevância", observado em vez de afirmado. Quando a resposta mora num lugar estruturado (uma capa, uma demonstração, uma tabela), o texto mais *parecido* com a pergunta é prosa que fala sobre a resposta, e a resposta em si não se parece com nada. Um agente que sabe onde ficam os balanços num 10-K não precisa que a resposta se pareça com a pergunta.

### Onde todo mundo perdeu

Seis perguntas derrotaram os três sistemas, e na maioria delas o problema não é retrieval:

- A margem bruta da Boeing (melhorou, de 4,8% para 5,3%) e o giro de estoque da AES (9,5 vezes): os três sistemas decidiram que a métrica "não é relevante" para uma empresa aeroespacial ou uma concessionária de energia e se recusaram a calculá-la. A pergunta convida a essa saída ("se a margem bruta não for uma métrica útil, diga isso"), e o modelo aceitou o convite. Mesmo modelo, mesmo erro, três vezes.
- A melhor categoria de produto da Best Buy no trimestre: os três disseram Computing and Mobile Phones, enquanto a resposta de referência é Entertainment, a categoria que mais cresceu (9%). Isso é uma discordância sobre o que "teve o melhor desempenho" significa, não sobre achar uma página.
- O quick ratio da 3M: o PageIndex e o RAG híbrido calcularam 0,85 contra uma referência de 0,96, uma discordância sobre quais ativos circulantes entram na conta.

Quando o gargalo é o modelo, um retrieval melhor não ajuda: os três pipelines herdam o mesmo julgamento.

### A árvore era pior do que parecia, e isso não importou muito

Lembra do aviso sobre layout? Depois da indexação, medi para cada relatório quanto dele a árvore de fato descreve: uma página é "cega" quando o menor nó que a cobre abrange mais de 20 páginas ou não tem resumo, então o agente não consegue saber o que há nela sem lê-la. Nas 2.690 páginas, 11,7% eram cegas. A maioria das árvores estava excelente, com menos de 3% de páginas cegas. Duas não: **o 10-K da Boeing estava 51% cego e o da American Express, 50%**, e 11 das 13 páginas de referência dos dois caíam nessas regiões cegas. A árvore da Boeing começa com um nó chamado "DOCUMENTS INCORPORATED BY REFERENCE" que engole a maior parte do 10-K, enquanto o plano de poupança dos executivos, nos anexos, ganhou um sumário limpo e detalhado.

E o PageIndex ainda acertou 13 das 14 perguntas da Boeing e da American Express (RAG denso: 12, híbrido: 11). Um modelo de chat capaz navega uma árvore ruim do jeito que você navega um relatório mal organizado: lê o único resumo genérico, chuta intervalos de páginas, lê e corrige a rota. Essa resiliência é real, e é paga em turnos. A pergunta mais cara da rodada, o quick ratio da AMD, levou 17 chamadas ao modelo e 791.423 tokens de entrada: US$ 1,59 por uma resposta (que, aliás, estava correta).

<div class="callout warning" data-title="Atenção">
  <p>O modelo de indexação precisa de um contexto longo. A etapa de expansão do otimizador manda as páginas de um nó inteiro num único prompt, 120 mil tokens para um nó de 131 páginas na minha rodada. Minha primeira tentativa rodou localmente no llama.cpp com contexto de 16 mil tokens por slot: essas chamadas falharam, o PageIndex absorveu os erros em silêncio e manteve o nó inteiro, e o 10-K da 3M saiu 75% cego. Com um modelo de contexto grande, o mesmo relatório ficou 2,8% cego. Se você indexar com um modelo local pequeno, confira as árvores antes de confiar nelas.</p>
</div>

## Checagem de realidade em produção

### A conta é por pergunta, não por documento

Indexação é onde o RAG vetorial costuma pesar no bolso, e a indexação do PageIndex foi barata: cerca de US$ 2 por 2.690 páginas com um modelo básico, feita uma vez. A parte cara foi para a hora da consulta. Toda pergunta ao PageIndex manda a árvore (num 10-K grande, dezenas de milhares de tokens) e a manda de novo a cada turno do agente, junto com todas as páginas lidas até ali. A pergunta mediana mandou 76.691 tokens de entrada; a média foi 165.476, puxada para cima por algumas buscas longas. A preço de tabela do `gpt-4.1`, isso dá US$ 334 por mil perguntas, contra US$ 8 do RAG vetorial.

O prompt caching suaviza isso: a árvore é um prefixo estável, e os provedores dão um desconto grande em entrada cacheada (no `gpt-4.1`, a entrada cacheada custa um quarto do preço normal). Eu reporto preços de tabela porque esse é o pior caso, e é para ele que você faz o orçamento. De um jeito ou de outro, o número que decide a arquitetura é perguntas por dia, não documentos.

### Latência é uma decisão de produto

11,4 segundos de mediana contra 2,7 segundos, com uma cauda de até um minuto (a pergunta mais lenta levou 20 chamadas ao modelo e 59 segundos). Para uma ferramenta de analista em que uma boa resposta substitui vinte minutos lendo um relatório, 11 segundos não são nada. Para um widget de chat respondendo perguntas de suporte, é outro produto. A latência do PageIndex também é menos previsível: o RAG faz um retrieval e uma chamada toda vez, o agente faz quantos turnos decidir que precisa.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Então o banco vetorial sobrevive. Posso simplesmente ignorar o PageIndex, então?</span>
    </div>
  </div>
</div>

Não. Use cada um onde o modelo de custo dele se encaixa:

- **Documentos longos, estruturados, de alto risco, com poucas perguntas:** relatórios regulatórios, contratos, regulamentações, manuais. Aqui a navegação do PageIndex justifica os tokens que gasta, e a rastreabilidade (o trace do agente diz quais páginas ele leu) já vale alguma coisa por si só quando um auditor pergunta.
- **Corpora grandes, muitas perguntas, respostas curtas:** bases de suporte, wikis, tickets. Busca vetorial ou híbrida é 40 vezes mais barata por pergunta e mais rápida. Para muitos documentos, a resposta do próprio PageIndex é uma árvore separada no nível de arquivo, só na nuvem, não o SDK que eu testei.
- **Os dois:** nada impede um roteador de mandar perguntas do tipo "ache o parágrafo sobre X" para a busca híbrida e perguntas do tipo "calcule o quick ratio a partir do balanço" para um agente de árvore. A análise de falhas acima é, na prática, a regra de roteamento: perguntas cuja resposta mora numa demonstração, numa tabela ou numa capa vão para a árvore.

### O que este benchmark não mostra

- **A amostra é pequena.** São 46 perguntas sobre 11 relatórios, a maioria no estilo de analista e uma única extração pura de métrica. O orçamento parou a rodada ali, e as 24 perguntas restantes (incluindo o 10-K de 503 páginas da PepsiCo) nunca foram respondidas. A direção é consistente; a magnitude é incerta.
- **Um modelo só.** Toda resposta veio do `gpt-4.1`. O README diz que o modelo de chat é o que mais importa para o PageIndex, e um modelo mais fraco provavelmente o prejudicaria mais do que prejudica o RAG, cujo trabalho de raciocínio é menor.
- **Um documento por vez.** Cada pergunta ficou restrita ao seu relatório. O cenário mais difícil, em que o sistema primeiro precisa achar o relatório certo entre dezenas, muda os dois lados.
- **O juiz é um modelo.** Os vereditos foram revisados um a um e seis foram alterados, todos listados com os motivos no repositório. A avaliação continua sendo a parte mais frágil de qualquer benchmark assim, e é por isso que a métrica de página fica ao lado dela.

## Conclusão

Vectorless RAG não é truque. Em relatórios reais da SEC, com tudo igual exceto o retrieval, um LLM navegando uma árvore do documento acertou mais perguntas do que uma busca híbrida ajustada com reranker, e ganhou exatamente onde você preveria: quando a resposta mora numa demonstração, numa tabela ou numa capa que não se parece com a pergunta. Também sobreviveu a árvores ruins melhor do que eu esperava.

Mas também não é de graça, nem é o que o gráfico da manchete sugere. A diferença ficou em um dígito, não em 98,7% contra 50%, e custou 40 vezes mais por pergunta, porque a etapa de retrieval agora é um LLM lendo um sumário a cada turno. O jeito útil de pensar no PageIndex não é "os vetores morreram", e sim "retrieval pode ser raciocínio, e raciocínio é cobrado por token". Meça os seus documentos, conte as suas perguntas por dia e leia as suas árvores antes de confiar nelas.

<div class="callout tip" data-title="Dica">
  <p>Tudo é reproduzível: <a href="https://github.com/gabe-santana/pageindex-vs-rag-benchmark">gabe-santana/pageindex-vs-rag-benchmark</a> tem o harness, as 18 árvores do PageIndex, cada resposta com o trace das ferramentas, os vereditos do juiz e os revisados. Ele roda contra qualquer endpoint compatível com a OpenAI, inclusive um servidor llama.cpp local, se você tiver paciência.</p>
</div>
