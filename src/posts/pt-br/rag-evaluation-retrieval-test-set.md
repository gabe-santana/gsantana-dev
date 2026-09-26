---
title: "Avaliando RAG como engenheiro: crie um conjunto de testes de recuperação em Python"
description: "Crie um conjunto versionado de testes de RAG e valide retrieval e fidelidade no CI."
date: 2026-05-13
tags: [RAG, Evaluation, Python, Testing]
tldr:
  - "Monte um golden set de perguntas reais rotuladas com os ids dos chunks que as respondem, e versione-o como código."
  - "Meça o retrieval (recall@k, hit rate, MRR) separado da geração, para que uma regressão aponte direto para a camada que quebrou."
  - "Barre o CI com checagens determinísticas e thresholds; rode o LLM judge, que oscila, de forma agendada, com voto de maioria e medida de concordância."
---

A maioria dos pipelines de RAG é avaliada do mesmo jeito: alguém muda o tamanho do chunk, faz ao bot cinco perguntas cujas respostas já conhece, lê o que voltou e diz "parece melhor". Duas semanas depois, um usuário avisa que o bot não sabe mais a política de reembolso, e ninguém consegue dizer qual das últimas oito mudanças quebrou isso, ou se um dia funcionou de verdade.

Isso é checagem no feeling, não avaliação. A solução é a mesma que usamos para qualquer outro código: entradas fixas com saídas esperadas conhecidas, métricas e um teste que quebra o build quando os números caem. Este post monta isso para RAG em Python puro, terminando num gate de pytest para o CI. O Júnior Inocente vai nos manter honestos.

## O problema e o contexto

Uma resposta de RAG passa por dois sistemas bem diferentes. O retriever escolhe um punhado de chunks entre milhares, e o gerador (o LLM) escreve uma resposta a partir deles. Quando a resposta final sai errada, a causa pode estar em qualquer um dos dois:

- **O chunk certo nunca chegou.** O retriever o colocou em 14º lugar e você só envia os 5 primeiros. Nenhum prompt resolve isso.
- **O chunk certo chegou e o modelo o ignorou**, leu errado ou misturou com o que aprendeu no treinamento.
- **O modelo respondeu a partir do nada.** O retrieval trouxe matches fracos e o modelo preencheu o buraco com uma invenção plausível.

Um novo modelo de embeddings, outro tamanho de chunk, um novo system prompt: cada mudança pode melhorar algumas perguntas e quebrar outras em silêncio. Sem um conjunto de testes fixo, você só enxerga as perguntas que calhou de testar.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Não dá para eu só manter uma lista de perguntas e ler as respostas depois de cada mudança? Eu sei reconhecer uma resposta boa quando vejo uma.</span>
    </div>
  </div>
</div>

Dá, por mais ou menos uma semana. Ler respostas não escala além de algumas dezenas de perguntas, duas pessoas discordam sobre o que é "boa", e ninguém faz isso a cada pull request. Pior: uma resposta fluente esconde problemas de retrieval. O modelo escreve um parágrafo confiante estando o chunk certo no contexto ou não. Você precisa de checagens rápidas, repetíveis e específicas o bastante para dizer **qual camada** falhou.

É por isso que este post avalia retrieval e geração separadamente. O retrieval é barato de medir: os chunks que contêm a resposta apareceram no top k? Isso é determinístico e não precisa de LLM. A qualidade da geração é mais nebulosa, então ganha métricas e thresholds próprios.

## Mergulho na arquitetura

O setup inteiro tem quatro partes: um golden dataset, um avaliador de retrieval, um avaliador de fidelidade e um executor de testes que transforma notas em aprovado ou reprovado.

```text
 golden/v1.jsonl ──> load + validate ──> for each question:
   (question,                               retriever.search(q, k) ──> recall@k, hit rate, MRR
    expected ids,                           generate(q, chunks)    ──> faithfulness (claims vs chunks)
    source)                                                            optional LLM judge
                                                         │
                                                         v
                                    pytest thresholds ──> CI pass / fail + JSON report
```

### O golden dataset

Cada linha é uma pergunta mais os ids dos chunks que a respondem. Não uma resposta de referência: **ids de chunks**. Essa escolha deixa a avaliação de retrieval exata e barata, porque você só compara dois conjuntos de strings. Adicione um campo `source` registrando de onde veio a pergunta, porque mais tarde você vai querer fatiar as métricas por ele.

De onde vêm as perguntas importa mais do que quantas você tem:

1. **Logs de usuários reais.** A melhor fonte, porque carregam o vocabulário, os erros de digitação e a imprecisão reais dos seus usuários. Tire amostras dos logs de busca ou de chat, remova dados pessoais e peça a alguém que conhece a documentação para rotular os chunks que respondem cada pergunta.
2. **Especialistas no assunto.** Quem dá suporte ao produto sabe quais perguntas são frequentes, quais são traiçoeiras e quais têm a resposta espalhada por vários documentos. São também as pessoas certas para rotular.
3. **Geração sintética, com revisão humana.** Um LLM lê um chunk e escreve perguntas que ele responde. Bom para cobrir documentos sobre os quais ninguém perguntou ainda, mas toda pergunta gerada precisa passar por um humano.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Rotular é lento. Por que não pedir para um LLM gerar mil perguntas a partir dos chunks e dispensar os humanos de vez?</span>
    </div>
  </div>
</div>

Porque perguntas sintéticas são suspeitamente fáceis. Um modelo que escreve a pergunta olhando para o chunk tende a reaproveitar as palavras exatas dele, então qualquer retriever por palavra-chave a encontra e suas notas ficam lindas. Usuários reais perguntam "como pego meu dinheiro de volta?" quando o documento fala em "reembolso". Algumas perguntas geradas também estão erradas, ou são respondidas por outro chunk. Use geração para preencher lacunas, mantenha a tag `source` e reporte métricas por fonte, para que uma fatia sintética lisonjeira não esconda uma fatia fraca vinda dos logs reais.

### Métricas de retrieval

Três números cobrem a maior parte das necessidades, todos calculados sobre os k primeiros resultados:

| Métrica | Pergunta que responde | Como calcular |
|---|---|---|
| recall@k | Quanto da evidência necessária buscamos? | chunks relevantes no top k / todos os chunks relevantes, com média entre as perguntas |
| hit rate@k | Com que frequência trouxemos pelo menos algo útil? | fração das perguntas com pelo menos um chunk relevante no top k |
| MRR@k | Em que posição ficou o primeiro chunk útil? | média de 1 / posição do primeiro chunk relevante (0 se nenhum no top k) |

Escolha o k de acordo com o que você realmente envia ao modelo. Se o prompt recebe 5 chunks, recall@50 é um número reconfortante que descreve um sistema que você não roda. Quando toda pergunta tem exatamente um chunk relevante, recall@k e hit rate@k são idênticos; eles divergem nas perguntas cuja resposta ocupa vários chunks, e são justamente essas em que um retrieval parcial produz respostas meio certas.

### Fidelidade

Fidelidade (faithfulness) faz uma pergunta estreita: toda afirmação da resposta é sustentada pelo contexto recuperado? Isso não é o mesmo que estar correta. Uma resposta pode ser totalmente fiel a um chunk desatualizado e ainda assim estar errada, o que é um problema de retrieval ou de conteúdo, não de geração. Essa separação é o ponto.

Usamos duas camadas. A primeira é uma **checagem determinística**: quebre a resposta em frases e, para cada uma, meça quantas das suas palavras de conteúdo aparecem no contexto, com uma regra rígida extra: todo número da afirmação precisa aparecer no contexto. É grosseira, mas roda na hora, nunca oscila e pega as alucinações mais caras: números, prazos e limites inventados. A segunda é um **LLM judge opcional**, que devolve um veredito por afirmação. Ele entende paráfrase e negação, e é não determinístico, mais lento e custa dinheiro. Bibliotecas como Ragas e DeepEval empacotam métricas de fidelidade baseadas em judge; as mesmas ressalvas valem para elas.

### Versionando o dataset

O golden set é dado de teste, então trate-o como código. Mantenha-o no repositório em JSONL (uma pergunta por linha gera diffs legíveis), nunca edite uma versão publicada e crie `v2.jsonl` quando adicionar ou rotular de novo perguntas. Registre a versão e um hash do conteúdo em todo relatório, para que um salto no recall possa ser atribuído a um retriever melhor ou a um dataset mais fácil. E valide ao carregar: quando alguém refaz o chunking do corpus, os ids mudam, e um golden set apontando para ids que não existem mais deveria falhar alto em vez de marcar zero em silêncio.

## Implementação na prática

O exemplo usa um corpus minúsculo em memória (documentação de suporte de um produto SaaS imaginário) e um retriever TF-IDF escrito com a biblioteca padrão, então tudo roda offline. A única dependência é o pytest.

```bash title="terminal"
python -m venv .venv
source .venv/bin/activate   # no Windows: .venv\Scripts\activate
pip install pytest
```

### O corpus e um retriever para testar

```python title="retriever.py"
import math
import re
from collections import Counter

TOKEN = re.compile(r"[a-z0-9]+")
STOPWORDS = frozenset(
    "a an and are as at be by can do does for from how i in is it my of on or the to what when which with you your".split()
)


def tokenize(text: str) -> list[str]:
    tokens = [t for t in TOKEN.findall(text.lower()) if t not in STOPWORDS]
    # Normalização tosca de plural para "plans" casar com "plan"; um sistema real usa o analyzer do seu motor de busca
    return [t[:-1] if t.endswith("s") and len(t) > 3 else t for t in tokens]


CHUNKS: dict[str, str] = {
    "billing/refunds#0": "Annual plans can be refunded in full within 30 days of purchase. After 30 days, refunds are prorated by the unused months.",
    "billing/refunds#1": "Monthly plans are not refundable, but you can cancel at any time and keep access until the end of the billing period.",
    "billing/invoices#0": "Invoices are emailed to the billing contact on the first business day of each month and can be downloaded as PDF from the Billing page.",
    "api/rate-limits#0": "The public API allows 600 requests per minute per API key. Requests above the limit receive HTTP 429 with a Retry-After header.",
    "api/webhooks#0": "Webhook deliveries are retried up to 5 times with exponential backoff. Each delivery is signed with an HMAC-SHA256 signature in the X-Signature header.",
    "account/sso#0": "Single sign-on supports SAML 2.0 and OpenID Connect. SSO is available on the Enterprise plan and is configured by an organization admin.",
    "account/password-reset#0": "Password reset links expire after 60 minutes. Users with SSO enabled must reset their password through their identity provider.",
    "data/retention#0": "Deleted projects are kept for 14 days and can be restored by an admin. After 14 days they are permanently erased, including from backups.",
}


class TfidfRetriever:
    def __init__(self, chunks: dict[str, str]) -> None:
        self.ids = list(chunks)
        counts = [Counter(tokenize(text)) for text in chunks.values()]
        df = Counter(term for doc in counts for term in doc)
        n = len(counts)
        self.idf = {term: math.log((1 + n) / (1 + freq)) + 1 for term, freq in df.items()}
        self.vectors = [self._weigh(doc) for doc in counts]

    def _weigh(self, counts: Counter) -> dict[str, float]:
        vector = {term: count * self.idf.get(term, 0.0) for term, count in counts.items()}
        norm = math.sqrt(sum(value * value for value in vector.values())) or 1.0
        return {term: value / norm for term, value in vector.items()}

    def search(self, query: str, k: int = 5) -> list[str]:
        query_vector = self._weigh(Counter(tokenize(query)))
        scored = []
        for position, (chunk_id, vector) in enumerate(zip(self.ids, self.vectors)):
            score = sum(weight * vector.get(term, 0.0) for term, weight in query_vector.items())
            if score > 0:
                scored.append((-score, position, chunk_id))
        return [chunk_id for _, _, chunk_id in sorted(scored)[:k]]
```

O retriever é simples de propósito. O que importa é a interface: `search(query, k)` devolve uma lista ranqueada de ids de chunks. Seu retriever de verdade (vector store, BM25 ou um híbrido como o de [Hybrid Search That Actually Works: BM25 + Vectors with Reciprocal Rank Fusion](/pt-br/blog/hybrid-search-bm25-vectors-rrf/)) só precisa de um adaptador fino com a mesma assinatura para se encaixar em tudo o que vem a seguir.

### O golden set

```json title="golden/v1.jsonl"
{"id": "q001", "question": "Can I get a refund on an annual plan?", "expected_chunk_ids": ["billing/refunds#0"], "source": "logs"}
{"id": "q002", "question": "Is a monthly subscription refundable if I cancel?", "expected_chunk_ids": ["billing/refunds#1"], "source": "logs"}
{"id": "q003", "question": "Which plans have refunds?", "expected_chunk_ids": ["billing/refunds#0", "billing/refunds#1"], "source": "sme"}
{"id": "q004", "question": "How many API requests can I send per minute?", "expected_chunk_ids": ["api/rate-limits#0"], "source": "sme"}
{"id": "q005", "question": "Why am I getting HTTP 429 errors?", "expected_chunk_ids": ["api/rate-limits#0"], "source": "logs"}
{"id": "q006", "question": "How do I check the webhook signature?", "expected_chunk_ids": ["api/webhooks#0"], "source": "synthetic_reviewed"}
{"id": "q007", "question": "Does single sign-on work with SAML?", "expected_chunk_ids": ["account/sso#0"], "source": "synthetic_reviewed"}
{"id": "q008", "question": "My password reset link stopped working", "expected_chunk_ids": ["account/password-reset#0"], "source": "logs"}
{"id": "q009", "question": "Can an admin restore a deleted project?", "expected_chunk_ids": ["data/retention#0"], "source": "sme"}
{"id": "q010", "question": "Where can I download my invoices?", "expected_chunk_ids": ["billing/invoices#0"], "source": "synthetic_reviewed"}
{"id": "q011", "question": "How do I get my money back?", "expected_chunk_ids": ["billing/refunds#0"], "source": "logs"}
```

Repare no `q003`, cuja resposta precisa de dois chunks, e no `q011`, uma formulação de usuário real que não compartilha nenhuma palavra com o chunk de reembolso. Um conjunto de testes sem casos difíceis só confirma o que você já sabe.

### Carregando e validando

```python title="dataset.py"
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

ALLOWED_SOURCES = {"logs", "sme", "synthetic_reviewed"}


@dataclass(frozen=True)
class GoldenQuestion:
    id: str
    question: str
    expected_chunk_ids: frozenset[str]
    source: str


@dataclass(frozen=True)
class GoldenSet:
    version: str
    sha256: str
    questions: list[GoldenQuestion]


def load_golden_set(path: Path, known_chunk_ids: set[str]) -> GoldenSet:
    raw = path.read_bytes()
    questions: list[GoldenQuestion] = []
    seen: set[str] = set()
    for line_no, line in enumerate(raw.decode("utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        row = json.loads(line)
        q = GoldenQuestion(row["id"], row["question"], frozenset(row["expected_chunk_ids"]), row["source"])
        problems = []
        if q.id in seen:
            problems.append("duplicate id")
        if not q.expected_chunk_ids:
            problems.append("no expected chunks")
        # Refazer o chunking renomeia ids; falhe alto em vez de avaliar contra chunks que não existem mais
        unknown = q.expected_chunk_ids - known_chunk_ids
        if unknown:
            problems.append(f"unknown chunk ids {sorted(unknown)}")
        if q.source not in ALLOWED_SOURCES:
            problems.append(f"unknown source {q.source!r}")
        if problems:
            raise ValueError(f"{path.name}:{line_no} ({q.id}): {'; '.join(problems)}")
        seen.add(q.id)
        questions.append(q)
    return GoldenSet(version=path.stem, sha256=hashlib.sha256(raw).hexdigest()[:12], questions=questions)
```

A versão vem do nome do arquivo e o hash dos seus bytes, então todo relatório consegue dizer exatamente qual dataset o produziu.

### Métricas de retrieval

```python title="metrics.py"
from collections import defaultdict
from dataclasses import dataclass
from statistics import mean
from typing import Callable

from dataset import GoldenSet

SearchFn = Callable[[str, int], list[str]]


def recall_at_k(retrieved: list[str], relevant: frozenset[str], k: int) -> float:
    return len(set(retrieved[:k]) & relevant) / len(relevant)


def hit_at_k(retrieved: list[str], relevant: frozenset[str], k: int) -> float:
    return 1.0 if set(retrieved[:k]) & relevant else 0.0


def reciprocal_rank(retrieved: list[str], relevant: frozenset[str]) -> float:
    for rank, chunk_id in enumerate(retrieved, start=1):
        if chunk_id in relevant:
            return 1.0 / rank
    return 0.0


@dataclass(frozen=True)
class RetrievalReport:
    k: int
    recall: float
    hit_rate: float
    mrr: float
    misses: list[str]
    recall_by_source: dict[str, float]


def evaluate_retrieval(golden: GoldenSet, search: SearchFn, k: int = 3) -> RetrievalReport:
    recalls, hits, ranks, misses = [], [], [], []
    by_source: dict[str, list[float]] = defaultdict(list)
    for q in golden.questions:
        retrieved = search(q.question, k)
        recall = recall_at_k(retrieved, q.expected_chunk_ids, k)
        recalls.append(recall)
        hits.append(hit_at_k(retrieved, q.expected_chunk_ids, k))
        ranks.append(reciprocal_rank(retrieved[:k], q.expected_chunk_ids))
        by_source[q.source].append(recall)
        if recall < 1.0:
            misses.append(f"{q.id}: expected {sorted(q.expected_chunk_ids)}, got {retrieved}")
    return RetrievalReport(
        k=k,
        recall=round(mean(recalls), 3),
        hit_rate=round(mean(hits), 3),
        mrr=round(mean(ranks), 3),
        misses=misses,
        recall_by_source={source: round(mean(values), 3) for source, values in sorted(by_source.items())},
    )
```

A lista `misses` é tão importante quanto as médias. Quando o gate falha, a primeira coisa que você quer saber é quais perguntas regrediram e o que voltou no lugar.

```python title="report.py"
import json
from dataclasses import asdict
from pathlib import Path

from dataset import load_golden_set
from metrics import evaluate_retrieval
from retriever import CHUNKS, TfidfRetriever

if __name__ == "__main__":
    golden = load_golden_set(Path(__file__).parent / "golden" / "v1.jsonl", set(CHUNKS))
    report = evaluate_retrieval(golden, TfidfRetriever(CHUNKS).search, k=3)
    print(json.dumps({"dataset": golden.version, "sha256": golden.sha256, **asdict(report)}, indent=2))
```

Neste corpus, `python report.py` mostra recall@3 de 0.909 com um único miss: o `q011`, a pergunta do dinheiro de volta, para a qual o TF-IDF não devolve nada porque nenhuma palavra coincide. O detalhamento por fonte mostra que a fatia vinda dos logs é a que cai, enquanto a sintética continua perfeita. É o efeito das perguntas sintéticas fáceis em miniatura (numa amostra tão pequena, uma pergunta mexe muito numa fatia).

### Fidelidade, do jeito determinístico

```python title="faithfulness.py"
import re
from dataclasses import dataclass

from retriever import tokenize

SENTENCE_END = re.compile(r"(?<=[.!?])\s+")
NUMBER = re.compile(r"\d+(?:\.\d+)?")


@dataclass(frozen=True)
class ClaimCheck:
    claim: str
    support: float
    missing_numbers: tuple[str, ...]
    supported: bool


@dataclass(frozen=True)
class FaithfulnessReport:
    score: float
    claims: list[ClaimCheck]

    @property
    def unsupported(self) -> list[str]:
        return [c.claim for c in self.claims if not c.supported]


def split_claims(answer: str) -> list[str]:
    return [s.strip() for s in SENTENCE_END.split(answer.strip()) if s.strip()]


def check_faithfulness(answer: str, contexts: list[str], min_support: float = 0.6) -> FaithfulnessReport:
    context_text = " ".join(contexts)
    context_tokens = set(tokenize(context_text))
    context_numbers = set(NUMBER.findall(context_text))
    checks = []
    for claim in split_claims(answer):
        tokens = set(tokenize(claim))
        support = len(tokens & context_tokens) / len(tokens) if tokens else 1.0
        # Um número que o contexto nunca menciona é a alucinação mais barata de pegar
        missing = tuple(sorted(set(NUMBER.findall(claim)) - context_numbers))
        checks.append(ClaimCheck(claim, round(support, 3), missing, support >= min_support and not missing))
    # Uma resposta vazia é uma falha de geração, não uma resposta perfeitamente fiel
    score = sum(c.supported for c in checks) / len(checks) if checks else 0.0
    return FaithfulnessReport(score=round(score, 3), claims=checks)
```

Tenha clareza sobre os limites. Sobreposição de palavras não enxerga negação: "monthly plans are refundable" compartilha quase todas as palavras com "monthly plans are not refundable" e passa. Ela também pune paráfrases fortes. Trate-a como um detector de fumaça para fatos inventados, não como medida de verdade.

### Um LLM judge opcional

```python title="judge.py"
import importlib
import json
import os
from dataclasses import dataclass
from statistics import mean
from typing import Callable

Complete = Callable[[str, str], str]  # (model, prompt) -> texto bruto do modelo

PROMPT = """You check whether an answer is grounded in the provided context.
For each numbered claim, answer true only if the context directly supports it.
Reply with JSON only, one boolean per claim: {{"verdicts": [true, false]}}

Context:
{context}

Claims:
{claims}
"""


@dataclass(frozen=True)
class JudgeResult:
    verdicts: list[bool]
    agreement: float
    valid_samples: int


class LLMJudge:
    def __init__(self, complete: Complete, model: str, samples: int = 3) -> None:
        if samples < 1:
            raise ValueError("samples must be at least 1")
        self.complete = complete
        self.model = model
        self.samples = samples

    def judge(self, claims: list[str], contexts: list[str]) -> JudgeResult:
        prompt = PROMPT.format(
            context="\n\n".join(contexts),
            claims="\n".join(f"{i}. {claim}" for i, claim in enumerate(claims, start=1)),
        )
        runs = []
        for _ in range(self.samples):
            parsed = self._parse(self.complete(self.model, prompt), len(claims))
            if parsed is not None:
                runs.append(parsed)
        if not runs:
            raise RuntimeError("judge returned no parseable verdicts")
        verdicts, agreement = [], []
        for i in range(len(claims)):
            yes = sum(run[i] for run in runs)
            # Empate conta como não sustentado: o judge não chegar a um acordo não é evidência de grounding
            verdicts.append(yes * 2 > len(runs))
            agreement.append(max(yes, len(runs) - yes) / len(runs))
        return JudgeResult(verdicts, round(mean(agreement), 3), len(runs))

    @staticmethod
    def _parse(text: str, expected: int) -> list[bool] | None:
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end <= start:
            return None
        try:
            verdicts = json.loads(text[start : end + 1]).get("verdicts")
        except (json.JSONDecodeError, AttributeError):
            return None
        if not isinstance(verdicts, list) or len(verdicts) != expected:
            return None
        if not all(isinstance(v, bool) for v in verdicts):
            return None
        return verdicts


def load_judge_from_env(samples: int = 3) -> LLMJudge | None:
    model = os.environ.get("RAG_EVAL_JUDGE_MODEL")
    target = os.environ.get("RAG_EVAL_JUDGE_CLIENT")  # "package.module:function"
    if not model or not target:
        return None
    module_name, _, function_name = target.partition(":")
    complete = getattr(importlib.import_module(module_name), function_name)
    return LLMJudge(complete, model, samples)
```

O judge não sabe nada sobre provedor nenhum. Você escreve uma função, `complete(model, prompt) -> str`, com o seu SDK (temperatura 0, versão do modelo fixada), e aponta `RAG_EVAL_JUDGE_CLIENT` para ela. O nome do modelo vem de `RAG_EVAL_JUDGE_MODEL`, então trocar o judge vira uma mudança de configuração visível, não uma edição de código. Cada chamada é amostrada várias vezes: a maioria decide, e `agreement` registra o quanto as amostras concordaram.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Se o judge entende paráfrase e negação, para que manter a checagem de sobreposição de palavras? É só usar o judge para tudo.</span>
    </div>
  </div>
</div>

Porque um gate que às vezes falha com o código inalterado ensina o time a clicar em "re-run" até ficar verde, e aí ele não protege mais nada. A checagem determinística dá sempre a mesma resposta, não custa nada e funciona sem rede nem chave de API, então pode bloquear um pull request. O judge é mais esperto e mais ruidoso, então ganha outro trabalho: execuções agendadas, linhas de tendência e verificações pontuais, onde um veredito estranho é um dado, não um merge bloqueado.

### O gate no CI

```python title="test_rag_eval.py"
from pathlib import Path
from statistics import mean

import pytest

from dataset import load_golden_set
from faithfulness import check_faithfulness, split_claims
from judge import LLMJudge, load_judge_from_env
from metrics import evaluate_retrieval, recall_at_k, reciprocal_rank
from retriever import CHUNKS, TfidfRetriever

GOLDEN_PATH = Path(__file__).parent / "golden" / "v1.jsonl"
K = 3
THRESHOLDS = {"recall": 0.85, "mrr": 0.8, "faithfulness": 0.95}
LIVE_JUDGE = load_judge_from_env()


@pytest.fixture(scope="module")
def golden():
    return load_golden_set(GOLDEN_PATH, set(CHUNKS))


@pytest.fixture(scope="module")
def retriever():
    return TfidfRetriever(CHUNKS)


def fake_generate(question: str, contexts: list[str]) -> str:
    # Substituto da chamada ao LLM para o gate rodar offline: responde com a primeira frase do chunk do topo
    return split_claims(contexts[0])[0]


def test_metric_math():
    assert recall_at_k(["a", "b", "c"], frozenset({"b", "x"}), k=2) == 0.5
    assert reciprocal_rank(["a", "b"], frozenset({"b"})) == 0.5
    assert reciprocal_rank(["a"], frozenset({"z"})) == 0.0


def test_retrieval_meets_thresholds(golden, retriever):
    report = evaluate_retrieval(golden, retriever.search, k=K)
    context = f"dataset {golden.version} ({golden.sha256}), misses: {report.misses}"
    assert report.recall >= THRESHOLDS["recall"], f"recall@{K} = {report.recall}; {context}"
    assert report.mrr >= THRESHOLDS["mrr"], f"MRR@{K} = {report.mrr}; {context}"


def test_answers_are_grounded(golden, retriever):
    scores, failures = [], []
    for q in golden.questions:
        contexts = [CHUNKS[chunk_id] for chunk_id in retriever.search(q.question, K)]
        if not contexts:
            continue  # um miss de retrieval, já contado pelo gate de retrieval
        report = check_faithfulness(fake_generate(q.question, contexts), contexts)
        scores.append(report.score)
        failures += [f"{q.id}: {claim}" for claim in report.unsupported]
    assert mean(scores) >= THRESHOLDS["faithfulness"], f"unsupported claims: {failures}"


def test_faithfulness_flags_invented_facts():
    context = [CHUNKS["billing/refunds#0"]]
    wrong_number = check_faithfulness("Annual plans can be refunded in full within 90 days of purchase.", context)
    assert wrong_number.claims[0].missing_numbers == ("90",)
    off_topic = check_faithfulness("Refunds are sent as store credit to your crypto wallet.", context)
    assert off_topic.unsupported == ["Refunds are sent as store credit to your crypto wallet."]


def test_judge_majority_vote_and_agreement():
    replies = iter(['{"verdicts": [true, false]}', 'Sure! {"verdicts": [true, true]}', "not json"])
    judge = LLMJudge(lambda model, prompt: next(replies), model="fake-judge", samples=3)
    result = judge.judge(["claim one", "claim two"], ["some context"])
    assert result.valid_samples == 2
    assert result.verdicts == [True, False]  # o empate de 1 a 1 na segunda afirmação conta como não sustentado
    assert result.agreement == 0.75


@pytest.mark.skipif(LIVE_JUDGE is None, reason="set RAG_EVAL_JUDGE_MODEL and RAG_EVAL_JUDGE_CLIENT")
def test_live_judge_confirms_grounding(golden, retriever):
    for q in golden.questions[:3]:
        contexts = [CHUNKS[chunk_id] for chunk_id in retriever.search(q.question, K)]
        claims = split_claims(fake_generate(q.question, contexts))
        result = LIVE_JUDGE.judge(claims, contexts)
        assert all(result.verdicts), f"{q.id}: judge rejected a claim (agreement {result.agreement})"
```

Algumas decisões de design:

- **Retrieval e fidelidade são testes separados.** O teste de fidelidade pula os misses de retrieval em vez de contá-los duas vezes, então cada falha aponta para uma camada só.
- **As mensagens de falha carregam a evidência**: versão do dataset, hash e as perguntas que erraram.
- **`fake_generate` é a costura.** Num projeto real, ele chama o seu pipeline de geração. Por ser extrativo, deixa a fidelidade trivialmente alta aqui; o teste com fatos inventados prova que a checagem consegue falhar.
- **O teste com o judge real se pula sozinho**, a menos que as duas variáveis de ambiente estejam definidas.

```bash title="terminal"
pytest -q -rs
python report.py > eval-report.json
```

Offline, isso dá cinco testes aprovados e um pulado (o do judge real). Com as duas variáveis apontando para um cliente funcional, o sexto teste também roda.

<div class="callout tip" data-title="Dica">
  <p>Defina cada threshold um pouco abaixo do que você mediu hoje, não numa meta aspiracional. O gate existe para pegar regressões. Quando uma mudança melhora os números de verdade, suba o threshold no mesmo pull request, para que a qualidade só possa subir, como uma catraca.</p>
</div>

```yaml title=".github/workflows/rag-eval.yml"
name: rag-eval

on:
  pull_request:
  schedule:
    - cron: "0 3 * * *"

jobs:
  gate:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install pytest
      - run: pytest -q -rs
      - run: python report.py > eval-report.json
        if: always()
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: eval-report
          path: eval-report.json

  nightly-judge:
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    env:
      RAG_EVAL_JUDGE_MODEL: ${{ vars.RAG_EVAL_JUDGE_MODEL }}
      RAG_EVAL_JUDGE_CLIENT: ${{ vars.RAG_EVAL_JUDGE_CLIENT }}
      LLM_API_KEY: ${{ secrets.LLM_API_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install pytest  # mais o SDK que a sua função complete() usa
      - run: pytest -q -rs -k live_judge
```

O workflow supõe que os arquivos ficam na raiz do repositório. Pull requests rodam o gate determinístico e publicam o relatório JSON mesmo quando falham. O judge roda toda noite, com o nome do modelo nas variáveis do repositório e a chave nos secrets.

## Checagem de realidade em produção

O exemplo tem onze perguntas e um retriever de brinquedo. Veja o que muda num sistema real.

### Notas de judge oscilam, então meça a oscilação

LLM judges não são instrumentos estáveis. A saída pode variar entre chamadas idênticas mesmo com temperatura 0, provedores atualizam modelos por trás do mesmo nome, e judges têm vieses conhecidos, como favorecer respostas mais longas e confiantes ou se deixar levar pela ordem do material no prompt. Defesas: fixe uma versão explícita do modelo pela variável de ambiente, amostre várias vezes e fique com a maioria, confira o judge contra um pequeno conjunto de afirmações rotuladas por humanos sempre que trocar o modelo ou o prompt dele, e acompanhe o `agreement` ao longo do tempo. Concordância caindo significa que o judge ficou menos seguro.

<div class="callout warning" data-title="Atenção">
  <p>Nunca compare notas de judges com modelos ou versões de prompt diferentes como se fossem a mesma métrica. Trocar o judge troca a régua. Registre a configuração do judge junto de cada nota e refaça o baseline quando ela mudar.</p>
</div>

### Datasets pequenos andam aos saltos

Com onze perguntas, um único miss mexe o recall em cerca de nove pontos, então thresholds em conjuntos minúsculos ou são frouxos ou oscilam. Cresça o conjunto rumo a algumas centenas de perguntas, priorizando tráfego real e falhas conhecidas, e busque cobertura de tipos de pergunta (identificadores, respostas em vários chunks, paráfrases, perguntas que o corpus não responde) em vez de volume bruto. Reporte métricas por fatia, porque uma média esconde uma fatia que desabou.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Nosso recall está em 0.91. Por que não colocar o threshold em 1.0 e obrigar o time a consertar tudo?</span>
    </div>
  </div>
</div>

Porque o build falharia no primeiro dia e continuaria vermelho, e uma checagem permanentemente vermelha acaba ignorada ou desligada. Alguns misses são conhecidos e aceitos por enquanto (a pergunta do dinheiro de volta precisa de retrieval semântico, o que é um projeto, não um bugfix). Acompanhe-os como misses nomeados e deixe que melhorias reais subam o threshold.

### Mantenha o dataset vivo

Um golden set apodrece. Documentos são reescritos, chunks são refeitos. A validação ao carregar pega ids renomeados, mas um id de chunk pode sobreviver enquanto o texto dele deixa de responder a pergunta, então mudanças de conteúdo precisam de revisão. Transforme isso em rotina: quando um bug report revelar uma resposta ruim, adicione aquela pergunta à próxima versão do dataset. Com o tempo, o conjunto vira um registro de todas as formas como o sistema já falhou, que é exatamente o que uma suíte de regressão deve ser.

### Custo e velocidade

Avaliar o retrieval contra um vector store real leva segundos para centenas de perguntas e merece rodar em todo pull request. Geração mais judge custa tokens e minutos, então rode isso toda noite e faça cache das respostas indexadas por pergunta, ids dos chunks recuperados e versão do prompt.

Nada disso é novo: entradas fixas, expectativas conhecidas, checagens determinísticas a cada mudança e checagens mais lentas e ruidosas de forma agendada. A única regra específica de RAG é testar as duas camadas separadamente, porque "a resposta saiu errada" é um sintoma, e o trabalho do golden set é dizer qual camada o causou.
