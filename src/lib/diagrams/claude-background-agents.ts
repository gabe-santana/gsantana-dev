import { defineDiagram, e, n } from "@/lib/diagrams/define";

// content/posts/*/claude-background-agents.md
const unattendedRun = defineDiagram((t) => ({
  title: t("UNATTENDED RUN", "EXECUÇÃO SEM SUPERVISÃO"),
  heading: t("DECIDED BEFORE ANYONE LEAVES", "DECIDIDO ANTES DE TODO MUNDO SAIR"),
  accessible: t(
    "An unattended agent run has five parts. A trigger starts it: a cron schedule, a GitHub event, a webhook or a queue message. A runner hosts it: your own machine, a GitHub Actions runner, a container you operate or an Anthropic cloud session. The agent loop runs inside guardrails decided in advance: an allowlist of tools, hooks that can block a call, a sandbox around the filesystem and network, and caps on turns, dollars and wall-clock time. The output is something a person reviews later, a branch with a pull request, a comment or a report file, never a direct push to production. Finally a notification says the run finished and whether it succeeded, and every run keeps its session id and a log of tool calls, so a failed run can be inspected or resumed.",
    "Uma execução de agente sem supervisão tem cinco partes. Um gatilho inicia a execução: um agendamento cron, um evento do GitHub, um webhook ou uma mensagem numa fila. Um runner hospeda a execução: a sua máquina, um runner do GitHub Actions, um contêiner que você opera ou uma sessão na nuvem da Anthropic. O loop do agente roda dentro de proteções decididas antes: uma lista de ferramentas permitidas, hooks que podem bloquear uma chamada, um sandbox em volta do sistema de arquivos e da rede, e limites de turnos, dólares e tempo. A saída é algo que uma pessoa revisa depois, um branch com pull request, um comentário ou um arquivo de relatório, nunca um push direto para produção. Por fim, uma notificação avisa que a execução terminou e se deu certo, e toda execução guarda o id da sessão e um log das chamadas de ferramenta, para que uma execução que falhou possa ser inspecionada ou retomada."
  ),
  desktop: {
    cols: 3,
    rows: 3,
    gapX: 56,
    nodes: [
      n("trigger", 0, 0, "violet", t("Trigger", "Gatilho"), [t("cron, GitHub event", "cron, evento do GitHub"), t("webhook, queue", "webhook, fila")]),
      n("runner", 1, 0, "blue", t("Runner", "Runner"), [t("your machine, Actions", "sua máquina, Actions"), t("container, cloud session", "contêiner, sessão na nuvem")]),
      n("loop", 2, 0, "accent", t("Agent loop", "Loop do agente"), [t("claude -p or Agent SDK", "claude -p ou Agent SDK")]),
      n("guard", 2, 1, "danger", t("Guardrails, set in advance", "Proteções, definidas antes"), [
        t("allowlist, hooks, sandbox", "allowlist, hooks, sandbox"),
        t("max turns, budget, timeout", "turnos, orçamento, timeout"),
      ]),
      n("output", 1, 2, "amber", t("Reviewable output", "Saída revisável"), [t("branch + PR, comment", "branch + PR, comentário"), t("report file", "arquivo de relatório")]),
      n("notify", 0, 2, "muted", t("Notify + log", "Notifica + log"), [t("result, cost, session id", "resultado, custo, id da sessão")]),
    ],
    edges: [
      e("trigger", "runner", { tone: "violet" }),
      e("runner", "loop", { tone: "blue" }),
      e("loop", "guard", { tone: "danger", arrow: "both", flow: false, label: t("every call", "cada chamada"), labelSide: "right" }),
      e("guard", "output", { tone: "amber", route: "vh" }),
      e("output", "notify", { tone: "muted" }),
      e("notify", "trigger", { tone: "muted", dashed: true, label: t("next run or resume", "próxima ou retomada"), labelSide: "left" }),
    ],
  },
  mobile: {
    cols: 2,
    rows: 4,
    nodes: [
      n("trigger", 0, 0, "violet", t("Trigger", "Gatilho"), t("cron, event, webhook", "cron, evento, webhook")),
      n("runner", 1, 0, "blue", t("Runner", "Runner"), t("machine, CI, cloud", "máquina, CI, nuvem")),
      n("loop", 1, 1, "accent", t("Agent loop", "Loop do agente"), t("claude -p, SDK", "claude -p, SDK")),
      n("guard", 0, 1, "danger", t("Guardrails", "Proteções"), t("allowlist, hooks, caps", "allowlist, hooks, limites")),
      n("output", 1, 2.4, "amber", t("Reviewable output", "Saída revisável"), t("PR, comment, report", "PR, comentário")),
      n("notify", 0, 2.4, "muted", t("Notify + log", "Notifica + log"), t("result, cost, id", "resultado, custo, id")),
    ],
    edges: [
      e("trigger", "runner", { tone: "violet" }),
      e("runner", "loop", { tone: "blue" }),
      e("loop", "guard", { tone: "danger", arrow: "both", flow: false }),
      e("loop", "output", { tone: "amber" }),
      e("output", "notify", { tone: "muted" }),
    ],
  },
}));

const chooseRunner = defineDiagram((t) => {
  const yes = t("yes", "sim");
  const no = t("no", "não");
  return {
    title: t("WHERE IT RUNS", "ONDE RODA"),
    heading: t("TWO QUESTIONS PICK THE RUNNER", "DUAS PERGUNTAS ESCOLHEM O RUNNER"),
    accessible: t(
      "Two questions pick where an unattended Claude agent should run. First: does the job need something that only exists on your machine, such as local files, a VPN or a GPU? If yes, ask whether a Claude Code session is open anyway. If it is, use /loop inside it or send it to the background with claude --bg. If not, run claude -p from cron, systemd or the Windows Task Scheduler, or use a Desktop scheduled task. If the job doesn't need your machine, ask whether it is part of your own product. If it isn't, use a routine in the cloud or a GitHub Actions workflow. If it is, run the Agent SDK in a container you operate, or Claude Managed Agents, where Anthropic hosts the harness and the sandbox.",
      "Duas perguntas escolhem onde um agente Claude sem supervisão deve rodar. Primeira: o trabalho precisa de algo que só existe na sua máquina, como arquivos locais, uma VPN ou uma GPU? Se sim, pergunte se já existe uma sessão do Claude Code aberta. Se existe, use /loop dentro dela ou mande a sessão para o background com claude --bg. Se não, rode claude -p a partir do cron, do systemd ou do Agendador de Tarefas do Windows, ou use uma tarefa agendada do Desktop. Se o trabalho não precisa da sua máquina, pergunte se ele faz parte do seu próprio produto. Se não faz, use uma routine na nuvem ou um workflow do GitHub Actions. Se faz, rode o Agent SDK num contêiner que você opera, ou o Claude Managed Agents, em que a Anthropic hospeda o harness e o sandbox."
    ),
    desktop: {
      cols: 4,
      rows: 3,
      gapX: 24,
      nodes: [
        n("local", 1.5, 0, "violet", t("Needs your machine?", "Precisa da sua máquina?"), t("local files, VPN, GPU", "arquivos locais, VPN, GPU")),
        n("open", 0.5, 1, "violet", t("Session open anyway?", "Já tem sessão aberta?")),
        n("product", 2.5, 1, "violet", t("Part of your product?", "Faz parte do seu produto?")),
        n("loop", 0, 2, "accent", "/loop, claude --bg", t("dies on reboot", "morre no reboot")),
        n("cron", 1, 2, "accent", t("claude -p + cron", "claude -p + cron"), t("or a Desktop task", "ou tarefa do Desktop")),
        n("cloud", 2, 2, "blue", t("Routine, Actions", "Routine, Actions"), t("schedule, API, events", "agenda, API, eventos")),
        n("sdk", 3, 2, "amber", t("Agent SDK, Managed", "Agent SDK, Managed"), t("your container or theirs", "seu contêiner ou o deles")),
      ],
      edges: [
        e("local", "open", { tone: "violet", label: yes, labelTone: "accent" }),
        e("local", "product", { tone: "violet", label: no, labelTone: "blue" }),
        e("open", "loop", { tone: "accent", label: yes, labelTone: "accent" }),
        e("open", "cron", { tone: "accent", label: no, labelTone: "accent" }),
        e("product", "cloud", { tone: "blue", label: no, labelTone: "blue" }),
        e("product", "sdk", { tone: "amber", label: yes, labelTone: "amber" }),
      ],
    },
    mobile: {
      cols: 2,
      rows: 4,
      nodes: [
        n("local", 0, 0, "violet", t("Needs your machine?", "Precisa da sua máquina?"), t("files, VPN, GPU", "arquivos, VPN, GPU"), { span: 2 }),
        n("open", 0, 1, "violet", t("Yes: session open?", "Sim: sessão aberta?")),
        n("product", 1, 1, "violet", t("No: your product?", "Não: seu produto?")),
        n("loop", 0, 2, "accent", t("Yes: /loop, --bg", "Sim: /loop, --bg")),
        n("cloud", 1, 2, "blue", t("No: Routine, Actions", "Não: Routine, Actions")),
        n("cron", 0, 3, "accent", t("No: -p + cron", "Não: -p + cron")),
        n("sdk", 1, 3, "amber", t("Yes: SDK, Managed", "Sim: SDK, Managed")),
      ],
      edges: [
        e("local", "open", { tone: "violet" }),
        e("local", "product", { tone: "violet" }),
        e("open", "loop", { tone: "accent" }),
        e("product", "cloud", { tone: "blue" }),
      ],
    },
  };
});

export const backgroundAgentDiagrams: Record<string, ReturnType<typeof defineDiagram>> = {
  "bg-agents-unattended-run": unattendedRun,
  "bg-agents-choose-runner": chooseRunner,
};
