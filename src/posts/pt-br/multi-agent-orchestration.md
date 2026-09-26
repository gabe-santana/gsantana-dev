---
title: "Orquestrando múltiplos agentes sem criar um monólito distribuído"
description: "Use vários agentes só quando um não bastar, com responsabilidades, orçamento e condições de parada."
date: 2026-03-26
tags: [AI Agents, Orchestration, Python, asyncio]
tldr:
  - "Comece com um agent e boas tools; divida em vários agents só quando contexto, permissões ou ownership realmente exigirem."
  - "Escolha um padrão explícito (supervisor, pipeline ou handoff), troque mensagens tipadas de tarefa e resultado e mantenha o estado num único objeto do orquestrador."
  - "Dê a cada execução limite de passos, orçamento de tokens, timeouts por agent e deadline, e devolva resultados parciais com trace id."
---

A demo multi-agent é irresistível. Um agent planejador quebra o problema, um agent pesquisador levanta os fatos, um agent crítico revisa, um agent redator lapida a resposta, e todos conversam entre si num diagrama caprichado. Funciona lindamente nos três prompts que você testou. Aí chega o tráfego real: uma requisição fica em loop entre o crítico e o redator por quarenta turnos, outra trava por dois minutos porque um único agent nunca respondeu, e ninguém consegue explicar por que a conta da última terça triplicou.

Parabéns, você construiu um monólito distribuído: o acoplamento de um sistema único, as falhas parciais de um sistema distribuído e os benefícios de nenhum dos dois. Este post mostra quando mais de um agent se justifica, qual padrão de orquestração escolher, como lidar com estado e orçamentos, e um supervisor em Python executável que faz tudo isso offline. O Júnior Inocente vem junto.

## O problema e o contexto

Em microsserviços, um monólito distribuído é um conjunto de serviços que não podem ser implantados, escalados nem entendidos de forma independente. Sistemas multi-agent caem na mesma armadilha mais rápido, porque a "API" entre agents costuma ser texto livre e os "serviços" são não determinísticos. Os sintomas:

- **Agents que se chamam em ciclos.** O redator pergunta ao crítico, o crítico pergunta ao pesquisador, o pesquisador pergunta ao redator. Ninguém é dono do fluxo, então nada para o loop além da janela de contexto ou do seu cartão de crédito.
- **Contexto compartilhado implícito.** Todo agent recebe o histórico completo "por via das dúvidas", então mudar um prompt muda em silêncio o comportamento de todos.
- **Timeouts em cascata.** A espera por B, que espera por C. C está lento, B dá timeout, A faz retry em B, que chama C de novo. A latência multiplica em vez de somar.
- **Nenhum lugar único para ver o que aconteceu.** Cinco fluxos de log, nenhum identificador em comum e um usuário perguntando por que a resposta saiu errada.
- **Explosão de custo.** Cada salto é pelo menos uma chamada de modelo com um prompt crescente, e ninguém definiu limite porque cada agent parecia barato isoladamente.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Mas agents especializados são simplesmente melhores, né? Um agent pesquisador e um agent redator deveriam ganhar de um generalista fazendo as duas coisas.</span>
    </div>
  </div>
</div>

Às vezes, e bem menos do que os diagramas sugerem. Dividir uma tarefa em agents não é especialização de graça; é um sistema distribuído com mensagens que perdem informação. Cada handoff descarta contexto, soma latência e cria mais um ponto de falha. Um único agent com tools bem desenhadas e um loop que é dono da tarefa inteira costuma ganhar em qualidade, latência e custo em tudo que cabe numa janela de contexto.

Então faça primeiro a pergunta chata: **por que um agent só não consegue fazer isso?** Bons motivos para dividir são concretos:

- **Isolamento de contexto.** Subtarefas precisam de contextos grandes e não relacionados (um codebase, um contrato, um dump de logs) que se atropelariam numa única janela.
- **Permissões diferentes.** Uma parte pode ler dados de clientes, outra só pode rascunhar e-mails. Agents separados com allowlists de tools separadas são uma fronteira de segurança limpa.
- **Paralelismo real.** Investigações independentes que levam segundos cada podem rodar em paralelo.
- **Ownership independente.** Times diferentes são donos, avaliam e publicam capacidades diferentes no seu próprio ritmo.

"Parece mais organizado" não está na lista. Se nada disso se aplica, invista em tools melhores; [Deterministic Tool Calling: Stop Letting the LLM Improvise Your API Calls](/pt-br/blog/deterministic-tool-calling/) mostra como deixar as tools de um agent rígidas o bastante para que você raramente precise de um segundo agent conferindo o primeiro.

## Mergulho na arquitetura

Quando você realmente precisa de vários agents, torne o fluxo de controle **explícito**. Alguém, código ou um agent designado, precisa ser dono da pergunta "o que acontece agora?". A maioria dos sistemas saudáveis usa um de três padrões, ou uma composição simples deles.

### Padrão 1: supervisor (router)

Um supervisor recebe a requisição, decide quais especialistas chamar, envia a cada um uma tarefa com escopo definido, coleta os resultados e os agrega. Especialistas nunca conversam entre si; só respondem ao supervisor.

```text
                  request
                     |
                     v
              +-------------+
              |  supervisor |  owns state, budgets, trace id
              +-------------+
               /     |     \
          task/  task|      \task        (parallel when independent)
             v       v       v
         [logs]  [metrics] [deploys]     specialists: no peer calls
             \       |       /
        result\ result|     /result
               v     v     v
              +-------------+
              |  aggregate  | --> finalizer --> report
              +-------------+
```

Roteamento, orçamentos e tratamento de falhas moram num lugar só. A decisão de roteamento pode vir de um LLM ("quais checagens este incidente precisa?"), mas o supervisor valida e executa o plano em código. O trade-off: o supervisor vira um gargalo de design, e uma decisão de roteamento ruim significa que o especialista certo nunca é chamado.

### Padrão 2: pipeline sequencial

Etapas fixas, cada uma consumindo a saída tipada da anterior. Nenhum roteamento dinâmico.

```text
 request -> [extract] -> [classify] -> [draft reply] -> [policy check] -> output
             typed        typed          typed             typed
```

É o padrão mais previsível e o mais fácil de testar, porque cada etapa tem um contrato claro. Serve para processamento de documentos, triagem e qualquer procedimento conhecido. O trade-off é a rigidez: trabalho que não segue sempre os mesmos passos deixa etapas ociosas, e a latência total é a soma de todas as etapas.

### Padrão 3: handoff entre pares

Um agent fica ativo por vez e transfere explicitamente o controle, junto com um resumo compacto, para outro. Pense num agent de recepção que passa a conversa para um agent de cobrança.

```text
 user <-> [triage agent] --handoff(billing, summary)--> [billing agent] <-> user
                                                              |
                                          handoff(triage, summary) or finish
```

Handoffs combinam com produtos conversacionais em que as fases precisam de tools diferentes. Também são o jeito mais fácil de criar ciclos. Mantenha-os explícitos (uma ação `handoff` estruturada, nunca "o agent decide mandar mensagem para alguém"), conte-os contra um orçamento e proíba devolver o controle a um agent que já o teve no mesmo turno.

| Padrão | Fluxo de controle | Melhor para | Principal risco |
|--------|-------------------|-------------|-----------------|
| Supervisor | Central, roteamento dinâmico | Subtarefas independentes, fan-out e agregação | Roteamento ruim, supervisor como gargalo |
| Pipeline | Sequência fixa de etapas | Procedimentos conhecidos, fluxos de documentos | Rígido, latência é a soma das etapas |
| Handoff | Um agent ativo, transferência explícita | Conversas com fases distintas | Ciclos, contexto perdido a cada transferência |

### Estado e contratos

Seja qual for o padrão, três regras mantêm o sistema depurável:

1. **Mensagens tipadas em toda fronteira.** Entra uma `Task` (id, kind, payload, trace id), sai um `Result` (status, output, error, tokens, duração). Agents recebem só o payload de que precisam, nunca a conversa inteira.
2. **Um único dono para o estado compartilhado.** Um blackboard do orquestrador guarda resultados, orçamentos e o que já rodou. Agents leem sua tarefa e escrevem pelo seu resultado, nunca diretamente.
3. **Passos idempotentes.** Gere um fingerprint de cada tarefa por kind e payload, para que um pedido repetido ou um passo reexecutado seja ignorado ou atendido pelo resultado guardado.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Por que não deixar os agents conversarem livremente entre si? Não é essa a graça de um sistema multi-agent?</span>
    </div>
  </div>
</div>

Conversa livre entre agents é ótima para artigos acadêmicos e péssima para quem está de plantão. N agents trocando mensagens significa N ao quadrado de arestas possíveis, ninguém responsável por encerrar e nenhum lugar para impor orçamento. Se você realmente precisa de debate, rode-o como um loop limitado, de posse de um único orquestrador: um número fixo de rodadas, e para.

### Orçamentos, guardas e falhas

Toda execução precisa de limites rígidos que não dependam de nenhum modelo se comportar bem:

- **Limite de passos.** Número máximo de invocações de agents por execução.
- **Orçamento de tokens ou custo.** Somado entre todos os agents, checado antes de admitir trabalho novo.
- **Timeout por agent.** Imposto com `asyncio.wait_for`, para que um especialista lento não sequestre a execução inteira.
- **Deadline da execução.** Um limite de tempo de relógio para tudo; ao atingi-lo, o trabalho pendente é cancelado de forma limpa.
- **Detecção de trabalho duplicado.** Os fingerprints acima, para que um planejador confuso não dispare a mesma tarefa várias vezes.

Quando algo falha, **degrade, não desabe**. Um agent de métricas que deu timeout não deveria jogar fora os bons achados do agent de logs. Devolva um relatório parcial com status claro, use um fallback (um agent mais barato, dados em cache, uma heurística) quando existir, e escale para um humano com o trace id. Uma resposta parcial que se declara parcial é melhor que um spinner.

<div class="callout warning" data-title="Atenção">
  <p>Nunca faça retry entre fronteiras de agents por padrão. Se cada uma de três camadas aninhadas faz dois retries, uma folha lenta pode gerar 27 chamadas. Faça retry em uma camada só (normalmente a chamada de transporte dentro do agent) e deixe o supervisor tratar um <code>Result</code> com falha como final para aquela execução.</p>
</div>

### Observabilidade

Gere um trace id no ponto de entrada e propague-o por toda tarefa, resultado e linha de log. Registre cada decisão do orquestrador, não só cada chamada de modelo: admitido, ignorado por duplicidade, negado por orçamento, timeout. Com logs em JSON indexados por `trace_id`, "o que aconteceu nesta execução?" vira uma consulta em vez de um projeto de arqueologia.

## Implementação na prática

Vamos construir um supervisor para triagem de incidentes. Dada a descrição de um incidente, ele dispara três especialistas (logs, métricas, deploys) em paralelo e depois roda um sumarizador sobre as evidências que voltaram. Os agents são stubs determinísticos no lugar das chamadas de LLM, então tudo roda offline só com a biblioteca padrão e pytest.

```bash title="terminal"
python -m venv .venv
source .venv/bin/activate   # on Windows: .venv\Scripts\activate
pip install pytest
```

### Mensagens: o contrato

```python title="messages.py"
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


def new_id() -> str:
    return uuid.uuid4().hex[:12]


class Status(str, Enum):
    OK = "ok"
    FAILED = "failed"
    TIMEOUT = "timeout"


@dataclass(frozen=True)
class Task:
    """O que o supervisor pede a um agent. A única entrada que um agent recebe."""

    task_id: str
    kind: str  # chave de roteamento: qual especialista trata a tarefa
    payload: dict[str, Any]
    trace_id: str


@dataclass(frozen=True)
class Result:
    """O que volta de cada salto, com sucesso ou não."""

    task_id: str
    kind: str
    agent: str
    status: Status
    output: dict[str, Any] = field(default_factory=dict)
    error: str = ""
    tokens_used: int = 0
    duration_ms: float = 0.0
```

As duas mensagens são imutáveis: agents não conseguem alterar sua tarefa, e resultados registrados não podem ser editados. Toda falha é um `Status`, não uma exceção subindo pelo orquestrador.

### Agents e a interface do modelo

```python title="agents.py"
import asyncio
import json
from dataclasses import dataclass
from typing import Any, Protocol

from messages import Task


class ModelClient(Protocol):
    async def complete(self, instructions: str, prompt: str) -> tuple[str, int]:
        """Devolve (texto, tokens_usados). Uma implementação real chama seu provedor de LLM aqui."""
        ...


class StubModel:
    """Substituto determinístico de uma chamada de LLM, para tudo rodar offline."""

    def __init__(self, delay_s: float = 0.0, tokens_per_call: int = 100) -> None:
        self.delay_s = delay_s
        self.tokens_per_call = tokens_per_call

    async def complete(self, instructions: str, prompt: str) -> tuple[str, int]:
        await asyncio.sleep(self.delay_s)
        return f"{instructions} | input: {prompt[:60]}", self.tokens_per_call


@dataclass(frozen=True)
class AgentOutput:
    data: dict[str, Any]
    tokens: int = 0


@dataclass(frozen=True)
class Agent:
    name: str
    kind: str
    instructions: str
    model: ModelClient
    timeout_s: float = 2.0

    async def run(self, task: Task) -> AgentOutput:
        # O agent vê só o payload da sua tarefa, nunca o histórico completo dos outros agents
        prompt = json.dumps(task.payload, sort_keys=True)
        text, tokens = await self.model.complete(self.instructions, prompt)
        return AgentOutput(data={"text": text}, tokens=tokens)


def build_agents(delays: dict[str, float] | None = None, timeout_s: float = 2.0) -> list[Agent]:
    delays = delays or {}
    specs = {
        "logs": "Find error patterns in application logs",
        "metrics": "Find anomalies in latency and error-rate metrics",
        "deploys": "List deployments and config changes near the incident",
        "summarize": "Write a short incident summary from the evidence",
    }
    return [
        Agent(
            name=f"{kind}-agent",
            kind=kind,
            instructions=instructions,
            model=StubModel(delay_s=delays.get(kind, 0.0)),
            timeout_s=timeout_s,
        )
        for kind, instructions in specs.items()
    ]
```

O `ModelClient` é a única costura com um provedor real. Implemente `complete` com o seu SDK (nome do modelo vindo da configuração, tokens vindos do usage da resposta) e nada mais muda. O `StubModel` recebe um `delay_s`, que é como os testes simulam um agent lento, e cada `Agent` carrega seu próprio `timeout_s`.

### O supervisor

```python title="orchestrator.py"
import asyncio
import hashlib
import json
import logging
import time
import uuid
from dataclasses import asdict, dataclass, field, replace
from typing import Any

from agents import Agent, build_agents
from messages import Result, Status, Task, new_id

logger = logging.getLogger("orchestrator")


@dataclass(frozen=True)
class Budget:
    max_steps: int = 6  # invocações de agents por execução
    max_tokens: int = 5_000  # somados entre todos os agents
    deadline_s: float = 10.0  # tempo de relógio da execução inteira


@dataclass
class RunState:
    """O blackboard. Pertence ao supervisor; agents nunca mexem nele diretamente."""

    trace_id: str
    steps: int = 0
    tokens: int = 0
    results: dict[str, Result] = field(default_factory=dict)
    fingerprints: set[str] = field(default_factory=set)
    stop_reason: str = ""


@dataclass(frozen=True)
class Report:
    trace_id: str
    status: str  # "complete" | "partial" | "failed"
    stop_reason: str
    summary: str
    needs_human: bool
    steps_used: int
    tokens_used: int
    results: list[Result]


def fingerprint(kind: str, payload: dict[str, Any]) -> str:
    raw = json.dumps([kind, payload], sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


class Supervisor:
    def __init__(self, agents: list[Agent], budget: Budget | None = None, finalizer: str = "summarize") -> None:
        self.agents = {agent.kind: agent for agent in agents}
        self.budget = budget or Budget()
        self.finalizer = finalizer

    def plan(self, request: dict[str, Any], trace_id: str) -> list[Task]:
        # Em produção, um router LLM pode propor esta lista. O supervisor continua decidindo o que roda.
        kinds = request.get("checks", ["logs", "metrics", "deploys"])
        return [Task(new_id(), kind, {"incident": request["incident"]}, trace_id) for kind in kinds]

    async def run(self, request: dict[str, Any]) -> Report:
        state = RunState(trace_id=request.get("trace_id") or uuid.uuid4().hex)
        self._log(state, "run_started", request=request)
        try:
            await asyncio.wait_for(self._run(request, state), timeout=self.budget.deadline_s)
        except asyncio.TimeoutError:
            state.stop_reason = state.stop_reason or "deadline"
        report = self._report(state)
        self._log(state, "run_finished", status=report.status, stop_reason=report.stop_reason)
        return report

    async def _run(self, request: dict[str, Any], state: RunState) -> None:
        # 1. Dispara os especialistas, dentro do orçamento e sem trabalho duplicado
        admitted = [task for task in self.plan(request, state.trace_id) if self._admit(task, state)]
        await asyncio.gather(*(self._dispatch(task, state) for task in admitted))

        # 2. Agrega o que deu certo e roda o finalizador uma única vez
        evidence = {r.kind: r.output["text"] for r in state.results.values() if r.status is Status.OK}
        if not evidence:
            state.stop_reason = state.stop_reason or "no_evidence"
            return
        final = Task(new_id(), self.finalizer, {"incident": request["incident"], "evidence": evidence}, state.trace_id)
        if self._admit(final, state):
            await self._dispatch(final, state)

    def _admit(self, task: Task, state: RunState) -> bool:
        fp = fingerprint(task.kind, task.payload)
        if fp in state.fingerprints:
            self._log(state, "skipped_duplicate", task_id=task.task_id, kind=task.kind)
            return False
        if state.steps >= self.budget.max_steps:
            state.stop_reason = "step_budget"
        elif state.tokens >= self.budget.max_tokens:
            state.stop_reason = "token_budget"
        if state.stop_reason:
            self._log(state, "budget_denied", task_id=task.task_id, kind=task.kind, reason=state.stop_reason)
            return False
        state.fingerprints.add(fp)
        state.steps += 1
        return True

    async def _dispatch(self, task: Task, state: RunState) -> Result:
        agent = self.agents.get(task.kind)
        started = time.perf_counter()
        if agent is None:
            result = Result(task.task_id, task.kind, "none", Status.FAILED, error=f"no agent for kind '{task.kind}'")
        else:
            try:
                out = await asyncio.wait_for(agent.run(task), timeout=agent.timeout_s)
                result = Result(task.task_id, task.kind, agent.name, Status.OK, out.data, tokens_used=out.tokens)
            except asyncio.TimeoutError:
                result = Result(task.task_id, task.kind, agent.name, Status.TIMEOUT, error=f"exceeded {agent.timeout_s}s")
            except Exception as exc:  # CancelledError não é Exception, então o cancelamento continua se propagando
                logger.exception("agent %s crashed", agent.name)
                result = Result(task.task_id, task.kind, agent.name, Status.FAILED, error=f"{type(exc).__name__}: {exc}")
        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        result = replace(result, duration_ms=duration_ms)
        state.results[task.task_id] = result
        state.tokens += result.tokens_used
        self._log(
            state,
            "agent_result",
            task_id=task.task_id,
            agent=result.agent,
            status=result.status.value,
            tokens_used=result.tokens_used,
            duration_ms=duration_ms,
            error=result.error,
        )
        return result

    def _report(self, state: RunState) -> Report:
        results = list(state.results.values())
        final = next((r for r in results if r.kind == self.finalizer and r.status is Status.OK), None)
        problems = [r for r in results if r.status is not Status.OK]
        if final and not problems and not state.stop_reason:
            status = "complete"
        elif any(r.status is Status.OK for r in results):
            status = "partial"
        else:
            status = "failed"
        return Report(
            trace_id=state.trace_id,
            status=status,
            stop_reason=state.stop_reason,
            summary=final.output["text"] if final else "",
            needs_human=status != "complete",
            steps_used=state.steps,
            tokens_used=state.tokens,
            results=results,
        )

    def _log(self, state: RunState, event: str, **fields: Any) -> None:
        record = {"trace_id": state.trace_id, "event": event, "steps": state.steps, "tokens": state.tokens, **fields}
        logger.info(json.dumps(record, default=str))


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    supervisor = Supervisor(build_agents(delays={"metrics": 0.3}, timeout_s=0.2), Budget(max_steps=5))
    report = await supervisor.run({"incident": "checkout p95 latency doubled"})
    print(json.dumps(asdict(report), indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(main())
```

Percorra o código na ordem do que pode dar errado:

- **`_admit` é o único portão.** Toda tarefa, inclusive o finalizador, passa por ele: duplicatas são rejeitadas pelo fingerprint, depois os orçamentos de passos e tokens são checados antes de reservar um passo. Tarefas já em andamento terminam, mas nada novo começa depois que um limite é atingido.
- **`_dispatch` nunca lança exceção por problema de agent.** Rota inexistente, timeout e crash viram todos um `Result`. Capturar `Exception` deixa `asyncio.CancelledError` de fora (ela herda de `BaseException`), então o deadline da execução ainda consegue cancelar agents em andamento.
- **`run` envolve tudo num deadline.** Agents pendentes são cancelados, e os resultados que já estão no blackboard entram no relatório mesmo assim.
- **`_report` é honesto.** `complete` só quando o resumo existe e nada falhou nem foi interrompido, `partial` quando há alguma evidência, `failed` caso contrário. Qualquer coisa diferente de `complete` liga o `needs_human`.

A demo no `main` deixa o agent de métricas mais lento que o seu timeout de propósito, então `python orchestrator.py` mostra um relatório parcial montado a partir dos especialistas que responderam.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>Se o agent de métricas deu timeout, o supervisor não deveria só tentar de novo até funcionar?</span>
    </div>
  </div>
</div>

Só se você topar pagar o timeout dele de novo a cada tentativa enquanto o usuário espera. Um timeout normalmente significa que o agent está travado (uma consulta de logs enorme, um upstream lento), e um retry imediato bate na mesma parede. O trabalho do supervisor é entregar a melhor resposta dentro do orçamento: registrar o timeout, resumir as evidências que tem e marcar o relatório para um humano. Se um retry fizer sentido, transforme-o numa política deliberada: uma tentativa, escopo menor, contada contra o mesmo limite de passos.

### Testando a orquestração

Estes testes usam pytest puro com `asyncio.run` dentro de cada teste, então o plugin `pytest-asyncio` não é necessário.

```python title="test_orchestrator.py"
import asyncio

from agents import build_agents
from messages import Status
from orchestrator import Budget, Supervisor

INCIDENT = {"incident": "checkout p95 latency doubled", "trace_id": "trace-test"}


def run(supervisor: Supervisor, request: dict | None = None):
    # pytest puro: cada teste controla o event loop por conta própria, sem plugin
    return asyncio.run(supervisor.run(request or INCIDENT))


def statuses(report) -> dict[str, Status]:
    return {r.kind: r.status for r in report.results}


def test_normal_run_completes_with_summary():
    report = run(Supervisor(build_agents()))
    assert report.status == "complete"
    assert report.stop_reason == ""
    assert not report.needs_human
    assert report.steps_used == 4  # três especialistas + o sumarizador
    assert report.tokens_used == 400
    assert set(statuses(report).values()) == {Status.OK}
    assert report.summary.startswith("Write a short incident summary")
    assert report.trace_id == "trace-test"


def test_step_budget_exhaustion_returns_partial_report():
    report = run(Supervisor(build_agents(), Budget(max_steps=2)))
    assert report.steps_used == 2
    assert report.stop_reason == "step_budget"
    assert report.status == "partial"
    assert report.needs_human
    assert report.summary == ""
    assert statuses(report) == {"logs": Status.OK, "metrics": Status.OK}


def test_token_budget_stops_before_finalizer():
    report = run(Supervisor(build_agents(), Budget(max_tokens=150)))
    assert report.stop_reason == "token_budget"
    assert "summarize" not in statuses(report)
    assert report.status == "partial"


def test_timed_out_agent_does_not_sink_the_run():
    agents = build_agents(delays={"metrics": 0.5}, timeout_s=0.1)
    report = run(Supervisor(agents))
    kinds = statuses(report)
    assert kinds["metrics"] is Status.TIMEOUT
    assert kinds["logs"] is Status.OK and kinds["deploys"] is Status.OK
    assert kinds["summarize"] is Status.OK  # o finalizador rodou com as evidências que chegaram
    assert report.status == "partial"
    assert report.needs_human


def test_duplicate_subtasks_run_once():
    request = {**INCIDENT, "checks": ["logs", "logs", "metrics"]}
    report = run(Supervisor(build_agents()), request)
    assert report.steps_used == 3  # logs, metrics, summarize
    assert [r.kind for r in report.results].count("logs") == 1


def test_unknown_route_fails_without_crashing():
    request = {**INCIDENT, "checks": ["logs", "tracing"]}
    report = run(Supervisor(build_agents()), request)
    assert statuses(report)["tracing"] is Status.FAILED
    assert report.status == "partial"


def test_run_deadline_cancels_slow_work():
    agents = build_agents(delays={"logs": 1.0, "metrics": 1.0, "deploys": 1.0}, timeout_s=5.0)
    report = run(Supervisor(agents, Budget(deadline_s=0.2)))
    assert report.stop_reason == "deadline"
    assert report.status == "failed"
    assert report.needs_human
```

```bash title="terminal"
pytest -q
```

Os testes verificam a forma da execução, não o texto do resumo: passos usados, por que parou, quais agents tiveram sucesso, se um humano precisa olhar. São essas as propriedades que quebram em produção, e elas são determinísticas quando o modelo fica atrás de uma interface.

<div class="callout tip" data-title="Dica">
  <p>Mantenha o stub do modelo mesmo depois de plugar um provedor real. Testes de orquestração com <code>StubModel</code> rodam em milissegundos e pegam regressões de orçamento, roteamento e timeout a cada commit, enquanto avaliações mais lentas contra o modelo real rodam de forma agendada.</p>
</div>

## Checagem de realidade em produção

O exemplo é pequeno de propósito. Veja o que muda quando ele deixa de ser.

### A latência se soma entre os saltos

Cada salto sequencial adiciona pelo menos uma ida e volta ao modelo, então quatro etapas custam cerca de quatro chamadas de latência antes de qualquer retry. O fan-out paralelo só ajuda em trabalho independente, e a execução continua tão lenta quanto o especialista mais lento mais a agregação. Coloque timeouts e deadline desde o primeiro dia e meça a latência por salto, para saber qual agent otimizar ou remover.

### Inchaço de contexto

O "conserto" mais fácil para um agent confuso é mais histórico, que também é o jeito mais rápido de multiplicar o custo. Passe um payload compacto e tipado: a tarefa, a evidência de que ele precisa, um resumo curto em vez da transcrição. Se um agent vive precisando de tudo que os outros viram, esses agents provavelmente deveriam ser um só.

### Avaliando um sistema multi-agent

Notas de ponta a ponta dizem que algo está errado, não onde. Avalie cada agent contra o seu próprio contrato (dado este payload, o resultado está correto e no formato esperado?) e a execução inteira contra os desfechos (resposta certa, passos, tokens, com que frequência terminou `partial`). Os logs indexados por trace são o seu dataset, e reexecutar traces guardados contra uma nova versão de agent é um teste de regressão barato.

### Versionando agents de forma independente

Se os agents são separados para que times possam publicá-los separadamente, trate as mensagens deles como qualquer outra API. Versione os schemas de tarefa e resultado, mantenha a versão antiga rodando enquanto os chamadores migram e registre a versão do agent em todo `Result`. Senão, a mudança de prompt de um time quebra em silêncio o parser de outro, o que é o monólito distribuído de novo.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>A gente já dividiu tudo em agents. Juntar de volta não é dar um passo para trás?</span>
    </div>
  </div>
</div>

É um passo em direção a algo que funciona. Junte agents quando aparecerem os sinais: dois agents sempre chamados juntos, handoffs que carregam o contexto inteiro de qualquer forma, um agent que só reformata a saída de outro, ou falhas que vivem vindo das emendas. Juntar transforma um salto que perde informação numa chamada de função dentro de um único contexto. Regra de bolso: se você não consegue dizer qual motivo (contexto, permissões, paralelismo, ownership) justifica uma fronteira, remova-a.

Nada disso é exótico. É a mesma disciplina que já aplicamos a serviços: dono explícito do fluxo, contratos tipados, uma única fonte de verdade para o estado, orçamentos em todo lugar, respostas degradadas em vez de travamentos e um trace id amarrando tudo. Comece com um agent. Divida só por um motivo que você consegue nomear. E, quando dividir, garanta que sempre haja alguém responsável por dizer "chega".
