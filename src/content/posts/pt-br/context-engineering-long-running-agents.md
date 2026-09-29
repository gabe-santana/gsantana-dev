---
title: "Engenharia de contexto para agentes de longa duração: orçamento, limpeza, compactação e memória"
description: "Por que uma janela de contexto enorme não salva uma sessão longa de agente, e um gerenciador de contexto em Python que a mantém pequena, barata e no rumo."
date: 2026-08-09
tags: [AI Agents, Context Engineering, Python, LLM]
tldr:
  - "Todo turno reenvia o histórico inteiro, então a entrada cresce com o quadrado do tamanho da sessão, e os modelos pioram de forma mensurável quando o contexto se enche de tokens velhos."
  - "Gerencie o contexto a cada turno, do movimento mais barato para o mais caro: limpe resultados de ferramenta antigos mantendo a chamada, compacte turnos velhos num resumo estruturado e guarde as decisões num arquivo de notas do próprio agente."
  - "Numa sessão simulada de 60 turnos, o contexto gerenciado usou 4,6x menos tokens de entrada, ficou abaixo de 37k em vez de passar de 200k e preservou todos os fatos plantados; agrupe as edições para o cache de prompt sobreviver."
---

Imagine um agente de código há quarenta minutos num bug de faturamento. No turno 52 ele lê `money.py` de novo, um arquivo que já leu três vezes, e propõe arredondar cada item antes de somar. É exatamente a abordagem que ele tentou e reverteu no turno 12, com um teste falhando para provar que estava errada. Nada foi truncado. Cada leitura de arquivo, cada log de pytest de 3.000 tokens e a própria decisão continuam na janela de contexto. O problema é esse: a única linha que importa está enterrada sob 180.000 tokens de saída de ferramenta que já não importam.

A resposta fácil é uma janela maior, e 2026 tem modelos de sobra que aceitam um milhão de tokens. Isso não resolve. Deixa cada turno mais lento e mais caro, e as pesquisas mostram de forma consistente que os modelos usam contextos longos e ruidosos pior do que contextos curtos e focados. Este post trata de gerenciar o contexto de um agente de propósito: um orçamento por turno, limpeza de resultados de ferramenta antigos, uma compactação que guarda o que importa, um arquivo de notas do próprio agente e um layout de prompt amigável ao cache. Depois vem um gerenciador de contexto em Python, rodado contra uma sessão simulada de 60 turnos, com números reais. O Júnior Inocente tem opiniões sobre o milhão de tokens.

## O problema e o contexto

Um loop de agente envia a conversa, recebe uma chamada de ferramenta, executa a ferramenta, anexa o resultado e repete. Toda requisição carrega o histórico inteiro, então uma sessão custa a soma de todos os prefixos: se cada turno acrescenta uma quantidade parecida, a entrada total cresce com o quadrado do número de turnos. Na simulação mais abaixo, uma sessão de 60 turnos termina com um contexto de 213k tokens, mas as requisições somam 5,86 milhões de tokens de entrada. Você paga pela primeira leitura de arquivo sessenta vezes. O cache de prompt ameniza isso enquanto está quente, mas um miss num prefixo de 150k tokens significa fazer o prefill de tudo de novo antes do primeiro token de saída.

O segundo custo é a qualidade, e é o que as pessoas subestimam:

- [Lost in the Middle](https://arxiv.org/abs/2307.03172) (Liu et al., 2023) mostrou que o desempenho costuma ser maior quando a informação relevante está no começo ou no fim do contexto e cai de forma significativa quando o modelo precisa acessá-la no meio de contextos longos. A decisão importante do turno 8 de um agente vai parar exatamente ali.
- [RULER](https://arxiv.org/abs/2404.06654) (Hsieh et al., NVIDIA) testou 17 modelos que diziam suportar 32K tokens ou mais; só metade manteve desempenho satisfatório em 32K.
- [NoLiMa](https://arxiv.org/abs/2502.05167) (Modarressi et al., ICML 2025) removeu a sobreposição literal de palavras que deixa os testes de agulha fáceis. Em 32K, 11 de 13 modelos ficaram abaixo da metade da pontuação que tinham em contexto curto; o GPT-4o caiu de 99,3% para 69,7%.
- O estudo [Context Rot](https://www.trychroma.com/research/context-rot) da Chroma (julho de 2025) rodou 18 modelos, entre eles Claude 4, GPT-4.1, Gemini 2.5 e Qwen3, em tarefas de dificuldade constante e ainda assim viu o desempenho cair conforme a entrada crescia. No LongMemEval, todos os modelos foram significativamente melhores com uma entrada focada de uns 300 tokens do que com a entrada completa de 113k tokens que continha a mesma resposta.

O [guia de engenharia de contexto](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) da Anthropic chama isso de orçamento de atenção: n tokens significam n² relações entre pares, e ruído dilui sinal. Num agente de código, o ruído tem uma origem óbvia. Na minha sessão simulada, os resultados de ferramenta somam 207.833 tokens em 60 turnos, enquanto as mensagens do próprio agente somam 9.432, e a maior parte dos resultados fica velha poucos turnos depois de chegar.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>O modelo aceita um milhão de tokens. A gente está em 200k. Pra que gerenciar alguma coisa? É só usar a janela que a gente está pagando.</span>
    </div>
  </div>
</div>

A janela é um limite, não uma meta. O modelo vai ler, cobrar e prestar atenção em cada token que você enviar, e os estudos acima mostram a atenção piorando muito antes do limite. Uma janela enorme é ótima quando a tarefa precisa de um documento longo inteiro à vista. Uma sessão de agente é quase toda feita de cópias velhas de coisas que o agente poderia buscar de novo com uma chamada de ferramenta, e elas custam dinheiro e latência em todo turno e precisão justamente nos turnos que importam.

## Mergulho na arquitetura

Trate o contexto como um conjunto de trabalho, não como uma transcrição. A transcrição pode morar num log. O conjunto de trabalho é o que o modelo precisa para dar o próximo passo certo, e ele tem um layout:

<div id="ctx-eng-window-anatomy-slot"></div>

### Um orçamento por turno, não um limite por modelo

Dimensione o conjunto de trabalho pela tarefa, não pelo máximo do modelo. Para um agente de código eu começo em uns 30k tokens: o system prompt, alguns arquivos, um log de teste e espaço para o próximo resultado. Acima desse **gatilho** o gerenciador roda suas políticas, da mais barata para a mais cara, já que cada uma perde mais informação que a anterior; se a limpeza deixar o contexto acima de um **limite de compactação** mais baixo, ele compacta. A janela real do modelo fica como um teto rígido que levanta um erro, em vez de deixar o provedor truncar por você.

<div id="ctx-eng-policy-loop-slot"></div>

### Limpe resultados de ferramenta: mantenha a chamada, descarte o payload

Resultados de ferramenta são a parte maior do histórico e a que apodrece mais rápido. A limpeza troca o payload de resultados antigos por um stub curto e mantém a chamada, então o modelo continua sabendo que rodou `read_file(src/billing/tax.py)` no turno 42 e pode rodar de novo. A Anthropic chama a limpeza de resultados de ferramenta de uma das formas mais seguras e leves de compactação; o [context editing](https://platform.claude.com/docs/en/build-with-claude/context-editing) da API deles faz isso no servidor. Três detalhes importam. Mantenha intactos os resultados mais recentes, porque o modelo está raciocinando sobre eles agora. Guarde a única linha que você se arrependeria de perder: meu stub guarda o primeiro erro de um log de teste de 3.000 tokens, a mesma ideia que o time da Manus chama de [compressão restaurável](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus) (descarta o conteúdo de uma página, guarda a URL). E limpe em lotes, porque editar uma mensagem invalida o cache de prompt daquele ponto em diante; o gerenciador só limpa quando libera pelo menos 10k tokens.

### Compactação: resuma, mas decida o que sobrevive

A limpeza desacelera o crescimento, mas todo turno ainda deixa uma chamada, um stub e algum raciocínio. Uma hora os turnos antigos precisam sair: a compactação troca esses turnos por um resumo e mantém as mensagens mais recentes palavra por palavra. Um prompt genérico de "resuma esta conversa" gera um parágrafo simpático que perde exatamente o que um agente de código precisa. A Anthropic diz que a compactação do Claude Code guarda decisões de arquitetura, bugs não resolvidos e detalhes de implementação. A minha lista: a tarefa na íntegra e toda instrução que o usuário acrescentou depois, as decisões com seus motivos (o bug do turno 52), os TODOs abertos, as mensagens de erro exatas para que abordagens que falharam não sejam repetidas, e cada caminho de arquivo tocado com a última coisa feita nele. Payloads de ferramenta e linhas de teste que passaram podem ir embora.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Plano mais simples: a cada 10 turnos, pede pro modelo resumir tudo e recomeça a partir do resumo.</span>
    </div>
  </div>
</div>

Isso roda a política mais cara e mais destrutiva num cronograma, precisando ou não. Cada resumo é uma chamada extra ao modelo sobre o histórico inteiro, reescreve todo o prefixo em cache, e cada resumo de resumo se afasta um pouco mais do que aconteceu: depois de três rodadas, "arredondar uma vez no total com ROUND_HALF_EVEN" vira "discutimos arredondamento". Resuma só quando a limpeza não der conta, mantenha os turnos recentes intactos e faça um resumo estruturado, para que a próxima compactação o carregue adiante em vez de parafraseá-lo.

### Um arquivo de notas do próprio agente

Um resumo é escrito sobre o agente; um arquivo de notas é escrito pelo agente, e sobrevive a toda compactação porque não está no histórico. Dê ao agente ferramentas para escrever, reescrever e ler o arquivo, e uma linha no system prompt mandando registrar o que ele não pode esquecer. O [memory tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool) da Anthropic dá ao Claude um diretório de arquivos que ele pode criar, ler, atualizar e apagar entre conversas; a Manus mantém um `todo.md` que reescreve enquanto trabalha, o que também recita o plano na parte mais recente do contexto. Limite o tamanho do arquivo, senão ele vira um segundo histórico, e copie-o para o resumo na compactação, para o agente ver suas notas justamente quando os turnos antigos somem.

### Busca na hora certa e subagentes

O token mais barato é o que você nunca carrega. Pré-carregar um mapa do repositório, todos os arquivos relacionados e o histórico do ticket coloca tokens no prefixo pela sessão inteira, a maioria nunca usada. Dê ao agente caminhos e ferramentas de busca e deixe que ele traga o conteúdo quando precisar; é isso também que torna a limpeza segura. Para subtarefas que leem muito para responder pouco ("quais chamadas de `quantize` mexem no total da fatura?"), use um subagente com contexto novo. A Anthropic descreve subagentes que exploram com dezenas de milhares de tokens e devolvem um resumo de 1.000 a 2.000 tokens. Não sai de graça (o [sistema de pesquisa multiagente](https://www.anthropic.com/engineering/multi-agent-research-system) deles usou umas 15 vezes os tokens de um chat), mas o contexto pai fica limpo. A coordenação está em [Multi-Agent Orchestration](/pt-br/blog/multi-agent-orchestration/).

### Mantenha o prefixo estável amigável ao cache

O cache funciona com prefixos exatos. O cache da Anthropic cobre ferramentas, depois system, depois mensagens, e [leituras de cache custam 0,1x o preço base de entrada, enquanto escritas de cinco minutos custam 1,25x](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) na maioria dos modelos; a OpenAI [faz cache automaticamente](https://developers.openai.com/api/docs/guides/prompt-caching) a partir de 1.024 tokens, também com prefixos exatos. A Manus chama a taxa de acerto do KV-cache de a métrica mais importante de um agente em produção, com entradas superando saídas numa proporção de uns 100 para 1. Então: nada volátil no topo (sem timestamps ou ids de requisição no system prompt), definições de ferramentas que não mudam no meio da sessão, serialização determinística, e edições raras, em lote e que compensem a reescrita.

## Implementação na prática

Aqui está tudo em Python puro: um contador de tokens, um gerenciador de contexto com as duas políticas, um sumarizador offline, um arquivo de notas e uma simulação que reproduz uma sessão roteirizada de 60 turnos duas vezes, ingênua e gerenciada. Rodei no Python 3.14 com tiktoken 0.14.0.

```bash title="terminal"
python -m venv .venv && . .venv/bin/activate
pip install tiktoken pytest
```

### Contando tokens

O tiktoken é rápido e preciso o bastante para orçamentos, com a ressalva da docstring: para Claude ou Gemini, as contagens são estimativas.

```python title="ctxkit/tokens.py"
"""Token counting for context budgets.

Uses tiktoken's o200k_base encoding when it is installed. That is an OpenAI
tokenizer, not Claude's or Gemini's, so the counts are estimates: good for
budgets and trends, not for reconciling an invoice (use the provider's
token counting endpoint for that). Without tiktoken it falls back to
len(text) / 4, the usual rule of thumb for English prose and code.
"""

from __future__ import annotations

from functools import lru_cache

# Role markers and framing the chat format adds around every message.
# Approximate: providers don't document it and it varies by model.
MESSAGE_OVERHEAD = 4

try:
    import tiktoken

    _encoding = tiktoken.get_encoding("o200k_base")
    BACKEND = "tiktoken o200k_base"

    def _count(text: str) -> int:
        return len(_encoding.encode(text, disallowed_special=()))

except ImportError:
    BACKEND = "chars / 4"

    def _count(text: str) -> int:
        return max(1, len(text) // 4)


@lru_cache(maxsize=8192)
def count_tokens(text: str) -> int:
    return _count(text)
```

### O gerenciador de contexto

As mensagens são imutáveis e têm hash (a simulação usa o hash para modelar o cache de prompt). O `prepare()` roda antes de cada requisição e aplica as políticas em ordem.

```python title="ctxkit/context.py"
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field, replace
from typing import Callable, Literal, Protocol

from ctxkit.tokens import MESSAGE_OVERHEAD, count_tokens

Role = Literal["system", "user", "assistant", "tool", "summary"]

ERROR_LINE = re.compile(r"\b([A-Z]\w*(?:Error|Exception)): ([^\n\]]+)")


@dataclass(frozen=True)
class Message:
    role: Role
    content: str
    turn: int = 0
    tool: str | None = None  # tool results: which tool produced them
    args: str | None = None  # and with which arguments, kept after clearing
    cleared: bool = False

    @property
    def tokens(self) -> int:
        return count_tokens(self.content) + MESSAGE_OVERHEAD

    @property
    def key(self) -> str:
        return hashlib.sha256(f"{self.role}\0{self.content}".encode()).hexdigest()


class Summarizer(Protocol):
    def summarize(self, messages: list[Message], notes: str) -> str: ...


class ContextOverflow(RuntimeError):
    pass


@dataclass(frozen=True)
class Budget:
    window: int = 200_000  # the model's hard limit
    trigger: int = 30_000  # above this, the policies run
    clear_at_least: int = 10_000  # never break the cache for less than this
    keep_tool_results: int = 3  # newest tool results always stay verbatim
    compact_above: int = 20_000  # still above this after clearing: summarize
    keep_recent: int = 10  # messages a compaction keeps word for word
    pinned_tools: frozenset[str] = frozenset({"notes_read"})


def stub(message: Message) -> str:
    """What replaces a stale tool result: the call survives, the payload doesn't."""
    text = f"[cleared: {message.tool}({message.args}) returned {message.tokens:,} tokens. Call it again if you need it."
    if error := ERROR_LINE.search(message.content):
        text += f" First error: {error.group(0)}"
    return text + "]"


@dataclass
class ContextManager:
    system: str
    summarizer: Summarizer
    budget: Budget = field(default_factory=Budget)
    read_notes: Callable[[], str] = lambda: ""
    history: list[Message] = field(default_factory=list)
    events: list[str] = field(default_factory=list)
    requests: int = 0

    def append(self, message: Message) -> None:
        self.history.append(message)

    def total(self) -> int:
        return count_tokens(self.system) + MESSAGE_OVERHEAD + sum(m.tokens for m in self.history)

    def prepare(self) -> list[Message]:
        """Apply the policies, cheapest first, and return the next request."""
        self.requests += 1
        if self.total() > self.budget.trigger:
            self._clear_tool_results()
            if self.total() > self.budget.compact_above:
                self._compact()
        if self.total() > self.budget.window:
            raise ContextOverflow(f"{self.total():,} tokens after every policy ran")
        return [Message("system", self.system), *self.history]

    def _clear_tool_results(self) -> None:
        results = [
            i
            for i, m in enumerate(self.history)
            if m.role == "tool" and not m.cleared and m.tool not in self.budget.pinned_tools
        ]
        stale = results[: -self.budget.keep_tool_results or None]
        stubs = {i: replace(self.history[i], content=stub(self.history[i]), cleared=True) for i in stale}
        freed = sum(self.history[i].tokens - s.tokens for i, s in stubs.items())
        # Every edit invalidates the cached prefix from that point on, so
        # small edits cost more in cache writes than they save.
        if freed < self.budget.clear_at_least:
            return
        for i, cleared in stubs.items():
            self.history[i] = cleared
        self.events.append(f"request {self.requests}: cleared {len(stale)} tool results (-{freed:,})")

    def _compact(self) -> None:
        cut = len(self.history) - self.budget.keep_recent
        # A tool result must never lose the call that produced it.
        while cut > 0 and self.history[cut].role == "tool":
            cut -= 1
        old, recent = self.history[:cut], self.history[cut:]
        # Same rule as clearing: a summary rewrites the prefix, so it must pay for itself.
        if sum(m.tokens for m in old) < self.budget.clear_at_least:
            return
        before = self.total()
        summary = self.summarizer.summarize(old, self.read_notes())
        self.history = [Message("summary", summary, turn=old[-1].turn), *recent]
        self.events.append(f"request {self.requests}: compacted {len(old)} messages (-{before - self.total():,})")
```

Duas restrições se escondem em `_compact`. O ponto de corte recua até não separar um resultado de ferramenta da sua chamada, porque as principais APIs de provedores rejeitam um resultado sem a chamada correspondente. E a compactação reaproveita o `clear_at_least`: uma versão anterior sem essa proteção compactou três mensagens para economizar 159 tokens, quebrando o cache à toa.

### Um sumarizador que roda offline

O sumarizador é um protocolo, então pode ser uma chamada ao modelo ou código comum. Na simulação ele é extrativo e determinístico. Ele depende de uma convenção que o system prompt pede (o agente escreve linhas `DECISION:`, `TODO:` e `DONE:`), extrai erros com uma regex e acompanha caminhos de arquivo pelos argumentos das ferramentas. A saída usa os mesmos marcadores, então resumir um resumo não perde nada.

```python title="ctxkit/summarize.py"
from __future__ import annotations

import re

from ctxkit.context import ERROR_LINE, Message

MARKER = re.compile(r"^(TASK|USER|DECISION|TODO|DONE|ERROR|FILE): (.+)$", re.M)
PATH = re.compile(r"\b(?:src|tests)/[\w/.-]+\.py\b")
SEEN = re.compile(r"^(.*) \(last seen turn (\d+)\)$")


def _touch(d: dict, key, value) -> None:
    d.pop(key, None)  # re-insert so the dict stays ordered by recency
    d[key] = value


class ExtractiveSummarizer:
    """Deterministic and offline: keeps what later turns tend to need.

    It relies on a convention the system prompt asks for: the agent writes
    DECISION:, TODO: and DONE: lines in its messages. Its own output uses
    the same markers, so summarizing a summary loses nothing.
    """

    def __init__(self, max_errors: int = 5, max_files: int = 12) -> None:
        self.max_errors = max_errors
        self.max_files = max_files

    def summarize(self, messages: list[Message], notes: str) -> str:
        task, users, decisions = "", [], []
        todos: dict[str, None] = {}
        errors: dict[str, int] = {}
        files: dict[str, str] = {}
        for m in messages:
            if m.role == "user":
                if task:
                    users.append(f"(turn {m.turn}) {m.content}")
                else:
                    task = m.content
            elif m.role in ("assistant", "summary"):
                turn = "" if m.role == "summary" else f"(turn {m.turn}) "
                for kind, text in MARKER.findall(m.content):
                    if kind == "TASK":
                        task = text
                    elif kind == "USER":
                        users.append(text)
                    elif kind == "DECISION":
                        decisions.append(turn + text)
                    elif kind == "TODO":
                        todos[text] = None
                    elif kind == "DONE":
                        todos.pop(text, None)
                    elif kind == "ERROR" and (seen := SEEN.match(text)):
                        _touch(errors, seen.group(1), int(seen.group(2)))
                    elif kind == "FILE":
                        _touch(files, PATH.findall(text)[0], text)
            elif m.role == "tool":
                for error in ERROR_LINE.finditer(m.content):
                    _touch(errors, error.group(0), m.turn)
                for path in PATH.findall(m.args or ""):
                    _touch(files, path, f"{path}, last {m.tool} at turn {m.turn}")

        lines = [f"TASK: {task}"]
        lines += [f"USER: {u}" for u in users]
        lines += [f"DECISION: {d}" for d in decisions]
        lines += [f"TODO: {t}" for t in todos]
        lines += [f"ERROR: {e} (last seen turn {t})" for e, t in list(errors.items())[-self.max_errors :]]
        lines += [f"FILE: {f}" for f in list(files.values())[-self.max_files :]]
        header = f"Summary of turns 1 to {messages[-1].turn}. Older tool output was dropped; re-read what you need."
        return "\n".join([header, *lines, "", "Current notes:", notes or "(empty)"])
```

Em produção você normalmente pluga um modelo. Esta classe é **ilustrativa e não foi executada para este post**; o prompt carrega as mesmas regras de preservação e mantém os marcadores.

```python title="ctxkit/llm_summarizer.py (ilustrativo, não executado)"
from ctxkit.context import Message

PROMPT = """You are compacting the history of a coding agent so it can continue its task.
Keep, verbatim where possible:
- the original task and every instruction the user added later
- every decision and its reason, as DECISION: lines
- open work, as TODO: lines (drop items marked DONE:)
- exact error messages and approaches that failed, as ERROR: lines
- every file path touched and what was last done to it, as FILE: lines
Drop tool output the agent can fetch again. Never invent facts."""


class LLMSummarizer:
    def __init__(self, client, model: str, max_tokens: int = 2_000) -> None:
        self.client, self.model, self.max_tokens = client, model, max_tokens

    def summarize(self, messages: list[Message], notes: str) -> str:
        transcript = "\n\n".join(f"[{m.role}, turn {m.turn}] {m.content}" for m in messages)
        response = self.client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            system=PROMPT,
            messages=[{"role": "user", "content": transcript}],
        )
        return f"{response.content[0].text}\n\nCurrent notes:\n{notes or '(empty)'}"
```

Um modelo percebe o que uma regex não percebe (dois TODOs escritos de jeitos diferentes, um erro causado pela última edição), mas custa uma chamada sobre o histórico antigo e pode parafrasear uma decisão em algo sutilmente diferente. Teste qualquer um dos dois do mesmo jeito: plante fatos e confira se eles sobrevivem.

### O arquivo de notas

Markdown com seções `##` e entradas `-`. O `NOTES_TOOLS`, no mesmo arquivo, expõe `notes_write`, `notes_rewrite` e `notes_read` ao modelo. O limite de tamanho é a parte importante: passando dele, as escritas falham com um erro que manda o agente consolidar.

```python title="ctxkit/notes.py (a classe; os schemas das ferramentas ficam acima no arquivo)"
class NotesFile:
    """Memory the agent writes and reads itself; it survives every compaction."""

    def __init__(self, path: Path, max_tokens: int = 1_500) -> None:
        self.path = path
        self.max_tokens = max_tokens

    def read(self) -> str:
        return self.path.read_text(encoding="utf-8") if self.path.exists() else ""

    def write(self, section: str, entry: str) -> str:
        sections = self._sections()
        sections.setdefault(section, []).append(entry)
        return self._save(sections, f"ok: {section} has {len(sections[section])} entries")

    def rewrite(self, section: str, entries: list[str]) -> str:
        sections = self._sections()
        sections[section] = entries
        if not entries:
            del sections[section]
        return self._save(sections, f"ok: {section} rewritten")

    def _sections(self) -> dict[str, list[str]]:
        sections: dict[str, list[str]] = {}
        for line in self.read().splitlines():
            if line.startswith("## "):
                sections[line[3:]] = []
            elif line.startswith("- ") and sections:
                sections[list(sections)[-1]].append(line[2:])
        return sections

    def _save(self, sections: dict[str, list[str]], ok: str) -> str:
        text = "\n\n".join(f"## {name}\n" + "\n".join(f"- {e}" for e in items) for name, items in sections.items())
        # Notes that grow without bound are just a second history.
        if count_tokens(text) > self.max_tokens:
            return f"error: notes would exceed {self.max_tokens} tokens; merge entries with notes_rewrite first"
        self.path.write_text(text + "\n", encoding="utf-8")
        return ok
```

### Simulando uma sessão de código de 60 turnos

Nenhuma chamada a modelo: o objetivo é medir o contexto, então a sessão é roteirizada. O `session.py` (geradores de fixture, não mostrado) tem um agente corrigindo um bug de arredondamento de um centavo em faturas em BRL ao longo de 22 turnos planejados: a decisão de arredondar uma vez no total com `ROUND_HALF_EVEN` (turno 8), um `TypeError` por alíquotas em float (turno 13), um usuário acrescentando um bug na exportação CSV (turno 20), uma terceira decisão (turno 35), testes de regressão e uma execução final. Os outros turnos exploram com uma semente fixa. O `read_file` devolve de 5,0k a 9,3k tokens, o `run_tests` de 2,6k a 4,0k, o `grep` de 0,4k a 1,3k, e cada mensagem do agente tem de uns 100 a 225 tokens de raciocínio. A sessão é gravada uma vez e reproduzida nos dois modos; o medidor trata a sequência de mensagens compartilhada com a requisição anterior como leitura de cache e o resto como escrita.

```python title="simulate.py (o medidor e o loop de reprodução)"
@dataclass
class Meter:
    """Per-request tokens and cost, with an append-only prompt cache model."""

    previous: list[str] = field(default_factory=list)
    context: list[int] = field(default_factory=list)
    fresh: int = 0
    cost_plain: float = 0.0
    cost_cached: float = 0.0
    cost_cold: float = 0.0

    def request(self, messages: list[Message], output: int, turn: int) -> None:
        keys, tokens = [m.key for m in messages], [m.tokens for m in messages]
        shared = 0
        while shared < min(len(keys), len(self.previous)) and keys[shared] == self.previous[shared]:
            shared += 1
        read = sum(tokens[:shared]) if sum(tokens[:shared]) >= MIN_CACHEABLE else 0
        total = sum(tokens)
        self.context.append(total)
        self.fresh += total - read
        self.cost_plain += (total * PRICE_IN + output * PRICE_OUT) / 1e6
        self.cost_cached += self._cached(total, read, output)
        self.cost_cold += self._cached(total, 0 if turn in COLD else read, output)
        self.previous = keys

    @staticmethod
    def _cached(total: int, read: int, output: int) -> float:
        return (read * PRICE_IN * CACHE_READ + (total - read) * PRICE_IN * CACHE_WRITE + output * PRICE_OUT) / 1e6


def replay(turns, manager: ContextManager | None, notes: NotesFile) -> tuple[Meter, list[Message]]:
    meter, history = Meter(), []
    add = manager.append if manager else history.append
    request = manager.prepare if manager else lambda: [Message("system", SYSTEM), *history]
    for t, user, call, result in turns:
        if user:
            add(Message("user", user, turn=t))
        meter.request(request(), output=call.tokens, turn=t)
        if result.tool in ("notes_write", "notes_rewrite"):
            section, entry = result.args.split(" | ")
            ok = notes.write(section, entry) if result.tool == "notes_write" else notes.rewrite(section, [entry])
            result = Message("tool", ok, turn=t, tool=result.tool, args=result.args)
        add(call)
        add(result)
    return meter, request()
```

As constantes no topo do arquivo: US$ 3 e US$ 15 por milhão de tokens de entrada e saída, os multiplicadores de cache da Anthropic (0,1 e 1,25), um mínimo de 1.024 tokens para cache e `COLD = {20, 45}`, os turnos antes dos quais o cache expirou. Os números com cache quente assumem nenhuma pausa maior que os cinco minutos de vida do cache, o que favorece a execução ingênua; a linha fria não. No fim, o script confere se oito fatos plantados ainda estão no contexto gerenciado.

### Os resultados

```bash title="terminal"
$ python simulate.py
tokenizer: tiktoken o200k_base, system prompt + tools: 612 tokens
turn     naive   managed
   1       649       649
   5     8,826     8,826
  10    24,950    24,950
  15    43,753    21,850
  20    63,403    22,804
  25    79,622    20,491
  30    93,418    15,497
  35   108,138    17,992
  40   118,983    28,837
  45   146,066    28,298
  50   176,486    33,041
  55   187,866    29,429
  60   212,592    20,965

manager events:
  request 12: cleared 8 tool results (-21,903)
  request 18: cleared 6 tool results (-18,696)
  request 24: cleared 6 tool results (-18,532)
  request 30: cleared 6 tool results (-18,790)
  request 35: cleared 5 tool results (-12,225)
  request 41: cleared 6 tool results (-17,048)
  request 44: cleared 3 tool results (-10,574)
  request 46: cleared 2 tool results (-15,562)
  request 49: cleared 3 tool results (-10,115)
  request 52: cleared 3 tool results (-14,992)
  request 56: cleared 4 tool results (-10,063)
  request 59: cleared 3 tool results (-13,393)
  request 59: compacted 108 messages (-9,734)

                                 naive     managed
input tokens, all turns      5,856,377   1,286,153
peak context                   212,592      36,936
tokens prefilled fresh         213,241     310,929
cost without caching            $17.71       $4.00
cost with caching                $2.63       $1.60
... and 2 cold caches            $3.33       $1.75
naive passes 128,000 tokens at turn 42
naive passes 200,000 tokens at turn 58

facts still in the managed context at the end:
  yes  task: keep USD behavior unchanged
  yes  decision t8: ROUND_HALF_EVEN
  yes  decision t16: never float
  yes  decision t35: format_money()
  yes  user t20: 3 decimals for BRL
  yes  error t13: TypeError: unsupported operand
  yes  file: src/billing/tax.py
  yes  open task: TODO: run the full suite
```

O contexto ingênuo cresce em linha reta e passa de 200k no turno 58, então num modelo com janela de 200k essa sessão morre a dois turnos do fim. O contexto gerenciado oscila entre uns 11k e 37k: a limpeza o puxa para baixo toda vez que ele chega ao gatilho, e perto do fim uma compactação remove 108 mensagens. No total ele envia 4,6 vezes menos tokens de entrada e mantém os oito fatos.

As linhas de custo pedem uma leitura honesta. Sem cache, o gerenciado é 4,4 vezes mais barato. Com o cache quente, é só 39% mais barato, porque um histórico que só recebe anexos é o melhor caso para o cache: a execução ingênua escreve cada token no cache uma única vez. A execução gerenciada, na verdade, faz prefill de 46% *mais* tokens do zero (310.929 contra 213.241), já que cada limpeza reescreve o cache a partir da primeira mensagem editada. Com dois caches frios (uma pessoa que leva dez minutos para responder, um CI lento), a execução ingênua paga o preço cheio de escrita num prefixo de 63k e noutro de 146k, e o gerenciado passa a ser 47% mais barato.

A compactação da requisição 59 produziu este resumo (`--show`):

```text title="terminal"
Summary of turns 1 to 53. Older tool output was dropped; re-read what you need.
TASK: Invoice totals in BRL are sometimes off by one cent. Find the cause, fix it, add regression tests, and keep USD behavior unchanged.
USER: (turn 20) Also check the CSV export, finance says it shows 3 decimals for BRL.
DECISION: (turn 8) round once, at the invoice total, with ROUND_HALF_EVEN in src/billing/money.py
DECISION: (turn 16) tax rates load as Decimal from strings, never float
DECISION: (turn 35) export formats money with format_money(), never str(Decimal)
TODO: run the full suite and summarize the change for the PR
ERROR: AssertionError: expected Decimal('10.01'), got Decimal('10.00') (last seen turn 11)
ERROR: TypeError: unsupported operand type(s) for *: 'float' and 'decimal.Decimal' (last seen turn 15)
ERROR: AssertionError: '10.010' != '10.01' (last seen turn 32)
FILE: src/billing/invoice.py, last read_file at turn 17
FILE: tests/test_export.py, last run_tests at turn 31
FILE: src/billing/export.py, last edit_file at turn 37
FILE: src/billing/tax.py, last read_file at turn 42
FILE: tests/test_money.py, last run_tests at turn 46
FILE: src/billing/currency.py, last read_file at turn 47
FILE: src/billing/money.py, last read_file at turn 48
FILE: tests/test_invoice.py, last read_file at turn 49

Current notes:
## Decisions
- round once at the total, ROUND_HALF_EVEN, money.py
- export uses format_money(), never str(Decimal)

## Open
- run the full suite and summarize the change for the PR
```

Dois dos três TODOs sumiram porque o agente os marcou como feitos. As linhas de erro vieram dos stubs limpos, não dos logs originais, e é por isso que o stub guarda o primeiro erro:

```text title="terminal"
[cleared: run_tests(tests/test_invoice.py) returned 3,654 tokens. Call it again if you need it. First error: AssertionError: expected Decimal('10.01'), got Decimal('10.00')]
```

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Então, com cache ligado, gerenciar o contexto só economiza 39%. Pra que toda essa engrenagem?</span>
    </div>
  </div>
</div>

A conta nunca foi o único custo. A execução ingênua bate no teto de 200k no turno 58, então uma tarefa mais longa simplesmente falha, e depois do turno 40 toda requisição pede ao modelo que encontre algumas decisões dentro de 120k ou mais tokens de leituras de arquivo velhas, justamente o cenário em que Lost in the Middle, NoLiMa e Context Rot mediram as quedas. O cache quente também é o caso otimista. Você gerencia o contexto pela qualidade do turno 52; a economia é bônus.

### Testando as invariantes

O que quebra em silêncio é estrutural, então ganha testes: a limpeza mantém todas as chamadas e os resultados mais novos, ganhos pequenos nunca quebram o cache, a compactação nunca deixa um resultado de ferramenta órfão, o resumo de um resumo não perde nada e o arquivo de notas se recusa a crescer além do limite.

```bash title="terminal"
$ python -m pytest -v
collecting ... collected 5 items

test_ctxkit.py::test_clearing_keeps_calls_and_newest_results PASSED      [ 20%]
test_ctxkit.py::test_small_gains_do_not_break_the_cache PASSED           [ 40%]
test_ctxkit.py::test_compaction_never_orphans_a_tool_result PASSED       [ 60%]
test_ctxkit.py::test_summarizing_a_summary_loses_nothing PASSED          [ 80%]
test_ctxkit.py::test_notes_refuse_to_grow_without_bound PASSED           [100%]

============================== 5 passed in 0.32s ==============================
```

## Checagem de realidade em produção

### O provedor talvez já faça metade disso

A API da Anthropic tem o [context editing](https://platform.claude.com/docs/en/build-with-claude/context-editing) (header beta `context-management-2025-06-27`), cuja estratégia `clear_tool_uses_20250919` tem os mesmos botões do meu `Budget`: um gatilho (padrão de 100k tokens de entrada), quantos usos de ferramenta recentes manter (padrão 3), `clear_at_least`, ferramentas excluídas e, opcionalmente, limpar também os argumentos da chamada. Como ilustração (não chamei a API para este post):

```json title="corpo da requisição (ilustrativo)"
{
  "context_management": {
    "edits": [
      {
        "type": "clear_tool_uses_20250919",
        "trigger": { "type": "input_tokens", "value": 30000 },
        "keep": { "type": "tool_uses", "value": 3 },
        "clear_at_least": { "type": "input_tokens", "value": 10000 },
        "exclude_tools": ["notes_read"]
      }
    ]
  }
}
```

Existe também a [compactação por limite](https://platform.claude.com/docs/en/build-with-claude/compaction-threshold) (`compact_20260112`, header beta `compact-2026-01-12`): ao atingir um gatilho (padrão de 150k, mínimo de 50k), a API escreve um bloco de resumo e descarta o que veio antes dele. O parâmetro `instructions` substitui o prompt padrão por inteiro, então traga a sua própria lista de preservação, e o resumo é uma iteração extra de amostragem, cobrada. O [anúncio](https://claude.com/blog/context-management) da Anthropic relata que o context editing reduziu o consumo de tokens em 84% numa avaliação de busca na web de 100 turnos e melhorou em 29% uma avaliação interna de busca agêntica (39% junto com o memory tool). São números do fornecedor, mas apontam na mesma direção que os meus. No servidor é menos código; no cliente é portável e testável offline.

### Não limpe o que não dá para buscar de novo

A limpeza é segura porque o agente pode rodar a ferramenta de novo. Isso vale para `read_file`. Não vale para um log de deploy, a resposta de uma chamada com efeito colateral ou a confirmação de uma pessoa, e rodar de novo uma chamada com efeito colateral só para ver o resultado é como se estorna um pedido duas vezes. Fixe essas ferramentas (`pinned_tools` aqui, `exclude_tools` na API) ou copie o resultado para as notas antes, e torne as ferramentas idempotentes como em [Deterministic Tool Calling](/pt-br/blog/deterministic-tool-calling/).

### Fique de olho nas releituras

Limpeza agressiva aparece como um agente relendo o mesmo arquivo sem parar, o que significa `keep_tool_results` baixo demais ou gatilho apertado demais. Por sessão eu registro tokens por requisição, a proporção de leitura de cache, limpezas, compactações e releituras de caminhos limpos.

### Resumos falham em silêncio, então teste como código

Um resumo que perdeu a decisão do turno 8 parece exatamente um resumo bom até o agente tentar de novo a correção revertida. A checagem de fatos da simulação é o padrão: grave sessões reais, liste o que precisa sobreviver, compacte, faça as asserções. Rode de novo sempre que o prompt de resumo ou o modelo por trás dele mudar.

### Tokenizadores e orçamentos são locais

O tiktoken conta para modelos da OpenAI; para Claude ou Gemini, deixe folga e calibre com o uso real, ou pergunte ao provedor (o endpoint de contagem de tokens da Anthropic aceita as mesmas configurações de gerenciamento de contexto e informa os tokens antes e depois das edições). E o orçamento pertence à tarefa: 30k funcionou aqui porque o maior resultado tinha uns 9k tokens, então coloque o gatilho em algumas vezes o maior resultado de ferramenta que você espera.

Uma janela de contexto longa é uma capacidade, não uma estratégia. Os agentes que continuam afiados no turno 200 são aqueles cujo contexto no turno 200 se parece com o contexto do turno 20: a tarefa, as decisões, o trabalho em aberto e as poucas coisas que eles estão olhando agora. Todo o resto mora fora da janela, a uma chamada de ferramenta de distância.
