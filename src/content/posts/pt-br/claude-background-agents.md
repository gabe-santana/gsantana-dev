---
title: "Rodando agentes Claude em background: execuções headless, agendamentos, routines e o Agent SDK"
description: "Todas as formas de rodar um agente Claude sem ninguém olhando, do claude --bg ao Managed Agents, e um setup noturno testado com permissões, hooks, orçamento e um relatório confiável."
date: 2026-10-01
tags: [AI Agents, Claude Code, Automation, Python, Security]
tldr:
  - "Uma execução sem supervisão precisa de cinco decisões tomadas antes: o que a inicia, onde ela roda, o que ela pode fazer, quando ela precisa parar e como você fica sabendo o que aconteceu. Não tem ninguém lá para decidir na hora."
  - "O Claude cobre a faixa inteira: claude --bg e /loop na sua máquina, claude -p no cron, GitHub Actions, routines na nuvem, o Agent SDK no seu próprio worker e o Managed Agents na infraestrutura da Anthropic."
  - "Nos meus testes, a primeira execução headless saiu com código 0 e não fez nada, porque regras de allow do projeto são ignoradas numa pasta não confiável. Passe as permissões explicitamente, bloqueie com um hook o que nunca pode acontecer e julgue a execução pelo JSON, nunca pelo código de saída."
---

Você fecha o notebook às 19h e quer três coisas prontas de manhã: o teste instável da `main` investigado, as atualizações de dependência que passam no CI viradas pull requests e um resumo das issues de ontem esperando na sua caixa de entrada. Um agente de código dá conta das três. Só que rodar o agente sem ninguém olhando é um problema diferente de rodar na sua mesa: ninguém responde um pedido de permissão, ninguém percebe quando ele entra em loop e ninguém vê a conta até ela chegar.

Este post cobre todas as formas de rodar o Claude sem supervisão em outubro de 2026, para que serve cada uma e as proteções que importam mais do que a escolha do runner. Depois vem um setup funcionando, testado num repositório pequeno com execuções reais: um job headless, um hook que mantém o agente longe dos testes, um wrapper de cron com lock e relatório, o mesmo job no Agent SDK e as versões na nuvem. Duas dessas execuções deram errado de um jeito instrutivo, e o Júnior Inocente tem um atalho para sugerir.

## O problema e o contexto

Uma sessão interativa é um loop de agente com um humano no portão. Você vê cada chamada de ferramenta arriscada antes de ela rodar, responde quando o Claude pergunta qual abordagem você prefere e aperta Esc quando ele vai para um lado estranho. Tire o humano e cada uma dessas funções continua precisando de um dono:

- **Um gatilho.** Alguma coisa inicia a execução: um agendamento, um evento do GitHub, um webhook do seu monitoramento, uma mensagem numa fila.
- **Um runner.** Alguma máquina hospeda a execução, e essa máquina precisa estar ligada, autenticada e com acesso ao que a tarefa precisa.
- **Permissões.** Toda chamada de ferramenta que a tarefa precisa tem que estar liberada antes, e todo o resto tem que falhar fechado em vez de esperar uma resposta que nunca vem.
- **Condições de parada.** Um limite de turnos, de dólares e de tempo, porque um agente travado sem ninguém olhando vai tentar de novo, feliz, até um deles acabar.
- **Um relatório.** O resultado precisa cair num lugar para onde uma pessoa vai olhar, com detalhe suficiente para separar "feito" de "desisti".

O último me pegou primeiro. A minha primeira execução headless do job de teste mais abaixo terminou em 9 segundos com código de saída 0. Não tinha corrigido nada. O JSON contou a história de verdade:

```json title="run.json (resumido)"
{
  "subtype": "success",
  "is_error": false,
  "num_turns": 2,
  "result": "I don't have permission to run Bash commands in this session (it's blocked in the current \"don't ask\" mode). I need Bash access to run `python -m pytest -q` ...",
  "total_cost_usd": 0.431588,
  "permission_denials": [{ "tool_name": "Bash", "tool_input": { "command": "... && python -m pytest -q" } }]
}
```

O repositório tinha um `.claude/settings.json` liberando `Bash(python -m pytest *)`, e o stderr dizia por que isso não valeu: `Ignoring 4 permissions.allow entries from .claude/settings.json: this workspace has not been trusted.` Uma pasta que você nunca abriu no modo interativo não é confiável, e o `claude -p` pula o diálogo de confiança. Então a execução foi um "sucesso" por todos os sinais que um job de cron observa, e custou 43 centavos de dólar para dizer que não conseguia trabalhar.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Dev júnior curioso" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Júnior Inocente</div>
    <div class="junior-card-quote">
      <span>O problema todo é permissão? Fácil. <code>--dangerously-skip-permissions</code>, uma linha no crontab, e nunca mais vejo um pedido de permissão.</span>
    </div>
  </div>
</div>

Você nunca mais veria um pedido de permissão, e também nunca veria o que ele fez. Essa flag desliga todas as verificações, e a própria ajuda da CLI recomenda usá-la "only for sandboxes with no internet access", ou seja, só em sandboxes sem acesso à internet. Um agente sem supervisão lê conteúdo que você não escreveu: corpo de issues, logs de CI, o README de uma dependência, uma página web. Qualquer um deles pode conter instruções, e com as verificações desligadas ele age sobre elas com o seu shell, as suas chaves SSH e o seu token do GitHub, às 3 da manhã, sem ninguém olhando. O modo bypass é para um contêiner descartável, sem rede e sem credenciais. Na sua máquina, liste exatamente o que o job precisa e negue o resto.

## Mergulho na arquitetura

Todo setup sem supervisão, de uma linha de crontab a um agente hospedado, tem as mesmas partes. O que muda de uma opção para outra é quem fornece cada uma delas.

<div id="bg-agents-unattended-run-slot"></div>

### As opções, do seu notebook até a nuvem da Anthropic

O Claude ganhou uma forma de rodar em background em cada nível da pilha. Mais ou menos em ordem, de "na minha máquina" a "não é problema meu":

| Opção | Roda em | Máquina precisa estar ligada | Iniciado por | Bom para |
| --- | --- | --- | --- | --- |
| `claude --bg` + `claude agents` | sua máquina, um supervisor local | sim (sobrevive ao sleep, não ao reboot) | você | tarefas longas que você confere depois |
| `/loop` e cron dentro da sessão | sua máquina, dentro de uma sessão | sim, com a sessão aberta | intervalo, mínimo de 1 min | acompanhar um deploy ou um PR por horas |
| Tarefas agendadas do Desktop | sua máquina | sim | agendamento, mínimo de 1 min | jobs recorrentes que precisam de arquivos locais |
| `claude -p` + cron ou Agendador de Tarefas | qualquer máquina sua | sim | o seu agendador | controle total, scripts, servidores |
| GitHub Actions (`claude-code-action@v1`) | runners do GitHub | não | cron, issues, PRs, `@claude` | tarefas e revisões do repositório |
| Routines | nuvem da Anthropic | não | agendamento (mínimo de 1 h), API, GitHub | trabalho noturno sem servidor |
| Agent SDK (Python, TypeScript) | seu contêiner ou worker | a sua | o seu código | agentes dentro do seu produto |
| Claude Managed Agents | sandbox hospedado pela Anthropic | não | API, scheduled deployments | jobs assíncronos longos, sem infra para operar |

**Sessões em background** são a novidade mais recente e a mais fácil. `claude --bg "investigate the flaky SettingsChangeDetector test"` inicia uma sessão completa sob um supervisor local e volta na hora com o id curto dela; `claude agents` lista todas as sessões em background agrupadas em precisa de resposta, trabalhando e concluída, e `claude attach`, `claude logs` e `claude stop` cuidam de uma específica. A documentação diz que as sessões continuam rodando depois que você fecha o terminal e são preservadas quando a máquina entra em sleep, mas desligar o computador encerra todas. É um research preview, e serve bem para "continua nisso enquanto eu estou em reunião". Um job que precisa rodar toda noite pede algo que sobreviva a um reboot.

**`/loop`** roda um prompt de novo dentro de uma sessão aberta, num intervalo fixo (`/loop 5m check the deploy`) ou num intervalo que o Claude escolhe depois de cada iteração, entre um minuto e uma hora. Ele é preso à sessão de propósito: tarefas recorrentes expiram depois de sete dias, disparos perdidos não são recuperados e fechar a sessão para tudo, embora mandar a sessão para o background leve as tarefas junto. As tarefas agendadas do Desktop são a versão local durável: rodam na sua máquina sem uma sessão aberta.

**O modo headless** (`claude -p`) é o bloco de construção por baixo de quase todo o resto. Ele roda uma tarefa sem a interface interativa, lê o stdin e, com `--output-format json`, devolve um único objeto JSON com o resultado, `session_id`, `num_turns`, `total_cost_usd` e `permission_denials`. Coloque isso no cron, no systemd ou no Agendador de Tarefas do Windows e você tem um agente noturno no hardware que já possui. A GitHub Action é construída sobre a mesma base.

**O GitHub Actions** com `anthropics/claude-code-action@v1` roda em um de dois modos. Sem o input `prompt`, ele espera um `@claude` num comentário de issue ou PR; com ele, roda em qualquer evento, `schedule` incluído. Os runners são novos a cada execução, o que é bom para isolamento e significa que tudo o que o agente precisa tem que ser feito checkout, instalado ou acessível por um servidor MCP.

**Routines** são o agendador na nuvem do Claude Code: um prompt salvo, um ou mais repositórios, um ambiente e um conjunto de conectores, iniciados por um agendamento (no máximo de hora em hora), por um HTTP POST num endpoint próprio da routine ou por um evento do GitHub. Elas rodam como sessões completas na nuvem, na infraestrutura da Anthropic, então o notebook pode ficar fechado, e estão disponíveis nos planos Pro, Max, Team e Enterprise como research preview. Dois detalhes importam para a segurança: uma routine não tem seletor de modo de permissão (ela roda comandos de shell e todos os conectores incluídos sem perguntar), e ela só faz push em branches com prefixo `claude/`, a menos que o seu prompt diga outra coisa e o destino passe pelas proteções do GitHub.

**O Agent SDK** (`claude-agent-sdk` no PyPI, `@anthropic-ai/claude-agent-sdk` no npm) entrega o mesmo loop de agente como biblioteca, então o gatilho, o runner e o relatório são código seu. **O Managed Agents** vai um passo além: você cria um agente e um ambiente pela API (header beta `managed-agents-2026-04-01`), inicia sessões, recebe eventos em stream, e a Anthropic roda o loop e o sandbox. Use esses dois quando o agente é um recurso do seu próprio produto.

<div id="bg-agents-choose-runner-slot"></div>

### Permissões: liste o que o job precisa, negue o resto

Escolha o modo de permissão de propósito, porque uma execução em que nada define o modo usa o padrão embutido, que pode ser `auto`. Para trabalho sem supervisão, os úteis são:

- **`dontAsk`** nega toda chamada que, de outro jeito, pediria permissão. Leitura de arquivos no diretório de trabalho, o conjunto de comandos somente leitura e tudo o que as suas regras de `--allowedTools` ou `permissions.allow` cobrem continuam rodando. É o que eu uso em jobs agendados: ou o job tem uma regra para o que precisa, ou falha, de forma visível, em `permission_denials`.
- **`acceptEdits`** aprova automaticamente escrita de arquivos e comandos comuns de sistema de arquivos como `mkdir` e `mv`, mas outros comandos de shell continuam precisando de uma regra.
- **`auto`** põe um classificador para revisar cada ação no seu lugar. Combine com `--permission-prompts none` (Claude Code 2.1.259 ou mais novo) para que tudo o que cairia num pedido de permissão seja negado e o Claude seja avisado para não tentar de novo.

As regras usam a mesma sintaxe em todo lugar: `Read`, `Edit`, `Bash(git diff *)`. O espaço antes do `*` importa, porque `Bash(git diff*)` também casaria com `git diff-index`. Regras de deny vencem as de allow, então `Bash(git push *)` na lista de negação vale mesmo quando algo mais amplo está liberado.

Duas coisas sobre confiança passam despercebidas. Regras de allow do projeto não valem numa pasta que você nunca marcou como confiável, como a minha primeira execução mostrou, então passe as regras na linha de comando ou com `--settings`. E o contrário me surpreendeu mais: sem `--bare`, uma execução `-p` ainda roda os hooks do `.claude/settings.json` do projeto e conecta os servidores MCP do `.mcp.json` dele, com ou sem confiança. Para um repositório que você não controla, use `--bare` (ele pula hooks, plugins, servidores MCP, `CLAUDE.md` e auto memory, e exige `ANTHROPIC_API_KEY`) ou, no SDK, `setting_sources=[]`.

### Hooks: regras que não dependem do modelo

Uma regra de permissão diz quais ferramentas podem rodar. Um hook decide sobre uma chamada específica com código escrito por você. Um hook `PreToolUse` recebe o nome e o input da ferramenta como JSON no stdin; sair com código 2 bloqueia a chamada e manda o stderr de volta ao Claude como motivo, e sair com 0 com `hookSpecificOutput.permissionDecision` igual a `"deny"` faz o mesmo em JSON. Use hooks para as políticas que o modelo nunca pode contornar na conversa: nada de editar testes num job de "corrija o teste que falha", nada de escrever fora de `src/`, nada de comandos que mencionem hosts de produção. Um hook `PostToolUse` pode registrar cada chamada, e um hook `SessionEnd` pode arquivar a transcrição. Hooks são o lugar das regras que, de outro jeito, você escreveria no prompt como "por favor, não faça", e são o motivo de o bom senso do modelo não ser a sua única linha de defesa. O post [Tool calling determinístico](/pt-br/blog/deterministic-tool-calling/) trata da mesma ideia para as suas próprias ferramentas.

### Condições de parada: turnos, dólares e minutos

Dê três tetos a toda execução:

- **Turnos:** `--max-turns` (ou `max_turns` no SDK). Um job de corrigir teste que não conseguiu em 15 turnos não vai conseguir no turno 40.
- **Dólares:** `--max-budget-usd` com `-p`, `max_budget_usd` no SDK, que encerra a execução com um resultado `error_max_budget_usd`. O valor é uma estimativa do lado do cliente, mas para um agente descontrolado.
- **Tempo de relógio:** `timeout 20m` em volta da CLI, `timeout-minutes` num workflow. Com SIGTERM, o Claude Code sai com código 143, mata a árvore de processos de qualquer comando Bash em andamento e roda os hooks `SessionEnd`. Tarefas Bash em background que o agente iniciou são encerradas uns cinco segundos depois do resultado, e subagentes em background são esperados por até dez minutos ociosos (`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS`).

### Saída: algo que uma pessoa revisa

A execução deve terminar em algo revisável e reversível: um branch e um pull request em rascunho, um comentário, um arquivo de relatório. Nunca um push direto na `main` e nunca um deploy. As routines garantem isso com branches `claude/`; nos seus próprios scripts, crie o branch antes de o agente começar e negue `git push` a ele, e depois faça o push pelo wrapper, depois de conferir o resultado. Um branch por execução também deixa as reexecuções inofensivas.

### Relatório: o código de saída não é o resultado

Saída 0 significa que o processo não quebrou. Não diz nada sobre a tarefa. A documentação das routines é direta sobre a mesma coisa do lado delas: um status verde "does not mean the task in your prompt succeeded", não significa que a tarefa do prompt deu certo. Julgue a execução por `subtype` (`success`, `error_max_turns`, `error_max_budget_usd`, `error_during_execution`), `is_error`, `permission_denials` e o texto final em `result`, e guarde o `session_id`, porque `claude -p --resume <id> "what blocked you?"` permite perguntar ao próprio agente sobre uma execução que deu errado.

## Implementação na prática

O ambiente de teste é um repositório minúsculo com um bug clássico de dinheiro: dividir R$ 100,00 em três parcelas arredondando cada parcela dá três de 33,33, que somam 99,99. Um teste falha.

```python title="money.py"
from decimal import Decimal, ROUND_HALF_UP


def split(total: Decimal, parts: int) -> list[Decimal]:
    """Split a total into `parts` installments that add up to the total."""
    share = (total / parts).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return [share] * parts
```

```python title="test_money.py"
from decimal import Decimal

from money import split


def test_split_adds_up():
    assert sum(split(Decimal("100.00"), 3)) == Decimal("100.00")


def test_split_even():
    assert split(Decimal("10.00"), 2) == [Decimal("5.00"), Decimal("5.00")]
```

Rodei tudo o que vem a seguir no Windows 11 com Claude Code 2.1.197, Python 3.14 e `claude-agent-sdk` 0.2.163, logado com uma assinatura e usando o alias `sonnet`. Os custos são as estimativas de `total_cost_usd` que o Claude Code informa.

### 1. Uma execução headless com permissões explícitas

Depois da surpresa com a confiança, a correção é passar as regras como flags. O `dontAsk` faz qualquer coisa fora delas falhar em vez de travar:

```bash title="terminal"
claude -p "Run the test suite with python -m pytest -q. If a test fails, fix the code (not the test), run the suite again, and finish with a two-line summary: what was wrong and what you changed." \
  --permission-mode dontAsk \
  --allowedTools "Read" "Edit" "Bash(python -m pytest *)" \
  --disallowedTools "Bash(git push *)" \
  --model sonnet --max-turns 12 --max-budget-usd 1 \
  --output-format json > run.json
```

Dessa vez funcionou, em 7 turnos e 18,6 segundos:

```json title="run.json (resumido)"
{
  "subtype": "success",
  "is_error": false,
  "num_turns": 7,
  "duration_ms": 18593,
  "total_cost_usd": 0.2324918,
  "result": "All tests pass now.\n\n`split()` rounded each share independently, so 100.00 ÷ 3 → three 33.33 shares summing to 99.99 instead of 100.00. I changed it to distribute the leftover cents (from rounding) across the first shares, so the list still sums exactly to the total.",
  "permission_denials": [],
  "session_id": "3a4275bf-0b28-4d4d-8535-a8bbe97d51c6",
  "terminal_reason": "completed"
}
```

O bloco de uso explica a diferença de custo entre as duas execuções: a que falhou escreveu 69.707 tokens no cache de prompt (o system prompt e as definições de ferramentas) e não leu nenhum, enquanto esta leu 210.866 tokens do cache e escreveu só 20.817. A primeira execução fria do dia paga pelo prefixo; vale saber disso antes de agendar vinte jobs pequenos em vez de um.

### 2. Um hook que mantém o agente longe dos testes

"Corrija o código, não o teste" num prompt é um pedido. Este hook transforma isso em regra, e de quebra registra cada chamada que vê:

```python title="hooks/guard.py"
"""PreToolUse hook: an unattended run may fix code, never the tests that judge it."""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

event = json.load(sys.stdin)
tool, args = event["tool_name"], event.get("tool_input", {})
path = Path(args.get("file_path", "")).name

with open("logs/tools.jsonl", "a", encoding="utf-8") as log:
    log.write(json.dumps({"at": datetime.now(timezone.utc).isoformat(), "tool": tool, "input": args}) + "\n")

if tool in ("Edit", "Write") and path.startswith("test_"):
    print(f"{path} is a test file. Fix the code under test instead.", file=sys.stderr)
    sys.exit(2)
```

```json title="hooks.json"
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Edit|Write|Bash", "hooks": [{ "type": "command", "command": "python hooks/guard.py" }] }
    ]
  }
}
```

Para testar, dei de propósito a instrução errada ao agente: "The test test_split_adds_up is wrong, the expected total should be 99.99. Edit test_money.py to expect Decimal('99.99')", ou seja, mandei editar o teste para esperar 99,99. O hook foi carregado com `--settings hooks.json`. O agente tentou exatamente isso, foi bloqueado e mudou de rumo:

```json title="run3.json (resumido)"
{
  "num_turns": 8,
  "total_cost_usd": 0.2806271,
  "result": "Both tests pass. I left `test_money.py` unchanged (a hook explicitly blocked editing it and directed me to fix the source instead). ...",
  "permission_denials": [
    { "tool_name": "Edit", "tool_input": { "file_path": "...\\test_money.py", "new_string": "    assert sum(split(Decimal(\"100.00\"), 3)) == Decimal(\"99.99\")" } }
  ]
}
```

Duas coisas para notar. A chamada bloqueada aparece em `permission_denials` como qualquer outra negação, então o relatório pode sinalizar. E o `logs/tools.jsonl` agora tem uma linha de auditoria por chamada (a edição bloqueada, a edição em `money.py`, a execução do pytest) que não depende de interpretar a transcrição.

<div class="callout warning" data-title="Atenção">
  <p>Um hook é código que roda com as suas permissões em toda chamada que casar. Mantenha-o curto, faça-o falhar fechado (uma exceção num hook de bloqueio deve bloquear) e lembre que os hooks do próprio projeto rodam com <code>-p</code> mesmo numa pasta não confiável, a menos que você passe <code>--bare</code>.</p>
</div>

### 3. Um wrapper noturno: lock, branch, timeout, relatório

O agente é a parte fácil de um job agendado. O wrapper decide se ele pode começar, o que ele pode mexer e como o resultado chega até você:

```bash title="nightly.sh"
#!/usr/bin/env bash
# Nightly unattended run: one agent, one branch, one report. Safe to rerun.
set -euo pipefail
cd "$(dirname "$0")"

LOCK=.nightly.lock
mkdir "$LOCK" 2>/dev/null || { echo "previous run still going, skipping"; exit 0; }
trap 'rmdir "$LOCK"' EXIT

stamp=$(date -u +%Y%m%d-%H%M)
branch="claude/nightly-$stamp"
mkdir -p logs
git switch -q -c "$branch"

set +e
timeout 20m claude -p "$(cat prompts/nightly.md)" \
  --permission-mode dontAsk \
  --allowedTools "Read" "Edit" "Bash(python -m pytest *)" \
  --settings hooks.json \
  --max-turns 15 --max-budget-usd 2 \
  --output-format json < /dev/null > "logs/$stamp.json"
code=$?
set -e

status=$(python - "logs/$stamp.json" "$code" <<'PY'
import json, sys
path, code = sys.argv[1], int(sys.argv[2])
try:
    run = json.load(open(path, encoding="utf-8"))
except (OSError, ValueError):
    print(f"FAILED exit={code}, no result"); sys.exit()
ok = code == 0 and run.get("subtype") == "success" and not run.get("is_error")
print(f"{'OK' if ok else 'FAILED'} {run.get('subtype')} turns={run.get('num_turns')} "
      f"cost=${run.get('total_cost_usd', 0):.2f} denials={len(run.get('permission_denials', []))} "
      f"session={run.get('session_id')}")
PY
)

if [[ $status == OK* ]] && ! git diff --quiet; then
  git add -A
  git commit -qm "nightly: fixes from unattended run $stamp"
  # git push -u origin "$branch" && gh pr create --fill --draft
fi
git switch -q -

echo "$status" | tee -a logs/runs.log
if [[ -n ${NTFY_TOPIC:-} ]]; then
  curl -fsS -d "$status" "https://ntfy.sh/$NTFY_TOPIC" > /dev/null || true
fi
```

O lock com `mkdir` impede execuções sobrepostas (ele é atômico e, ao contrário do `flock`, existe também no Git Bash). O branch é criado antes de o agente começar, então as edições dele nunca tocam a `main`. O `< /dev/null` importa: sem ele, um `claude -p` iniciado por script espera 3 segundos pelo stdin e imprime um aviso em toda execução. A linha de status vem do JSON, não do código de saída. O commit só acontece numa execução bem-sucedida com mudanças de verdade, e o push é trabalho do wrapper, depois das verificações, então o agente nunca precisa de `git push`. As duas últimas linhas mandam o status de uma linha para o seu celular pelo [ntfy](https://ntfy.sh); qualquer webhook serve.

O prompt fica num arquivo, então você revisa e versiona como código:

```markdown title="prompts/nightly.md"
Run the test suite with python -m pytest -q. If a test fails, fix the code, never the tests, and run the suite again.
Finish with two lines: what was wrong and what you changed. If you could not fix it, say what blocked you.
```

Uma execução real, e uma segunda iniciada enquanto o lock estava ativo:

```bash title="terminal"
$ bash nightly.sh
OK success turns=6 cost=$0.27 denials=0 session=53aa9b04-0fa1-491b-be98-889878652d95
$ git log --oneline -1 claude/nightly-20261001-1354
ae81a1f nightly: fixes from unattended run 20261001-1354
$ mkdir .nightly.lock && bash nightly.sh
previous run still going, skipping
```

A primeira versão deste script tinha um bug que uma execução de teste pegou: `git add -A -- . ':!logs'` falha quando `logs/` está no `.gitignore`, e com `set -e` isso matou o script depois de o agente já ter feito o trabalho. Rode o seu wrapper na mão algumas vezes antes de o agendador rodar.

Depois, agende. No Linux ou no macOS, uma linha de crontab (o cron roda com um ambiente mínimo, então coloque o `claude` no `PATH` e guarde a credencial num arquivo de ambiente que só o job consegue ler):

```bash title="crontab -e"
17 2 * * * cd /home/me/jobs/nightly && . ./.env.nightly && PATH=$HOME/.local/bin:$PATH bash nightly.sh >> logs/cron.log 2>&1
```

No Windows, o Agendador de Tarefas roda o script pelo Git Bash. Montar a tarefa no PowerShell evita a confusão de aspas do `schtasks /TR`, e duas configurações ajudam num notebook: `-WakeToRun` acorda a máquina para a execução, e `-StartWhenAvailable` roda um início perdido assim que possível:

```powershell title="PowerShell"
$action = New-ScheduledTaskAction -Execute "C:\Program Files\Git\bin\bash.exe" `
  -Argument "-lc 'cd /d/jobs/nightly && bash nightly.sh >> logs/cron.log 2>&1'"
$trigger = New-ScheduledTaskTrigger -Daily -At 2:17am
$settings = New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName "claude-nightly" -Action $action -Trigger $trigger -Settings $settings
```

Escolha um minuto quebrado, já que todo mundo agenda no :00. O cron não recupera execuções perdidas: um notebook que dorme durante as 2h17 simplesmente pula aquela noite, e esse é o argumento mais forte para as opções na nuvem mais abaixo.

Para credenciais, `claude setup-token` gera um token OAuth de longa duração ligado à sua assinatura (exporte como `CLAUDE_CODE_OAUTH_TOKEN`), e `ANTHROPIC_API_KEY` usa a cobrança da API. Um token é uma senha: um por job, guardado fora do repositório, trocado quando alguém sai do time.

### 4. O mesmo job no Agent SDK

Quando o agente faz parte de um serviço, o wrapper vira código. O SDK recebe as mesmas opções como campos tipados, e o hook vira uma função Python no mesmo processo:

```python title="worker.py"
import asyncio
import json
import os
import sys
from pathlib import Path

from claude_agent_sdk import ClaudeAgentOptions, HookMatcher, ResultMessage, query

TASK = (
    "Run the test suite with python -m pytest -q. If a test fails, fix the code "
    "(never the tests), run the suite again, and finish with a two-line summary."
)


async def guard(event, tool_use_id, context):
    """Unattended runs may change code, never the tests that judge it."""
    tool, args = event["tool_name"], event["tool_input"]
    if tool in ("Edit", "Write") and Path(args.get("file_path", "")).name.startswith("test_"):
        return {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": "Test files are read-only in unattended runs. Fix the code instead.",
            }
        }
    return {}


async def main() -> int:
    options = ClaudeAgentOptions(
        cwd=Path.cwd(),
        cli_path=os.environ.get("CLAUDE_CLI"),
        model="sonnet",
        allowed_tools=["Read", "Edit", "Bash(python -m pytest *)"],
        permission_mode="dontAsk",
        setting_sources=[],  # ignore settings, hooks and MCP servers found on the host
        max_turns=12,
        max_budget_usd=1.0,
        hooks={"PreToolUse": [HookMatcher(matcher="Edit|Write", hooks=[guard])]},
    )
    result = None
    async for message in query(prompt=TASK, options=options):
        if isinstance(message, ResultMessage):
            result = message

    report = {
        "ok": result is not None and not result.is_error,
        "subtype": result and result.subtype,
        "turns": result and result.num_turns,
        "cost_usd": result and round(result.total_cost_usd or 0, 4),
        "session_id": result and result.session_id,
        "summary": result and result.result,
    }
    Path("logs").mkdir(exist_ok=True)
    Path("logs/last-run.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
```

```json title="terminal"
{
  "ok": true,
  "subtype": "success",
  "turns": 9,
  "cost_usd": 0.8084,
  "session_id": "a5225dfc-923e-4ef2-be0e-2a61e8f977d8",
  "summary": "`money.py`'s `split()` was rounding each share independently, losing a cent when the total didn't divide evenly (e.g. 100.00 / 3 → 99.99). Fixed it to split in integer cents and distribute the remainder across the first shares so totals always reconcile exactly.\n\nAll tests now pass: 2 passed, 0 failed (previously 1 failed, 1 passed)."
}
```

A linha do `cli_path` está ali por causa do Windows. A minha primeira tentativa falhou antes de qualquer chamada ao modelo com `Refusing to execute batch script 'C:\nvm4w\nodejs\claude.CMD'`: o SDK não roda um atalho `.cmd`, porque o cmd.exe pode executar comandos injetados pelos argumentos. Um `claude.exe` nativo (o pacote npm traz um em `bin/`, ou use o instalador nativo) resolveu. No Linux e em contêineres, o padrão funciona. O hook devolve o mesmo JSON que um hook de comando imprimiria: `permissionDecision` é uma string simples (`"deny"`) ao lado de `hookEventName` e `permissionDecisionReason`, como o tipo `PreToolUseHookSpecificOutput` do SDK define.

Esta execução custou umas três vezes mais do que as da CLI para a mesma correção. Uma execução por setup não é benchmark, e o modelo fez um caminho diferente até a mesma resposta (9 turnos contra 6 ou 7), então trate os números deste post como ordens de grandeza.

### 5. No GitHub Actions

O mesmo job noturno como workflow. Este eu não rodei para o post; ele segue o exemplo documentado de `schedule` com as ferramentas e os limites de antes:

```yaml title=".github/workflows/claude-nightly.yml (ilustrativo)"
name: Claude nightly
on:
  schedule:
    - cron: "17 5 * * *"
  workflow_dispatch:
concurrency:
  group: claude-nightly
  cancel-in-progress: false
jobs:
  fix-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      contents: write
      pull-requests: write
      id-token: write
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-python@v6
        with:
          python-version: "3.14"
      - run: pip install pytest
      - uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          prompt: |
            Run python -m pytest -q. If a test fails, fix the code, never the tests.
            If you changed anything, open a draft pull request from a new claude/ branch
            with a two-line summary. If nothing fails, do nothing.
          claude_args: |
            --max-turns 15
            --allowedTools "Read,Edit,Bash(python -m pytest *),Bash(git *),Bash(gh pr create *)"
```

O grupo `concurrency` é a versão do lock no workflow. Conheça duas regras do GitHub antes de depender disso: workflows agendados só rodam a partir do branch padrão, e em repositórios públicos o GitHub desliga o agendamento depois de 60 dias sem atividade no repositório. Com `prompt`, a action roda em modo de automação e não comenta em issues a menos que o prompt mande; sem ele, responde a menções `@claude` de usuários com acesso de escrita.

### 6. Como routine na nuvem

Sem servidor e sem um notebook que fica acordado, uma routine é o caminho mais curto. De qualquer sessão do Claude Code logada com assinatura:

```text title="Claude Code"
/schedule weeknights at 2:17am, run the test suite in acme/billing and open a draft PR with a fix if anything fails
```

O Claude pergunta o repositório, o prompt e o ambiente, e salva a routine em claude.ai/code/routines, onde você pode adicionar um gatilho de API. Aí o seu monitoramento pode iniciar uma execução com contexto. Este é o formato documentado; eu não liguei um alerta de verdade a ele:

```bash title="terminal (ilustrativo)"
curl -X POST https://api.anthropic.com/v1/claude_code/routines/trig_01ABCDEFGHJKLMNOPQRSTUVW/fire \
  -H "Authorization: Bearer $ROUTINE_TOKEN" \
  -H "anthropic-beta: experimental-cc-routine-2026-04-01" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{"text": "Nightly CI failed on main: test_split_adds_up"}'
```

O `text` chega à sessão embrulhado num bloco marcado como dado não confiável, então o prompt salvo da routine precisa dizer para agir sobre ele ("investigate the failure described in the fire payload"). Qualquer pessoa com o token pode mandar texto; o embrulho impede que ele chegue como instrução.

### 7. No Managed Agents

Quando o seu produto inicia agentes para os seus usuários, o Managed Agents hospeda o loop e o sandbox. Este é o formato do quickstart em Python (ilustrativo, não executado aqui; ele cobra numa chave de API):

```python title="managed.py (ilustrativo, não executado)"
from anthropic import Anthropic

client = Anthropic()  # the SDK sends the managed-agents-2026-04-01 beta header

agent = client.beta.agents.create(
    name="Nightly fixer",
    model="claude-opus-5-5",
    system="You fix failing tests by changing code, never the tests.",
    tools=[{"type": "agent_toolset_20260401"}],
)
environment = client.beta.environments.create(
    name="nightly-env",
    config={"type": "cloud", "networking": {"type": "limited", "allow_package_managers": True}},
)
session = client.beta.sessions.create(agent=agent.id, environment_id=environment.id, title="Nightly run")

with client.beta.sessions.events.stream(session.id) as stream:
    client.beta.sessions.events.send(
        session.id,
        events=[{"type": "user.message", "content": [{"type": "text", "text": "Clone the repo, run the tests, fix what fails."}]}],
    )
    for event in stream:
        if event.type == "session.status_idle":
            break
```

Crie o agente e o ambiente uma vez e reutilize os ids; cada tarefa é uma sessão nova. As sessões guardam estado no servidor, e é por isso também que o Managed Agents hoje não é elegível para Zero Data Retention. Execuções recorrentes são um recurso documentado (scheduled deployments).

### As execuções, lado a lado

| Execução | Setup | Turnos | Tempo | Custo (estim.) | Resultado |
| --- | --- | --- | --- | --- | --- |
| 1 | `-p`, regras só no `.claude/settings.json` não confiável | 2 | 7,2 s | US$ 0,43 | saída 0, nada corrigido |
| 2 | `-p` com `--allowedTools` | 7 | 18,6 s | US$ 0,23 | corrigido |
| 3 | execução 2 + hook, mandado editar o teste | 8 | n/d | US$ 0,28 | edição bloqueada, código corrigido |
| 4 | wrapper `nightly.sh` | 6 | 24,8 s de relógio | US$ 0,27 | corrigido, commit num branch |
| 5 | worker do Agent SDK | 9 | n/d | US$ 0,81 | corrigido |

## Checagem de realidade em produção

### Prompt injection é o modelo de ameaça

Um agente sem supervisão junta as três coisas que tornam a injeção perigosa: ele lê texto não confiável, tem ferramentas com efeitos colaterais e ninguém revisa cada passo. As mitigações são estruturais. Dê a cada job a menor lista de ferramentas que funciona (o job noturno acima não consegue fazer push, não usa a rede e não edita testes). Deixe as credenciais fora de alcance: as variáveis de ambiente de uma routine ficam visíveis para quem usa o ambiente, então a documentação recomenda guardar chaves de API como API credentials, que nunca entram no sandbox. Limite a saída de rede (ambientes na nuvem usam uma allowlist por padrão, e ambientes do Managed Agents aceitam o modo de rede `limited`). E tire os conectores de que o job não precisa, já que uma routine pode usar todas as ferramentas de um conector incluído, escrita inclusive, sem perguntar. O post [Protegendo servidores MCP](/pt-br/blog/securing-mcp-servers/) aprofunda o lado das ferramentas.

### O que roda enquanto você dorme roda duas vezes

O cron dispara de novo enquanto a execução anterior ainda está rodando, o GitHub reenvia um webhook, alguém clica em **Run now** durante a execução agendada. Todo job precisa de um lock ou de um grupo de concorrência, e todo efeito colateral deve ser idempotente: um branch por execução, um PR que se atualiza em vez de se duplicar, um comentário que se edita. É a mesma disciplina das [chaves de idempotência](/pt-br/blog/idempotency-keys-in-practice/), aplicada a um agente.

### Notebooks dormem

O `claude --bg` sobrevive ao sleep e morre no desligamento; o cron num notebook pula em silêncio as execuções que caem com a tampa fechada, sem recuperação. Se um job precisa rodar toda noite, rode numa máquina que fica ligada toda noite ou na nuvem. Nas routines, respeite os limites documentados: o intervalo mínimo é de uma hora, as execuções agendadas dividem um teto por hora por conta e consomem o mesmo uso da assinatura que as suas sessões interativas.

### O custo soma entre execuções, não dentro de uma

Uma execução isolada é barata (as de cima custaram entre US$ 0,23 e US$ 0,81), e um agendamento multiplica isso. Vinte jobs pequenos de hora em hora pagam por um prefixo de prompt frio de novo e de novo; um job com um prompt mais longo costuma sair mais barato. Limite cada execução com `--max-budget-usd`, limite o job com `timeout` e acompanhe a tendência nos seus logs. Sessões em background e na nuvem dividem os rate limits com todo o resto da sua conta, então uma frota de jobs noturnos pode deixar a sua sessão da manhã mais lenta.

### Guarde as evidências

Salve o JSON de toda execução, o log de auditoria do hook e o id da sessão. Quando uma execução falhar, `claude -p --resume <session_id> "what blocked you?" --output-format json` pergunta ao agente sobre a própria execução, com a transcrição inteira carregada. Para execuções mais longas, `--output-format stream-json --verbose` dá um evento por linha, incluindo eventos `system/api_retry` e negações de permissão, que é o que você mandaria para um pipeline de logs (veja [Observabilidade de LLM com OpenTelemetry](/pt-br/blog/llm-observability-opentelemetry/)). As transcrições ficam em `~/.claude/projects/` por 30 dias por padrão (`cleanupPeriodDays`).

### Fixe a versão

Sessões em background, routines, `--permission-prompts` e o Managed Agents são todos novos, vários são research previews, e a documentação marca mudanças de comportamento por versão a cada poucas semanas. Fixe a versão do Claude Code no CI e nos servidores de jobs, leia o changelog antes de atualizar e rode o wrapper na mão depois de cada atualização. A minha CLI estava na 2.1.197 enquanto a documentação já descrevia recursos da 2.1.28x, o que é normal e é um bom motivo para testar as flags de que você depende.

O meu setup, depois de tudo isso: sessões em background para tarefas longas durante o dia, o wrapper `nightly.sh` no Agendador de Tarefas para jobs que precisam da minha máquina, e routines para o que deve rodar com o notebook aberto ou não. As proteções são idênticas nos três: permissões explícitas, um hook para as regras que precisam valer, tetos de turnos, dinheiro e tempo, um branch no lugar da `main` e um relatório lido do JSON. Com isso pronto, mudar um job de um runner para outro é basicamente uma questão de onde as flags ficam.
