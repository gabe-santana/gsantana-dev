---
title: "Chunking Enterprise Documents Without Losing Meaning"
description: "Preserve a estrutura dos documentos no chunking para manter o contexto de tabelas e políticas."
date: 2026-01-05
tags: [RAG, Chunking, Python, Embeddings]
tldr:
  - "Quebre nos headings, listas, tabelas e blocos de código, e só divida um bloco quando ele passar do orçamento de tokens."
  - "Coloque o caminho de headings no início de cada chunk para que o embedding e o modelo saibam a que seção o texto pertence."
  - "Indexe chunks filhos pequenos e devolva as seções pai deduplicadas, para que tabelas, procedimentos e exceções cheguem inteiros ao modelo."
---

Imagine um assistente de RH rodando em cima da política de viagens da empresa. Alguém pergunta "qual é a minha diária em Tóquio para uma missão de 45 dias?" e o bot responde, cheio de confiança, "90 USD por dia". A política diz, na verdade, que viagens com mais de 30 dias caem para 75% do limite a partir do dia 31. Essa frase existe. Ela fica três linhas abaixo da tabela, e o chunker a jogou num chunk diferente, que nunca chegou ao modelo.

Ninguém nesse pipeline fez nada obviamente errado: o modelo leu exatamente o que recebeu. O estrago aconteceu na ingestão, numa função que corta o texto a cada 1.000 caracteres. Chunking é a etapa menos glamourosa do RAG e uma das mais decisivas, então vamos construir um chunker que respeita o jeito como documentos corporativos são escritos de verdade.

## O problema e o contexto

Documentos corporativos não são prosa. Políticas, runbooks, contratos e especificações de produto são feitos de headings, procedimentos numerados, tabelas, listas de definições e exceções que fazem referência a regras. O significado mora na estrutura tanto quanto nas palavras. Uma janela de tamanho fixo, conte ela caracteres ou tokens, não sabe nada dessa estrutura, então corta onde o contador acabar.

As quebras típicas são estas:

- **Cabeçalho da tabela separado das linhas.** O chunk contém `| Tokyo | 90 | 280 |` e mais nada. O 90 é o limite diário, o teto de hospedagem ou o número de um prédio? O modelo tem que chutar.
- **"Passo 4" sem os passos 1 a 3.** Um procedimento cortado no meio gera um chunk que começa com "4. Submit the visa application". Pergunte "o que eu preciso antes de pedir o visto?" e o chunk recuperado não contém a resposta, embora o documento contenha.
- **Uma exceção cortada da regra.** "Exception: trips longer than 30 days receive 75%..." cai num chunk sem a regra que ela modifica, e a regra cai num chunk sem a exceção. As duas metades agora estão erradas sozinhas.

Existe uma segunda perda, mais silenciosa: o contexto. Mesmo um chunk cortado no lugar certo perdeu o endereço. Um parágrafo que diz "classe econômica é o padrão" significa uma coisa em "Viagens nacionais" e talvez outra em "Viagens de executivos". Quando vira um chunk solto, nem o embedding nem o modelo sabem a que política ele pertence.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Fácil, é só fazer chunks enormes. Com 2.000 tokens a tabela inteira e a exceção cabem num chunk só, né?</span>
    </div>
  </div>
</div>

Às vezes, e você paga duas vezes. No retrieval, um único vetor precisa representar os 2.000 tokens, então um chunk que cobre diárias, vistos e prazos de reembolso vira uma média borrada que não casa bem com nenhuma dessas perguntas. Na geração, o modelo precisa achar as três linhas relevantes no meio de um paredão de contexto caro. O que você quer de verdade são unidades pequenas para o match e unidades inteiras para a leitura, que é exatamente onde este post vai chegar.

Veja como as estratégias mais comuns se comparam:

| Estratégia | Fronteiras | Contexto preservado | Falha típica |
|---|---|---|---|
| Janelas de tamanho fixo | A cada N caracteres ou tokens | Nenhum | Corta tabelas, listas e frases em qualquer lugar |
| Divisão recursiva por caracteres | Parágrafos, depois frases, depois palavras | Pouco | Frases melhores, mas ainda ignora headings e tabelas |
| Baseada em estrutura | Headings, listas, tabelas, blocos de código | Caminho de headings | Seções gigantes precisam de fallback |
| Estrutura + parent-child | Estrutura para os filhos, seções para os pais | Caminho de headings e seção inteira | Mais armazenamento e uma segunda busca |

## Mergulho na arquitetura

O design tem três ideias: transformar o documento em blocos estruturais, empacotar os blocos em chunks sem atravessar fronteiras de seção e separar o que você indexa do que você entrega ao modelo.

```text
 PDF / DOCX / HTML
        │
        ▼
 ┌────────────────────────┐
 │ Layout-aware extraction│  (its own problem: OCR, reading order, tables)
 └───────────┬────────────┘
             │ Markdown
             ▼
 ┌────────────────────────┐     ┌──────────────────────────────┐
 │ Block parser           │ ──▶ │ Section tree (heading paths) │
 └────────────────────────┘     └──────────────┬───────────────┘
                                               │
                     ┌─────────────────────────┴─────────────────────┐
                     ▼                                               ▼
        ┌─────────────────────────┐                    ┌──────────────────────────┐
        │ Child chunks            │                    │ Parent sections          │
        │ breadcrumb + blocks     │                    │ full text, keyed by id   │
        │ + metadata + parent_id  │                    │ (document store)         │
        └────────────┬────────────┘                    └────────────▲─────────────┘
                     │ embed + index                                │ fetch by parent_id
                     ▼                                              │
 query ──▶ search children ──▶ top-k child hits ──▶ dedupe parent ids
```

### Converta antes, faça chunking de Markdown

Não escreva um chunker que entende PDF. Extrair texto de PDFs e DOCX com a ordem de leitura correta, células de tabela mescladas e layouts em várias colunas é um problema difícil por si só, e existem ferramentas dedicadas de extração com consciência de layout para isso (o modelo de layout do Azure AI Document Intelligence, por exemplo, consegue gerar Markdown diretamente). Converta tudo para Markdown ou HTML limpo primeiro e depois faça chunking de um único formato bem conhecido. O Markdown também vira um intermediário fácil de depurar: quando um chunk parece errado, dá para ver se a culpa é da extração ou do chunking.

### Blocos são atômicos, seções são a fronteira

O parser transforma o Markdown em blocos tipados: parágrafo, lista, tabela, código. O chunker então segue duas regras. Um chunk nunca atravessa um heading, então nunca mistura duas seções. E um bloco nunca é dividido enquanto couber no orçamento, então uma tabela, um procedimento numerado ou um exemplo de código chega inteiro. Só quando um bloco sozinho é grande demais ele é dividido, e mesmo assim respeitando a própria natureza: tabelas por grupos de linhas com o cabeçalho repetido em cada pedaço, listas por itens, código por linhas com a cerca restaurada, parágrafos por frases.

### Caminhos de headings como breadcrumbs

Todo chunk começa com o caminho de headings, algo como `Travel Policy > International Travel > Per diem`. Essa linha faz muito trabalho. Ela coloca as palavras do assunto dentro do embedding, então uma pergunta sobre diárias internacionais casa com o chunk da linha da tabela, mesmo que a linha em si só diga "Tokyo | 90 | 280". Ela também diz ao modelo de onde o texto veio e serve de rótulo para citação.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Repetir o mesmo heading em todo chunk não é só desperdício de tokens?</span>
    </div>
  </div>
</div>

Custa uns dez ou quinze tokens por chunk, e é o contexto mais barato que você vai comprar na vida. Sem ele, o chunk com a linha de Tóquio não tem nenhuma palavra sobre viagem ou diária, então depende só da sorte para ser recuperado. Se os caminhos ficarem longos em documentos muito aninhados, mantenha os dois ou três últimos níveis.

### Tamanhos em tokens, com um contador plugável

Orçamentos devem ser em tokens, porque é isso que modelos de embedding e janelas de contexto contam. Muitos modelos de embedding abertos também têm um tamanho máximo de sequência (geralmente 256 ou 512 tokens) e truncam em silêncio tudo que passar disso, o que significa que o final de um chunk grande demais simplesmente nunca vira embedding. Deixe o contador de tokens como parâmetro: uma estimativa barata para experimentos, o tokenizador real do seu modelo de embedding em produção.

### Overlap: útil para prosa, ruído para estrutura

O overlap existe para resgatar frases que uma janela cega corta ao meio. Quando as fronteiras seguem a estrutura, sobra bem menos para resgatar: o chunk já termina no fim de uma tabela ou de uma seção. Aí o overlap basicamente duplica texto, o que infla o índice e enche seu top-k de vizinhos quase idênticos que empurram para fora outros chunks relevantes.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Mas todo tutorial usa 10 a 20% de overlap. Eu não deveria colocar sempre?</span>
    </div>
  </div>
</div>

Tutoriais usam janelas de tamanho fixo, em que o overlap é um remendo para fronteiras ruins. Guarde o overlap para o caminho de fallback (uma seção longa de prosa sem estrutura que você divide por frases) e dispense onde a estrutura já dá fronteiras limpas. Se usar, deduplique os resultados sobrepostos antes de chegarem ao prompt.

### Small-to-big: indexe os filhos, devolva os pais

Esta é a peça que faz tudo se encaixar. Indexe chunks filhos pequenos, porque chunks pequenos geram embeddings nítidos e matches precisos. Guarde a seção inteira de cada filho sob um id de pai. Na hora da consulta, busque nos filhos, junte os ids dos pais na ordem do ranking, deduplique e entregue ao modelo as seções pai. O filho que casou com "Tokyo" traz de volta a seção inteira de diárias, com o cabeçalho da tabela e a exceção incluídos.

O nível do pai é uma escolha. A seção folha é um bom default para políticas e runbooks. Para seções curtas você pode subir um nível de heading; para seções muito longas você limita o tamanho do pai ou devolve o filho encontrado mais os vizinhos dele.

## Implementação na prática

Tudo abaixo usa só a biblioteca padrão do Python, mais o `tiktoken` em um arquivo opcional. O documento de exemplo é uma pequena política de viagens com headings aninhados, uma tabela, uma exceção e um procedimento numerado.

```python title="chunker.py"
import re
from dataclasses import dataclass, field
from typing import Callable

TokenCounter = Callable[[str], int]

HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")
LIST_ITEM = re.compile(r"^\s*(?:[-*+]|\d+[.)])\s+")
FENCE = "`" * 3  # uma cerca de código, escrita assim para este arquivo poder viver dentro de Markdown

SAMPLE_POLICY = """# Travel Policy

Applies to all employees and contractors traveling on company business.

## Domestic Travel

### Booking

Book flights and hotels through the corporate travel portal at least 7 days
in advance. Economy class is the default for flights under 6 hours.

## International Travel

### Per diem

Per diem covers meals and incidentals. Lodging is reimbursed separately
against receipts, up to the cap for the destination city.

| City | Daily limit (USD) | Lodging cap (USD) |
|---|---|---|
| London | 95 | 320 |
| Tokyo | 90 | 280 |
| Sao Paulo | 70 | 210 |
| New York | 105 | 350 |

Exception: trips longer than 30 consecutive days receive 75% of the daily
limit from day 31 onward.

### Visa and approvals

Before booking any international trip, follow this procedure:

1. Check the entry requirements for your passport on the official government site.
2. Request a business invitation letter from the host office.
3. Get written approval from your director and attach it to the trip request.
4. Submit the visa application and upload the receipt to the travel portal.
5. Book flights only after the visa is issued.

## Expense Reporting

Submit expenses within 15 days of returning. Receipts are mandatory for any
item above 25 USD.
"""


def approx_tokens(text: str) -> int:
    # Heurística grosseira para inglês (cerca de 0,75 palavra por token). Troque por um tokenizador de verdade.
    return max(1, round(len(text.split()) * 4 / 3))


@dataclass
class Block:
    kind: str  # heading, parágrafo, lista, tabela, código
    text: str
    level: int = 0


@dataclass
class Section:
    section_id: str
    heading_path: list[str]
    blocks: list[Block] = field(default_factory=list)

    @property
    def breadcrumb(self) -> str:
        return " > ".join(self.heading_path)

    @property
    def text(self) -> str:
        body = "\n\n".join(block.text for block in self.blocks)
        return f"{self.breadcrumb}\n\n{body}".strip()


@dataclass
class Chunk:
    chunk_id: str
    parent_id: str
    heading_path: list[str]
    text: str
    token_count: int
    metadata: dict[str, str]


def _starts_block(line: str) -> bool:
    return bool(
        HEADING.match(line)
        or line.startswith(FENCE)
        or line.lstrip().startswith("|")
        or LIST_ITEM.match(line)
    )


def parse_blocks(markdown: str) -> list[Block]:
    lines = markdown.splitlines()
    blocks: list[Block] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
        elif line.startswith(FENCE):
            j = i + 1
            while j < len(lines) and not lines[j].startswith(FENCE):
                j += 1
            blocks.append(Block("code", "\n".join(lines[i : j + 1])))
            i = j + 1
        elif match := HEADING.match(line):
            blocks.append(Block("heading", match.group(2), level=len(match.group(1))))
            i += 1
        elif line.lstrip().startswith("|"):
            j = i
            while j < len(lines) and lines[j].lstrip().startswith("|"):
                j += 1
            blocks.append(Block("table", "\n".join(lines[i:j])))
            i = j
        elif LIST_ITEM.match(line):
            j = i + 1
            # Linhas de continuação (indentadas) ficam com a lista delas
            while j < len(lines) and lines[j].strip() and (
                LIST_ITEM.match(lines[j]) or lines[j].startswith((" ", "\t"))
            ):
                j += 1
            blocks.append(Block("list", "\n".join(lines[i:j])))
            i = j
        else:
            j = i + 1
            while j < len(lines) and lines[j].strip() and not _starts_block(lines[j]):
                j += 1
            blocks.append(Block("paragraph", " ".join(l.strip() for l in lines[i:j])))
            i = j
    return blocks


def build_sections(blocks: list[Block], doc_id: str) -> list[Section]:
    sections: list[Section] = []
    stack: list[tuple[int, str]] = []  # (nível, título) dos headings abertos
    current = Section(f"{doc_id}#s0", [doc_id])
    for block in blocks:
        if block.kind == "heading":
            if current.blocks:
                sections.append(current)
            while stack and stack[-1][0] >= block.level:
                stack.pop()
            stack.append((block.level, block.text))
            path = [title for _, title in stack]
            current = Section(f"{doc_id}#s{len(sections) + 1}", path)
        else:
            current.blocks.append(block)
    if current.blocks:
        sections.append(current)
    return sections


def _group(units: list[str], budget: int, count: TokenCounter, prefix: str = "") -> list[str]:
    """Empacota unidades de forma gulosa em grupos dentro do orçamento, repetindo o prefixo em cada grupo."""
    groups: list[str] = []
    current: list[str] = []
    for unit in units:
        candidate = "\n".join([prefix, *current, unit]).strip()
        if current and count(candidate) > budget:
            groups.append("\n".join([prefix, *current]).strip())
            current = []
        current.append(unit)
    if current:
        groups.append("\n".join([prefix, *current]).strip())
    return groups


def split_block(block: Block, budget: int, count: TokenCounter) -> list[str]:
    if count(block.text) <= budget:
        return [block.text]  # tabelas, listas e código ficam inteiros quando cabem
    lines = block.text.splitlines()
    if block.kind == "table":
        header = "\n".join(lines[:2])  # linha de cabeçalho + separador, repetidos em cada pedaço
        return _group(lines[2:], budget, count, prefix=header)
    if block.kind == "list":
        items: list[str] = []
        for line in lines:
            if LIST_ITEM.match(line) or not items:
                items.append(line)
            else:
                items[-1] += "\n" + line
        return _group(items, budget, count)
    if block.kind == "code":
        fence, body = lines[0], lines[1:-1]
        return [f"{fence}\n{group}\n{FENCE}" for group in _group(body, budget, count)]
    sentences = re.split(r"(?<=[.!?])\s+", block.text)
    return [group.replace("\n", " ") for group in _group(sentences, budget, count)]


def chunk_document(
    markdown: str,
    doc_id: str,
    max_tokens: int = 200,
    count_tokens: TokenCounter = approx_tokens,
    metadata: dict[str, str] | None = None,
) -> tuple[list[Chunk], dict[str, Section]]:
    sections = build_sections(parse_blocks(markdown), doc_id)
    chunks: list[Chunk] = []
    for section in sections:
        header = f"{section.breadcrumb}\n\n"
        budget = max_tokens - count_tokens(header)
        units = [piece for block in section.blocks for piece in split_block(block, budget, count_tokens)]
        bodies: list[str] = []
        current: list[str] = []
        for unit in units:
            if current and count_tokens(header + "\n\n".join([*current, unit])) > max_tokens:
                bodies.append("\n\n".join(current))
                current = []
            current.append(unit)
        if current:
            bodies.append("\n\n".join(current))
        for n, body in enumerate(bodies):
            text = header + body
            chunks.append(
                Chunk(
                    chunk_id=f"{section.section_id}-c{n}",
                    parent_id=section.section_id,
                    heading_path=section.heading_path,
                    text=text,
                    token_count=count_tokens(text),
                    metadata={"doc_id": doc_id, "section": section.breadcrumb, **(metadata or {})},
                )
            )
    return chunks, {section.section_id: section for section in sections}


if __name__ == "__main__":
    chunks, parents = chunk_document(
        SAMPLE_POLICY,
        doc_id="travel-policy",
        max_tokens=120,
        metadata={"version": "3.2", "tenant": "acme"},
    )
    for chunk in chunks:
        print(f"--- {chunk.chunk_id} (parent {chunk.parent_id}, ~{chunk.token_count} tokens)")
        print(chunk.text, end="\n\n")
```

O `build_sections` mantém uma pilha de headings abertos, então o caminho continua correto conforme os níveis sobem e descem. O `split_block` só entra em ação quando um bloco não cabe, e o ramo de tabela repete o cabeçalho e o separador em cada grupo de linhas. O `chunk_document` devolve os chunks que você vai transformar em embedding e as seções indexadas pelo mesmo `parent_id` que os chunks carregam.

Rode e cada seção sai como um único chunk, com a tabela, a exceção e o procedimento inteiros. Depois mude `max_tokens` para 45 e rode de novo. Olhe a seção de diárias: a tabela agora se divide em grupos de linhas, e todos eles continuam começando com o breadcrumb e o cabeçalho. O procedimento se divide por itens, nunca no meio de um passo. Nesse tamanho, porém, a exceção fica sozinha e o passo 4 cai num chunk sem os passos 1 a 3, que é exatamente o problema que a busca pelo pai resolve.

Para orçamentos de produção, plugue um tokenizador de verdade. O chunker não se importa com qual:

```python title="token_counter.py"
import tiktoken

from chunker import SAMPLE_POLICY, chunk_document

# Prefira o tokenizador do modelo que vai consumir o chunk
encoding = tiktoken.get_encoding("cl100k_base")


def count_tokens(text: str) -> int:
    return len(encoding.encode(text))


chunks, parents = chunk_document(
    SAMPLE_POLICY, doc_id="travel-policy", max_tokens=120, count_tokens=count_tokens
)
for chunk in chunks:
    print(chunk.chunk_id, chunk.token_count)
```

Agora o lado do retrieval. A função `score` é um substituto baseado em sobreposição de palavras, para o exemplo rodar sem baixar modelo nenhum; num sistema real, esse é o seu índice vetorial ou híbrido. O que importa aqui é o filtro de metadados e a deduplicação dos pais.

```python title="retrieval.py"
import math
import re
from collections import Counter

from chunker import SAMPLE_POLICY, Chunk, Section, chunk_document

STOP_WORDS = {"a", "an", "the", "is", "are", "i", "do", "what", "for", "in", "of", "to", "my", "on", "how"}


def terms(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9]+", text.lower()) if t not in STOP_WORDS]


def score(query: str, text: str) -> float:
    # Substituto do seu índice vetorial ou híbrido, para o exemplo rodar sem modelo
    counts = Counter(terms(text))
    return sum(1 + math.log(counts[t]) for t in set(terms(query)) if counts[t])


def search_children(
    query: str,
    chunks: list[Chunk],
    k: int = 4,
    filters: dict[str, str] | None = None,
) -> list[Chunk]:
    filters = filters or {}
    allowed = [c for c in chunks if all(c.metadata.get(key) == value for key, value in filters.items())]
    scored = [(score(query, c.text), c) for c in allowed]
    ranked = sorted((pair for pair in scored if pair[0] > 0), key=lambda pair: pair[0], reverse=True)
    return [chunk for _, chunk in ranked[:k]]


def small_to_big(
    query: str,
    chunks: list[Chunk],
    parents: dict[str, Section],
    k: int = 4,
    max_parents: int = 2,
    filters: dict[str, str] | None = None,
) -> list[Section]:
    parent_ids: list[str] = []
    for chunk in search_children(query, chunks, k=k, filters=filters):
        if chunk.parent_id not in parent_ids:  # deduplica, mantendo a posição do melhor filho
            parent_ids.append(chunk.parent_id)
    return [parents[pid] for pid in parent_ids[:max_parents]]


if __name__ == "__main__":
    # Filhos pequenos para o match preciso, seções inteiras para o modelo
    chunks, parents = chunk_document(
        SAMPLE_POLICY, doc_id="travel-policy", max_tokens=45, metadata={"tenant": "acme"}
    )
    for question in ["What is the per diem in Tokyo?", "What comes after director approval?"]:
        hits = search_children(question, chunks, filters={"tenant": "acme"})
        print(f"Q: {question}")
        print("   matched children:", [c.chunk_id for c in hits])
        for section in small_to_big(question, chunks, parents, filters={"tenant": "acme"}):
            print(f"\n[{section.section_id}]\n{section.text}\n")
```

Rode e compare a lista de filhos encontrados com o que é impresso. A primeira pergunta casa com vários filhos da seção de diárias, mas só um pai volta, com a tabela inteira e a exceção. A segunda pergunta casa com os passos próximos da aprovação do diretor, e o modelo recebe o procedimento completo, do passo 1 ao 5.

<div class="callout tip" data-title="Dica">
  <p>Não gere embedding dos pais. Guarde os pais num document store ou numa tabela simples indexada por <code>parent_id</code> e busque depois da pesquisa. Gerar embedding só dos filhos mantém os vetores nítidos e o índice pequeno, e buscar pais por id é uma consulta por chave barata.</p>
</div>

## Checagem de realidade em produção

### Metadados e filtros

Todo filho deve carregar metadados suficientes para ser filtrado antes do ranking: `doc_id`, caminho da seção, versão do documento, data de vigência e os campos de acesso que o seu modelo de segurança exige (tenant, grupo ou ids de ACL). Filtrar depois do retrieval é uma armadilha: se o top 10 inteiro for de documentos que o usuário não pode ver, você descarta todos e não devolve nada útil. Empurre o filtro para dentro da consulta ao índice.

<div class="callout warning" data-title="Atenção">
  <p>A expansão para o pai é um segundo caminho de leitura. Se você aplica filtros de ACL ou tenant só na busca dos filhos e depois busca os pais por id sem nenhuma checagem, um bug na geração de ids ou uma seção compartilhada pode vazar conteúdo entre tenants. Guarde os mesmos campos de acesso nos pais e cheque de novo na busca.</p>
</div>

### Avalie com perguntas que atravessam a estrutura

Perguntas genéricas não vão mostrar a diferença. Monte um conjunto de avaliação em que a resposta atravessa uma tabela (cabeçalho mais linha), um procedimento (vários passos) ou uma regra mais a exceção dela, e meça se todos os fatos necessários chegam ao modelo. Os mesmos chunks normalmente alimentam o retrieval por palavra-chave e o vetorial, então se você já roda o setup de [Hybrid Search That Actually Works](/pt-br/blog/hybrid-search-bm25-vectors-rrf/), dá para reaproveitar o harness de recall@k e só trocar a estratégia de chunking.

```python title="evaluate.py"
from chunker import SAMPLE_POLICY, Chunk, chunk_document
from retrieval import search_children, small_to_big


def fixed_size_chunks(text: str, size: int = 200, overlap: int = 40) -> list[Chunk]:
    """A baseline ingênua: janelas de caracteres que ignoram a estrutura."""
    chunks = []
    for n, start in enumerate(range(0, len(text), size - overlap)):
        window = text[start : start + size]
        chunks.append(Chunk(f"fixed-{n}", f"fixed-{n}", [], window, len(window.split()), {}))
    return chunks


# Cada pergunta lista os fatos que precisam TODOS chegar ao modelo para uma resposta correta
EVAL_SET = {
    "What is the daily limit in Tokyo for a 45 day trip?": [
        "Daily limit (USD)", "| Tokyo | 90", "75% of the daily",
    ],
    "What is the lodging cap in New York?": ["Lodging cap (USD)", "| New York | 105 | 350"],
    "What are the steps before I book an international flight?": [
        "1. Check the entry", "3. Get written approval", "5. Book flights only after",
    ],
    "How long do I have to submit expenses?": ["within 15 days"],
}


def fact_recall(context: str, facts: list[str]) -> float:
    return sum(fact in context for fact in facts) / len(facts)


def evaluate(name: str, retrieve) -> None:
    scores = [fact_recall(retrieve(q), facts) for q, facts in EVAL_SET.items()]
    print(f"{name:<22} fact recall = {sum(scores) / len(scores):.2f}")


if __name__ == "__main__":
    k = 2
    fixed = fixed_size_chunks(SAMPLE_POLICY)
    children, parents = chunk_document(SAMPLE_POLICY, doc_id="travel-policy", max_tokens=45)

    evaluate("fixed-size windows", lambda q: "\n".join(c.text for c in search_children(q, fixed, k=k)))
    evaluate("structural children", lambda q: "\n".join(c.text for c in search_children(q, children, k=k)))
    evaluate("small-to-big parents", lambda q: "\n".join(s.text for s in small_to_big(q, children, parents, k=k)))
```

Isso compara três estratégias com o mesmo retriever de brinquedo: janelas de caracteres de tamanho fixo, só os filhos estruturais e os pais do small-to-big. Veja quais fatos somem em cada uma. As janelas de tamanho fixo perdem o cabeçalho da tabela ou metade do procedimento; os filhos estruturais mantêm cada pedaço de tabela legível, mas ainda podem trazer só alguns dos passos; os pais recuperam tudo neste conjunto pequeno. No seu corpus, repita com o seu retriever real e algumas dezenas de perguntas escritas por quem conhece os documentos.

### Modos de falha para ficar de olho

- **PDFs escaneados.** Sem camada de texto não tem texto, ou tem saída de OCR com ordem de leitura quebrada e tabelas achatadas numa sopa de palavras. Detecte na ingestão (imagens, quase nenhum texto extraível) e mande para OCR com análise de layout.
- **Cabeçalhos e rodapés repetidos.** "Confidencial, página 3 de 40" em toda página acaba em todo chunk e faz chunks sem relação parecerem similares. Remova as linhas que se repetem na maioria das páginas antes do chunking.
- **Seções gigantes.** Uma seção de 30 páginas sem subtítulos vira um pai gigante. Limite o tamanho do pai, caia para devolver o filho encontrado mais os vizinhos ou divida pela estrutura de parágrafos dentro da seção.
- **Documentos sem headings.** Alguns exports usam linhas em negrito no lugar de headings de verdade. Promova padrões óbvios de heading na conversão e caia para divisão por frases com um overlap modesto quando não houver estrutura nenhuma.
- **Versões quase duplicadas.** A política de viagens v3.1 e a v3.2 são 95% idênticas, então as duas são recuperadas e o modelo pode citar a regra antiga. Guarde versão e data de vigência, indexe por padrão só a versão vigente e deduplique por hash de conteúdo para que seções sem mudança não virem embedding duas vezes.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Tá, mas qual é o tamanho de chunk perfeito? 256? 512?</span>
    </div>
  </div>
</div>

Não existe, e esse é o ponto do design. Com fronteiras baseadas em estrutura e retrieval pelo pai, o tamanho do filho só controla a precisão do match, e o pai controla quanto o modelo lê. Comece com filhos de algumas centenas de tokens e seções folha como pais, e deixe o conjunto de avaliação mexer nos números. Chunking nunca vai ser a parte empolgante do seu sistema de RAG, mas é ele que decide o que o modelo tem permissão de saber, e um chunker que respeita tabelas, procedimentos e exceções elimina uma classe inteira de respostas erradas e confiantes antes de qualquer engenharia de prompt começar.
