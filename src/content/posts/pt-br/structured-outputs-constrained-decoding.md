---
title: "Structured outputs por dentro: como funciona o decoding com restrição"
description: "Como o decoding restrito por gramática mascara logits para forçar JSON válido, construído do zero em Python, e as falhas que um schema não pega."
date: 2026-07-16
tags: [LLMs, Structured Outputs, Python, Pydantic]
tldr:
  - "O decoding com restrição compila seu schema em um autômato e, a cada passo, coloca menos infinito nos logits dos tokens que o quebrariam, então o modelo só consegue escolher continuações válidas."
  - "Ele garante sintaxe, não significado: quando a gramática bloqueia o que o modelo queria dizer, o modelo diz a coisa válida mais provável, que pode ser válida e errada."
  - "Continue validando: confira por que a geração parou, rode o Pydantic para as restrições que a gramática ignorou, adicione checagens semânticas e só faça retry quando o retry mudar alguma coisa."
---

Um job de extração lê contratos e devolve JSON com as partes, a data de início e o prazo de aviso prévio para rescisão, em dias. Ele rodou por meses com "responda apenas com JSON" mais uma regex, e algumas respostas por dia ainda falhavam no parse. Aí o time ligou structured outputs em modo estrito. Os erros de parse foram a zero e o código de retry foi apagado.

Algumas semanas depois, alguém do jurídico reparou que contratos dizendo "aviso prévio de noventa (90) dias" e contratos dizendo "aviso conforme o Anexo II" voltavam, os dois, com um número. O primeiro estava certo. O segundo era inventado: o schema dizia `notice_days: integer`, o campo era obrigatório e o modelo não tinha outro lugar para ir. O JSON era perfeito; os dados, não. Este post explica como as duas coisas podem ser verdade ao mesmo tempo: o que o decoding com restrição faz a cada passo, como os motores o deixam rápido e o que ele não consegue prometer, com um decoder minúsculo construído do zero.

## O problema e o contexto

Pedir no prompt ("responda apenas com JSON") funciona na maioria das vezes, o que é uma péssima propriedade para um parser: o modelo adiciona um preâmbulo, um bloco de Markdown, aspas simples. O JSON mode garantia que a saída passava no parse, não o formato dela. Hoje todo grande provedor e todo motor de inferência sério oferece geração restrita por schema: os [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) da OpenAI (`strict: true` num formato JSON schema ou numa função), os [structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) da Anthropic (JSON outputs via `output_config.format`, mais strict tool use), o campo `structured_outputs` do vLLM, as gramáticas do llama.cpp e bibliotecas como o Outlines. A promessa é a mesma em todo lugar: a saída vai bater com o seu schema.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Então com o modo estrito ligado eu posso apagar meu código de validação. A documentação da OpenAI diz literalmente que não precisa validar nem fazer retry de respostas mal formatadas.</span>
    </div>
  </div>
</div>

Leia de novo: *mal formatadas*. A garantia é sobre formato, e a mesma documentação lista onde até o formato quebra: a resposta é cortada no limite de tokens, ou o modelo recusa e a recusa passa por cima do schema. A Anthropic acrescenta que valores de enum em string podem voltar com maiúsculas e minúsculas diferentes. A [documentação do Gemini](https://ai.google.dev/gemini-api/docs/structured-output) diz com todas as letras: trate saídas "schema-compliant but semantically incorrect", de acordo com o schema e semanticamente erradas. O decoding com restrição elimina a classe sintática de falhas, e elimina perfeitamente. Todo o resto continua sendo seu.

## Mergulho na arquitetura

### Decodificar é escolher num vetor de notas

A cada passo, o modelo recebe o prompt mais tudo o que já foi gerado e produz uma nota, um logit, para cada token do vocabulário: uns 50.000 no GPT-2, bem mais de 100.000 nos modelos atuais. Um sampler escolhe um (argmax, ou softmax com temperatura e um sorteio), o token é anexado e o ciclo roda de novo.

O decoding com restrição intervém no único ponto possível sem mexer no modelo: entre os logits e o sampler. Ele pergunta à gramática quais tokens são válidos a seguir e coloca menos infinito em todos os outros logits, que ficam com probabilidade zero. O modelo continua fazendo todo o ranking; a gramática só tira opções da mesa.

<div id="soc-decode-step-slot"></div>

A saída é válida por construção: todo prefixo era válido quando foi estendido, e o fim de sequência só é permitido num estado de aceitação. Entre os tokens válidos, as preferências do modelo ficam intactas; o comportamento interessante aparece quando o que ele queria é inválido.

### Do JSON Schema a um autômato

A referência clássica é o [Efficient Guided Generation for Large Language Models](https://arxiv.org/abs/2307.09702) (2023), de Willard e Louf, o artigo por trás do Outlines: gerar sob uma expressão regular é caminhar por uma máquina de estados finitos (FSM), e dá para pré-calcular, para cada estado, os tokens do vocabulário que mantêm a caminhada viva. Um schema plano (uma string `name` e um inteiro `age`, nessa ordem) vira mais ou menos a regex `\{"name":"[^"\\]*","age":-?(0|[1-9][0-9]*)\}`, cujo DFA tem um número finito de estados, então o pré-cálculo termina.

O aninhamento quebra isso. JSON com profundidade arbitrária não é uma linguagem regular; casar chaves exige uma pilha. A gramática vira livre de contexto e o autômato vira um autômato de pilha (PDA), cujas configurações não dá para enumerar todas de antemão. Esse fato sozinho explica a maior parte das diferenças entre os motores.

<div id="soc-compile-pipeline-slot"></div>

### O problema do alinhamento com o tokenizer

Gramáticas são escritas sobre caracteres; modelos emitem tokens de vários caracteres que ignoram as fronteiras da sua gramática. O token `": "` contém o fim de uma chave, dois-pontos, um espaço e a aspa que abre uma string: quatro eventos da gramática. Por isso o motor confere um token passando cada caractere pelo autômato, e o token só é válido se todos forem.

Mais sutil: o modelo foi treinado com o split canônico do tokenizer, e a gramática não se importa com o split que recebe, então pode empurrar o modelo para um que ele nunca viu, como `{` seguido de `"` em vez de `{"`. Beurer-Kellner, Fischer e Vechev mostram em [Guiding LLMs The Right Way](https://arxiv.org/abs/2403.06988) (2024) que decoders que não se alinham ao vocabulário de subpalavras podem prejudicar bastante a acurácia. O modelo de brinquedo abaixo faz exatamente isso.

### Deixando a máscara barata

A máscara ingênua passa o vocabulário inteiro pelo autômato a cada passo, lento demais para rodar entre forward passes. Os motores evitam isso de jeitos diferentes:

- **Outlines** monta um índice de cada estado do DFA para os tokens permitidos e os próximos estados (hoje na biblioteca em Rust [outlines-core](https://github.com/dottxt-ai/outlines-core)). O decoding vira uma consulta; o custo vai para a compilação.
- **XGrammar** ([Dong et al., 2024](https://arxiv.org/abs/2411.15100)) roda um PDA, pré-confere e guarda em cache os tokens independentes de contexto por posição e só confere os poucos dependentes de contexto contra uma pilha persistente em tempo de execução. O artigo relata ganhos de até 100x sobre soluções anteriores.
- **llguidance** ([guidance-ai/llguidance](https://github.com/guidance-ai/llguidance)) dispensa o pré-cálculo pesado: um parser de Earley calcula cada máscara na hora, uns 50 microssegundos de CPU para um vocabulário de 128k segundo o README, que lista os Structured Outputs da OpenAI, o vLLM, o SGLang e o llama.cpp entre os usuários.
- **llama.cpp** usa [GBNF](https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md), um BNF com extensões parecidas com regex, e converte JSON Schema para ele. O README é honesto: `minimum`/`maximum` só funcionam para inteiros, e `uniqueItems` ou `if`/`then` não têm como ser expressos.

O [JSONSchemaBench](https://arxiv.org/abs/2501.10868) (Geng et al., 2025) testou seis frameworks, OpenAI e Gemini inclusos, em 10.000 schemas do mundo real: a cobertura de palavras-chave varia muito, e "suporta JSON Schema" nunca quer dizer tudo.

### O que os provedores entregam

APIs gerenciadas escondem o motor, não as restrições dele. A **OpenAI** exige todo campo em `required` e `additionalProperties: false`, aceita até 5.000 propriedades, 10 níveis de aninhamento e 1.000 valores de enum, rejeita palavras-chave como `allOf` e `if`/`then`, e produz as chaves "in the same order as the ordering of keys in the schema", na mesma ordem do schema. A **Anthropic** compila os schemas em gramáticas guardadas em cache por 24 horas desde o último uso, não suporta schemas recursivos, limites numéricos nem tamanhos de string (os SDKs removem essas restrições, mencionam nas descrições e validam a resposta contra o seu schema original), limita cada requisição a 20 tools estritas, 24 parâmetros opcionais e 16 parâmetros com tipos union, e emite as propriedades obrigatórias antes das opcionais.

## Implementação na prática

O mecanismo inteiro em Python puro: um tokenizer, um modelo de brinquedo, uma máquina de estados compilada a partir de um schema do Pydantic, o loop com máscara, um índice e um loop de reparo. Tudo rodou em Python 3.14 com Pydantic 2.13.5, e toda saída foi copiada dessas execuções.

```bash title="terminal"
python -m venv .venv
.venv/Scripts/python -m pip install pydantic
```

### Um vocabulário com tokens de vários caracteres

Uma lista de merges escolhida a dedo, do tipo que o BPE aprende em texto cheio de JSON, mais todo caractere ASCII imprimível, para que qualquer string ainda possa ser soletrada:

```python title="constrained/tokenizer.py"
MERGED = [
    "Sure", " Here", " is", " the", " JSON", ":\n",
    '{"', '":', '": ', '": "', '", "', '"}', ", ",
    "name", "age", "Ada", " Lovelace", "Alan", " Turing", "Grace", " Hopper",
    "thirty", "-six", "41", "85", "36",
]
SINGLE = [chr(c) for c in range(32, 127)] + ["\n"]

VOCAB = list(dict.fromkeys(MERGED + SINGLE))
EOS = len(VOCAB)
VOCAB.append("<eos>")
TOKEN_ID = {text: i for i, text in enumerate(VOCAB)}
LONGEST = max(len(t) for t in VOCAB[:EOS])


def encode(text: str) -> list[int]:
    """Greedy longest match, like a BPE tokenizer's preferred split."""
    ids, i = [], 0
    while i < len(text):
        for size in range(min(LONGEST, len(text) - i), 0, -1):
            if text[i : i + size] in TOKEN_ID:
                ids.append(TOKEN_ID[text[i : i + size]])
                i += size
                break
        else:
            raise ValueError(f"no token for {text[i]!r}")
    return ids


def decode(ids: list[int]) -> str:
    return "".join(VOCAB[i] for i in ids if i != EOS)
```

São 123 tokens com o fim de sequência. Tokens como `": "` e `", "` atravessam fronteiras da gramática exatamente como os reais.

### Um modelo de brinquedo com manias

O decoder é o assunto, então o modelo é um substituto que dá para entender por completo. Ele tem uma resposta que quer dar, num formato tagarela, e duas outras respostas que já viu, incluindo o registro de Alan Turing. A cada passo, prefere tokens que continuam o sufixo mais longo do texto que ele reconhece, a própria resposta acima de tudo; o resto recebe nota pela frequência do token.

```python title="constrained/lm.py"
import math
from collections import Counter

from tokenizer import EOS, VOCAB, decode, encode

ANSWER = 'Sure! Here is the JSON:\n{"name": "Ada Lovelace", "age": "thirty-six"}'
HABITS = [
    'Here is the JSON:\n{"name": "Alan Turing", "age": 41}',
    "{'name': 'Grace Hopper', 'age': 85}",
]


class ToyLM:
    """A stand-in model with fixed habits. It wants to say ANSWER. When the text so far
    leaves that script, it realigns on the longest suffix it has seen in any document."""

    def __init__(self, answer=ANSWER, habits=HABITS):
        self.docs = [answer] + habits
        self.prior = Counter(tok for doc in self.docs for tok in encode(doc))

    def continuations(self, text: str) -> list[tuple[int, str]]:
        for k in range(len(text), 0, -1):
            found = [(d, doc[i + k :]) for d, doc in enumerate(self.docs)
                     for i in range(len(doc) - k + 1) if doc[i : i + k] == text[-k:]]
            if found:
                return found
        return [(d, doc) for d, doc in enumerate(self.docs)]

    def logits(self, prompt: str, out: list[int]) -> list[float]:
        # The prompt is ignored: this stand-in decided what it wants to say in advance.
        total = sum(self.prior.values()) + len(VOCAB)
        scores = [math.log((self.prior[tok] + 1) / total) for tok in range(len(VOCAB))]
        for doc, rest in self.continuations(decode(out)):
            bonus = 12.0 if doc == 0 else 8.0
            for tok, piece in enumerate(VOCAB[:EOS]):
                if rest.startswith(piece):
                    scores[tok] = max(scores[tok], bonus + len(piece) * 0.1)
            if rest == "":
                scores[EOS] = max(scores[EOS], bonus)
        return scores
```

Repare que o modelo sabe a idade certa. Ele só quer escrevê-la por extenso.

### A gramática: uma máquina de estados por caractere

A gramática compila o schema em segmentos: literais como `{` e `"name"`, um espaço opcional, uma string, um inteiro. Um estado é (índice do segmento, posição dentro dele), o que mantém a máquina finita. Quando um segmento não aceita um caractere mas já está completo, a máquina passa para o próximo e tenta de novo, e é assim que um inteiro termina quando aparece um `}`.

```python title="constrained/grammar.py"
from dataclasses import dataclass

from tokenizer import VOCAB

DIGITS = "0123456789"


@dataclass(frozen=True)
class Lit:
    text: str
    start = 0

    def step(self, s, ch):
        return s + 1 if s < len(self.text) and self.text[s] == ch else None

    def done(self, s):
        return s == len(self.text)


@dataclass(frozen=True)
class Space:
    """At most one space: an unbounded run lets a model pad with whitespace until max_tokens."""

    start = 0

    def step(self, s, ch):
        return 1 if s == 0 and ch == " " else None

    def done(self, s):
        return True


@dataclass(frozen=True)
class Str:
    start = "open"

    def step(self, s, ch):
        if s == "open":
            return "body" if ch == '"' else None
        if s == "body":
            if ch == '"':
                return "closed"
            return "body" if ch >= " " and ch != "\\" else None
        return None

    def done(self, s):
        return s == "closed"


@dataclass(frozen=True)
class Int:
    start = "sign"

    def step(self, s, ch):
        if s == "sign" and ch == "-":
            return "minus"
        if s in ("sign", "minus"):
            return "zero" if ch == "0" else "digits" if ch in DIGITS else None
        return "digits" if s == "digits" and ch in DIGITS else None

    def done(self, s):
        return s in ("zero", "digits")


SEGMENTS = {"string": Str, "integer": Int}


def compile_schema(schema: dict) -> tuple[list, list[str]]:
    """A flat object schema to a list of segments, plus the keywords it could not enforce."""
    segs, ignored = [Lit("{"), Space()], []
    for i, (key, prop) in enumerate(schema["properties"].items()):
        if i:
            segs += [Lit(","), Space()]
        segs += [Lit(f'"{key}"'), Space(), Lit(":"), Space(), SEGMENTS[prop["type"]]()]
        ignored += [f"{key}.{kw}" for kw in prop if kw not in ("type", "title")]
    return segs + [Space(), Lit("}")], ignored


class JsonMachine:
    """Character-level automaton. A state is (segment index, position inside it)."""

    def __init__(self, schema: dict):
        self.segs, self.ignored = compile_schema(schema)
        self.start = (0, self.segs[0].start)

    def step(self, state, ch):
        i, s = state
        while i < len(self.segs):
            nxt = self.segs[i].step(s, ch)
            if nxt is not None:
                return (i, nxt)
            if not self.segs[i].done(s):
                return None
            i += 1
            s = self.segs[i].start if i < len(self.segs) else None
        return None

    def accepting(self, state):
        i, s = state
        return self.segs[i].done(s) and all(seg.done(seg.start) for seg in self.segs[i + 1 :])

    def walk(self, state, text):
        for ch in text:
            state = self.step(state, ch)
            if state is None:
                return None
        return state

    def allowed(self, state, vocab=VOCAB) -> dict[int, tuple]:
        """Token id to the state after it. Scans the whole vocabulary: the naive way.
        The last vocabulary entry is end of sequence."""
        nxt = {}
        for tok, text in enumerate(vocab[:-1]):
            after = self.walk(state, text)
            if after is not None:
                nxt[tok] = after
        if self.accepting(state):
            nxt[len(vocab) - 1] = state
        return nxt
```

O `walk` é a correção do alinhamento num método só: `": "` é conferido como quatro eventos da gramática. O `compile_schema` também registra as palavras-chave que não conseguiu impor, o que vai importar mais adiante. Compiladores de verdade adicionam aninhamento, arrays, enums e escapes.

### O loop de decoding

Decoding guloso com máscara opcional: consulta (ou varre) os tokens permitidos, coloca menos infinito no resto e escolhe o melhor sobrevivente. O `trace` imprime o que o modelo queria sempre que a gramática o contrariou. A função devolve o texto, um motivo de parada (`stop` ou `length`, como toda API) e os ids dos tokens.

```python title="constrained/decode.py"
import math

from tokenizer import EOS, VOCAB, decode


def generate(lm, prompt, machine=None, index=None, max_tokens=40, trace=False):
    """Greedy decoding. With a machine, every step masks the tokens the grammar rejects."""
    out, state = [], machine.start if machine else None
    for _ in range(max_tokens):
        raw = lm.logits(prompt, out)
        logits = raw
        if machine:
            allowed = index[state] if index is not None else machine.allowed(state)
            logits = [x if tok in allowed else -math.inf for tok, x in enumerate(raw)]
        tok = max(range(len(logits)), key=logits.__getitem__)
        if trace:
            wanted = max(range(len(raw)), key=raw.__getitem__)
            note = f"  wanted {VOCAB[wanted]!r}" if wanted != tok else ""
            count = len(allowed) if machine else "-"
            print(f"{len(out):>2}  {VOCAB[tok]!r:<13} allowed={count:<4}{note}")
        if tok == EOS:
            return decode(out), "stop", out
        out.append(tok)
        if machine:
            state = allowed[tok]
    return decode(out), "length", out
```

### Sem restrição vs com restrição

```python title="constrained/demo.py"
import json

from pydantic import BaseModel

from decode import generate
from grammar import JsonMachine
from index import build_index
from lm import ToyLM
from tokenizer import VOCAB, encode


class Person(BaseModel):
    name: str
    age: int


lm = ToyLM()
prompt = "Extract name and age as JSON: Ada Lovelace was thirty-six when she died."

text, finish, _ = generate(lm, prompt)
print(f"unconstrained, finish={finish}\n{text}")
try:
    json.loads(text)
except json.JSONDecodeError as err:
    print(f"json.loads: {err}\n")

machine = JsonMachine(Person.model_json_schema())
index = build_index(machine)
print(f"index: {len(index)} states, vocabulary of {len(VOCAB)}\n")
text, finish, ids = generate(lm, prompt, machine, index, trace=True)
print(f"\nconstrained, finish={finish}\n{text}")
print("json.loads:", json.loads(text))
print("generated:", [VOCAB[i] for i in ids[:4]])
print("canonical:", [VOCAB[i] for i in encode(text)[:4]])
```

```bash title="terminal"
$ python demo.py
unconstrained, finish=stop
Sure! Here is the JSON:
{"name": "Ada Lovelace", "age": "thirty-six"}
json.loads: Expecting value: line 1 column 1 (char 0)

index: 29 states, vocabulary of 123

 0  '{'           allowed=2     wanted 'Sure'
 1  '"'           allowed=2
 2  'name'        allowed=2
 3  '": "'        allowed=4
 4  'Ada'         allowed=115
 5  ' Lovelace'   allowed=115
 6  '", "'        allowed=115
 7  'age'         allowed=2
 8  '": '         allowed=3     wanted '": "'
 9  '41'          allowed=14    wanted '"'
10  '}'           allowed=15
11  '<eos>'       allowed=1

constrained, finish=stop
{"name": "Ada Lovelace", "age": 41}
json.loads: {'name': 'Ada Lovelace', 'age': 41}
generated: ['{', '"', 'name', '": "']
canonical: ['{"', 'name', '": "', 'Ada']
```

Sem restrição: um preâmbulo que quebra o `json.loads` no caractere zero, e a idade como string. Com restrição, o trace concentra boa parte deste post:

- **Passo 0.** Ele queria `Sure`; só `{` e `{"` são válidos. Ele se realinhou na resposta de Grace Hopper com aspas simples, que começa com `{`, e pegou `{`. As duas últimas linhas da saída mostram o split não canônico.
- **Passos 4 a 6.** Dentro da string, 115 dos 123 tokens são válidos, e o modelo escreve `Ada Lovelace`.
- **Passo 8.** Ele queria `": "`, porque ia escrever `"thirty-six"`. Uma aspa é inválida para um inteiro, então ele recebeu `": `.
- **Passo 9.** Nada do que ele viu continua esse texto com um dígito, então ele recorre à frequência dos tokens: `41` e `85` são os únicos tokens numéricos nos documentos dele, com uma ocorrência cada, e `41` vence o empate porque vem primeiro no vocabulário. A idade foi decidida pela ordem dos tokens.
- **Passos 10 e 11.** Agora o texto termina em `": 41`, que ele viu no registro de Turing, então segue esse registro até o `}` e para.

O resultado passa no parse, bate com o schema e diz que Ada Lovelace morreu aos 41.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Então a gramática estragou o modelo. Ele sabia que a resposta era trinta e seis e a restrição fez ele dizer 41.</span>
    </div>
  </div>
</div>

A gramática fez o trabalho dela: tirou os tokens inválidos e deixou o ranking com o modelo. A continuação preferida era inválida, e a melhor continuação válida não tinha nada a ver com Ada Lovelace. Esse é o mecanismo por trás da "perda de qualidade sob restrição": você condiciona o modelo em um texto que ele não teria escrito. Quanto isso custa em modelos reais é assunto de debate. O [Let Me Speak Freely?](https://arxiv.org/abs/2408.02442) (Tam et al., 2024) relatou que restrições de formato mais rígidas pioram o raciocínio; o time do Outlines respondeu em [Say What You Mean](https://blog.dottxt.ai/say-what-you-mean.html) que a queda vinha dos prompts e da avaliação, não da estrutura. Minha leitura: o estrago se concentra onde o schema discorda de como o modelo quer expressar a resposta. Então faça os dois concordarem: descreva o formato no prompt também, dê nomes precisos aos campos e dê ao modelo uma saída quando o dado não existir.

### Pré-calculando o índice

O `allowed()` varre o vocabulário a cada passo. O `build_index` faz o que o Outlines faz: uma busca em largura a partir do estado inicial sobre todos os tokens, registrando, para cada estado alcançável, os tokens permitidos e para onde eles levam.

```python title="constrained/index.py"
from grammar import JsonMachine
from tokenizer import VOCAB


def build_index(machine: JsonMachine, vocab=VOCAB) -> dict[tuple, dict[int, tuple]]:
    """Every state reachable at a token boundary, mapped to {allowed token: next state}."""
    index, todo = {}, [machine.start]
    while todo:
        state = todo.pop()
        if state not in index:
            index[state] = machine.allowed(state, vocab)
            todo += [s for s in index[state].values() if s not in index]
    return index
```

Para ver o custo num tamanho realista, exportei as 50.257 strings de tokens do GPT-2 com `transformers` (um `tokenizer.decode([i])` por id, salvo como lista JSON) e rodei a mesma máquina sobre elas:

```python title="constrained/bench.py"
import json
import sys
import time

from pydantic import BaseModel

from grammar import JsonMachine
from index import build_index


class Person(BaseModel):
    name: str
    age: int


vocab = json.load(open(sys.argv[1], encoding="utf8")) + ["<eos>"]
machine = JsonMachine(Person.model_json_schema())

t0 = time.perf_counter()
index = build_index(machine, vocab)
build = time.perf_counter() - t0

states = list(index)
t0 = time.perf_counter()
for state in states:
    machine.allowed(state, vocab)
scan = (time.perf_counter() - t0) / len(states)

t0 = time.perf_counter()
for _ in range(1000):
    for state in states:
        index[state]
lookup = (time.perf_counter() - t0) / (1000 * len(states))

sizes = sorted((len(v), s) for s, v in index.items())
print(f"vocabulary: {len(vocab):,} tokens")
print(f"states at token boundaries: {len(index)}")
print(f"index build: {build:.2f} s, {sum(len(v) for v in index.values()):,} entries")
print(f"naive mask, one step: {scan * 1000:.1f} ms")
print(f"index lookup, one step: {lookup * 1e9:.0f} ns")
print(f"smallest allowed set: {sizes[0][0]} tokens at {sizes[0][1]}")
print(f"largest allowed set: {sizes[-1][0]:,} tokens at {sizes[-1][1]}")
```

```bash title="terminal"
$ python bench.py gpt2_vocab.json
vocabulary: 50,258 tokens
states at token boundaries: 29
index build: 1.51 s, 54,700 entries
naive mask, one step: 47.4 ms
index lookup, one step: 97 ns
smallest allowed set: 1 tokens at (1, 1)
largest allowed set: 50,122 tokens at (6, 'body')
```

É Python puro num notebook, então as proporções importam mais que os números. Varrer custa uns 47 ms por token, mais que um forward pass de um modelo pequeno na GPU. O índice transforma isso numa consulta a dicionário e joga o preço para a compilação, 1,5 segundo para dois campos: o aviso de "a primeira requisição com um schema novo é mais lenta" das documentações dos provedores, em miniatura.

Dentro de uma string, 50.122 dos 50.258 tokens são válidos, então essa máscara é quase toda de uns, e num schema aninhado o mesmo estado aparece sob muitas pilhas diferentes. É por isso que um índice puro de FSM para de escalar e o XGrammar separa o que a posição sozinha decide do que precisa da pilha. Motores reais aplicam a máscara como um bitmask num único kernel da GPU.

### Validar, depois reparar

O decoding com restrição entrega texto que passa no parse, não dados confiáveis. O modelo Pydantic que gerou o schema vira o portão, com as restrições que a gramática não conseguiu impor e uma checagem semântica que nenhuma gramática expressa: os valores precisam estar ancorados no texto de origem.

```python title="constrained/extract.py"
import re
from dataclasses import dataclass

from pydantic import BaseModel, ConfigDict, Field, ValidationError, ValidationInfo, model_validator

UNITS = "zero one two three four five six seven eight nine".split()
TENS = {"twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90}


def numbers_in(text: str) -> set[int]:
    """Digits and simple English number words (thirty-six) that appear in the text."""
    found = {int(d) for d in re.findall(r"\d+", text)}
    for tens, units in re.findall(r"\b(" + "|".join(TENS) + r")(?:-(\w+))?", text.lower()):
        found.add(TENS[tens] + (UNITS.index(units) if units in UNITS else 0))
    return found


class Person(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1)
    age: int = Field(ge=0, le=130)

    @model_validator(mode="after")
    def grounded_in_source(self, info: ValidationInfo) -> "Person":
        source = (info.context or {}).get("source", "")
        if self.name not in source:
            raise ValueError(f"name {self.name!r} does not appear in the source text")
        if self.age not in numbers_in(source):
            raise ValueError(f"age {self.age} is not stated in the source text")
        return self


@dataclass
class Failed:
    reason: str
    attempts: list[str]


def extract(source: str, generate, max_attempts: int = 4, budget: int = 8):
    prompt, seen, log = f"Extract name and age as JSON: {source}", set(), []
    for attempt in range(1, max_attempts + 1):
        raw, finish = generate(prompt, max_tokens=budget)
        log.append(raw)
        if finish == "length":
            print(f"attempt {attempt}: cut off at {budget} tokens: {raw!r}")
            budget *= 2
            continue
        if raw in seen:
            print(f"attempt {attempt}: same output as before, giving up")
            return Failed("repeated output", log)
        seen.add(raw)
        try:
            person = Person.model_validate_json(raw, context={"source": source})
        except ValidationError as err:
            problems = "; ".join(e["msg"] for e in err.errors())
            print(f"attempt {attempt}: {raw} rejected: {problems}")
            prompt += f"\nYour previous answer {raw} was rejected: {problems}. Fix it."
            continue
        print(f"attempt {attempt}: accepted {person!r}")
        return person
    return Failed("out of attempts", log)
```

Cada falha recebe uma resposta própria. Truncamento ganha um limite maior. Um erro de validação volta para o prompt, para que o retry tenha informação nova. Uma saída idêntica a uma já rejeitada encerra o loop, e o loop termina num `Failed` tipado, nunca num chute. O `generate` é qualquer callable; aqui ele embrulha o decoder de brinquedo com restrição:

```python title="constrained/run_extract.py"
from pydantic import ValidationError

from decode import generate
from extract import Person, extract
from grammar import JsonMachine
from index import build_index
from lm import ToyLM

source = "Ada Lovelace was thirty-six when she died."
machine = JsonMachine(Person.model_json_schema())
index = build_index(machine)
print("grammar could not enforce:", machine.ignored)

for raw in [
    'Sure! Here is the JSON:\n{"name": "Ada Lovelace", "age": "thirty-six"}',
    '{"name": "Ada Lovelace", "age": "thirty-six"}',
    '{"name": "", "age": 999}',
]:
    try:
        Person.model_validate_json(raw, context={"source": source})
    except ValidationError as err:
        print(" | ".join(e["msg"] for e in err.errors()))


def constrained(lm):
    def call(prompt, max_tokens):
        text, finish, _ = generate(lm, prompt, machine, index, max_tokens=max_tokens)
        return text, finish

    return call


print("\n# the toy model")
print(extract(source, constrained(ToyLM())))

print("\n# a toy that wants to write the age as digits")
print(repr(extract(source, constrained(ToyLM(answer='{"name": "Ada Lovelace", "age": 36}')))))
```

```bash title="terminal"
$ python run_extract.py
grammar could not enforce: ['name.minLength', 'age.maximum', 'age.minimum']
Invalid JSON: expected value at line 1 column 1
Input should be a valid integer, unable to parse string as an integer
String should have at least 1 character | Input should be less than or equal to 130

# the toy model
attempt 1: cut off at 8 tokens: '{"name": "Ada Lovelace", "age'
attempt 2: {"name": "Ada Lovelace", "age": 41} rejected: Value error, age 41 is not stated in the source text
attempt 3: same output as before, giving up
Failed(reason='repeated output', attempts=['{"name": "Ada Lovelace", "age', '{"name": "Ada Lovelace", "age": 41}', '{"name": "Ada Lovelace", "age": 41}'])

# a toy that wants to write the age as digits
attempt 1: cut off at 8 tokens: '{"name": "Ada Lovelace", "age": '
attempt 2: accepted Person(name='Ada Lovelace', age=36)
Person(name='Ada Lovelace', age=36)
```

A gramática ignorou em silêncio `minLength`, `minimum` e `maximum`, como faz o SDK da Anthropic, então `{"name": "", "age": 999}` passa pela gramática e só o Pydantic o barra. A primeira tentativa bateu no limite de tokens: um *prefixo* válido não é JSON válido. A segunda estava de acordo com o schema e errada, e só a checagem de ancoragem pegou. O modelo de brinquedo ignora o prompt, então o feedback não mudou nada e o loop parou na repetição. Um modelo que escreve a idade do jeito que o schema quer passa na segunda tentativa.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Para que tanta cerimônia? Coloca um decorator de retry na chamada, três tentativas, e deixa tentar até alguma passar.</span>
    </div>
  </div>
</div>

Um retry que não muda nada devolve a mesma coisa com temperatura zero, e com temperaturas mais altas "até alguma passar" significa acabar aceitando uma resposta errada que por acaso passou. Cada retry precisa mudar uma entrada que importa: o limite, o erro no prompt, o modelo. Quando o texto de origem não contém a resposta, nenhum retry vai fazê-la aparecer. Isso pede uma falha tipada e um humano.

## Checagem de realidade em produção

### A ordem dos campos é um orçamento de raciocínio

As chaves saem na ordem do schema, e cada valor é condicionado só no que veio antes dele. Coloque `answer` primeiro e o modelo se compromete antes de escrever qualquer coisa que pudesse embasar a resposta. Coloque um campo `evidence` primeiro ("cite a frase que define o prazo de aviso") e a resposta fica condicionada nessa citação, que o seu código ainda pode conferir literalmente contra o texto de origem. Custa tokens, mas é a alavanca de qualidade mais barata do schema. Na Anthropic, marque todas as propriedades como obrigatórias se a ordem importar.

### Enums fecham o mundo

Um enum é a restrição mais forte que você pode escrever, e um problema silencioso de qualidade de dados quando o mundo não é fechado. Se um ticket pode ser `billing`, `bug` ou `feature_request`, um relato de segurança é forçado para o que for menos errado. Adicione um `other` explícito com um motivo em texto livre e conte quantas vezes ele é usado. Compare valores de enum sem diferenciar maiúsculas, por causa do aviso da Anthropic.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Então vou fazer todo campo virar enum. Se o modelo só pode escolher da minha lista, ele nunca vai errar.</span>
    </div>
  </div>
</div>

Ele nunca vai ser *inválido*. Pode errar de um jeito que você nunca vai ver, porque agora toda resposta errada tem cara de resposta certa. Um texto livre "aviso conforme o Anexo II" é feio e honesto; um enum `thirty_days` é limpo e mentiroso. Guarde enums para coisas fechadas por definição, como as moedas que você aceita.

### Recursos de schema não suportados: falha barulhenta ou silenciosa

Uma API que rejeita seu schema com um 400 é o caso bom: você descobre em desenvolvimento. O caso perigoso é uma camada que o afrouxa em silêncio, como um SDK que move `minimum` para uma descrição. O brinquedo imprimiu a lista do que ignorou; a maioria das stacks reais não imprime. Mantenha o schema completo no seu próprio validador e teste casos de borda contra os limites documentados de cada motor. E compile uma vez por schema: um schema gerado a cada requisição, como um enum dinâmico com os projetos deste usuário, derruba qualquer cache de gramática.

### Truncamento e strings que nunca terminam

Confira o motivo de parada antes do parse: `status: "incomplete"` com `max_output_tokens` na OpenAI, `stop_reason: "max_tokens"` na Anthropic. Uma falha parecida é a string que nunca fecha. Meu primeiro modelo de brinquedo para este post era um modelo de trigramas treinado em algumas respostas, uma delas com JSON de aspas simples. Sob a gramática ele ficou preso dentro do nome, porque aspa simples é um caractere válido dentro de uma string com aspas duplas, e produziu isto até o limite de 40 tokens:

```text title="first toy, constrained, finish=length"
{"name": "Marie Curie', 'age': 'Marie Curie', 'age': 'Marie Curie', 'age': 'Marie Curie', 'age'
```

A gramática ficou satisfeita a cada passo e a saída não servia para nada. Modelos reais também entram em loop, com conteúdo ou espaço em branco, e é por isso que o brinquedo permite no máximo um espaço e que `maxLength` e `maxItems` valem a pena onde forem respeitados.

### Estar de acordo com o schema não é estar correto

A checagem de ancoragem é a parte mais valiosa do pipeline, e não tem nada a ver com decoding. Totais que batem com a soma dos itens, IDs que existem no seu banco, evidências que aparecem literalmente no texto de origem: nenhuma gramática expressa isso. É o argumento de [Chamadas de ferramentas determinísticas](/pt-br/blog/deterministic-tool-calling/): o modelo propõe, o seu código decide. Structured outputs deixaram a proposta legível por máquina, não verdadeira.

O decoding com restrição faz exatamente o que promete: a cada passo, tira os tokens que quebrariam a sua gramática, então a saída passa no parse. Essa é a garantia inteira. Ele não sabe se o modelo queria dizer algo que o schema não comporta, se a resposta foi cortada ou se o número é verdadeiro. Deixe a sintaxe com a gramática, as restrições que a gramática ignorou com o Pydantic, o significado com as suas checagens, e faça todo retry mudar alguma coisa.
