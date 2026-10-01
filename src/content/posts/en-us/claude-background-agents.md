---
title: "Running Claude Agents in the Background: Headless Runs, Schedules, Routines and the Agent SDK"
description: "Every way to run a Claude agent while nobody is watching, from claude --bg to Managed Agents, and a tested nightly setup with permissions, hooks, budgets and a report you can trust."
date: 2026-10-01
tags: [AI Agents, Claude Code, Automation, Python, Security]
tldr:
  - "An unattended run needs five decisions made in advance: what starts it, where it runs, what it may do, when it must stop and how you find out what happened. Nobody is there to make them live."
  - "Claude offers the whole range: claude --bg and /loop on your machine, claude -p under cron, GitHub Actions, cloud routines, the Agent SDK in your own worker and Managed Agents on Anthropic's infrastructure."
  - "In my tests the first headless run exited 0 and did nothing, because project allow rules are ignored in an untrusted folder. Pass permissions explicitly, block what must never happen with a hook, and judge a run by its JSON, never by its exit code."
---

You close the laptop at 7 p.m. and want three things done by morning: the flaky test on `main` investigated, the dependency bumps that pass CI turned into pull requests, and a summary of yesterday's issues waiting in your inbox. A coding agent can do all three. Running it with nobody watching is a different problem from running it at your desk, though: nobody answers a permission prompt, nobody notices when it loops, and nobody sees the bill until it arrives.

This post covers every way to run Claude unattended as of October 2026, what each one is good for, and the guardrails that matter more than the choice of runner. Then a working setup, tested on a small repo with real runs: a headless job, a hook that keeps the agent away from the tests, a cron wrapper with a lock and a report, the same job on the Agent SDK, and the cloud versions. Two of those runs went wrong in instructive ways, and the Naive Junior has a shortcut to suggest.

## The Problem & Context

An interactive session is an agent loop with a human gate on it. You see each risky tool call before it runs, you answer when Claude asks which approach you prefer, and you hit Escape when it heads somewhere silly. Take the human away and every one of those jobs still needs an owner:

- **A trigger.** Something starts the run: a schedule, a GitHub event, a webhook from your monitoring, a message on a queue.
- **A runner.** Some machine hosts it, and that machine has to be awake, authenticated and allowed to reach what the task needs.
- **Permissions.** Every tool call the task needs must be allowed ahead of time, and everything else must fail closed instead of waiting for an answer that never comes.
- **Stop conditions.** A cap on turns, on dollars and on wall-clock time, because a stuck agent with no one watching will happily retry until one of them runs out.
- **A report.** The result has to land somewhere a person will look, with enough detail to tell "done" from "gave up".

The last one bit me first. My very first headless run of the test job below finished in 9 seconds with exit code 0. It had fixed nothing. The JSON told the real story:

```json title="run.json (trimmed)"
{
  "subtype": "success",
  "is_error": false,
  "num_turns": 2,
  "result": "I don't have permission to run Bash commands in this session (it's blocked in the current \"don't ask\" mode). I need Bash access to run `python -m pytest -q` ...",
  "total_cost_usd": 0.431588,
  "permission_denials": [{ "tool_name": "Bash", "tool_input": { "command": "... && python -m pytest -q" } }]
}
```

The repo had a `.claude/settings.json` allowing `Bash(python -m pytest *)`, and stderr said why it didn't count: `Ignoring 4 permissions.allow entries from .claude/settings.json: this workspace has not been trusted.` A folder you never opened interactively is untrusted, and `claude -p` skips the trust dialog. So the run was a "success" by every signal a cron job looks at, and it cost 43 cents to say it couldn't work.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Permissions are the whole problem? Easy. <code>--dangerously-skip-permissions</code>, a crontab line, and I never see a prompt again.</span>
    </div>
  </div>
</div>

You'd never see a prompt again, and you'd never see what it did either. That flag turns every check off, and the CLI's own help recommends it "only for sandboxes with no internet access". An unattended agent reads content you didn't write: issue bodies, CI logs, a dependency's README, a web page. Any of it can contain instructions, and with every check off it acts on them with your shell, your SSH keys and your GitHub token, at 3 a.m., with nobody looking. Bypass mode belongs inside a throwaway container with no network and no credentials. On your machine, list exactly what the job needs and deny the rest.

## Deep Dive / Architectural Design

Every unattended setup, from a crontab line to a hosted agent, has the same parts. What changes from one option to the next is who provides each of them.

<div id="bg-agents-unattended-run-slot"></div>

### The options, from your laptop to Anthropic's cloud

Claude has grown a way to run in the background at every level of the stack. In rough order from "on my machine" to "not my problem":

| Option | Runs on | Machine must be on | Started by | Good for |
| --- | --- | --- | --- | --- |
| `claude --bg` + `claude agents` | your machine, a local supervisor | yes (survives sleep, not reboot) | you | long tasks you check on later |
| `/loop` and in-session cron | your machine, inside a session | yes, session open | interval, 1 min minimum | polling a deploy or a PR for hours |
| Desktop scheduled tasks | your machine | yes | schedule, 1 min minimum | recurring jobs that need local files |
| `claude -p` + cron or Task Scheduler | any machine you run | yes | your scheduler | full control, scripts, servers |
| GitHub Actions (`claude-code-action@v1`) | GitHub runners | no | cron, issues, PRs, `@claude` | repo chores and reviews |
| Routines | Anthropic cloud | no | schedule (1 h minimum), API, GitHub | nightly work without a server |
| Agent SDK (Python, TypeScript) | your container or worker | yours | your code | agents inside your own product |
| Claude Managed Agents | Anthropic-hosted sandbox | no | API, scheduled deployments | long async jobs, no infra to run |

**Background sessions** are the newest and the easiest. `claude --bg "investigate the flaky SettingsChangeDetector test"` starts a full session under a local supervisor and returns at once with its short id; `claude agents` lists every background session grouped into needs input, working and completed, and `claude attach`, `claude logs` and `claude stop` manage one. The docs say sessions keep running after you close the terminal and are preserved when the machine sleeps, while a shutdown stops them. It's a research preview, and it fits "keep working on this while I'm in meetings". A job that has to run every night needs something that survives a reboot.

**`/loop`** reruns a prompt inside an open session, either on a fixed interval (`/loop 5m check the deploy`) or at an interval Claude picks after each iteration, between one minute and one hour. It's session-scoped by design: recurring tasks expire after seven days, there's no catch-up for missed fires, and closing the session stops them, although backgrounding the session carries them along. Desktop scheduled tasks are the durable local version: they run on your machine without an open session.

**Headless mode** (`claude -p`) is the building block under almost everything else. It runs one task without the interactive UI, reads stdin, and with `--output-format json` returns a single JSON object with the result, `session_id`, `num_turns`, `total_cost_usd` and `permission_denials`. Put it under cron, systemd or the Windows Task Scheduler and you have a nightly agent on hardware you already own. The GitHub Action is built on the same machinery.

**GitHub Actions** with `anthropics/claude-code-action@v1` runs in one of two modes. Without a `prompt` input it waits for `@claude` in an issue or PR comment; with one, it runs on any event, `schedule` included. Runners are fresh every time, which is good for isolation and means anything the agent needs has to be checked out, installed or reachable through an MCP server.

**Routines** are Claude Code's cloud scheduler: a saved prompt, one or more repositories, an environment and a set of connectors, started by a schedule (hourly at most), an HTTP POST to a per-routine endpoint or a GitHub event. They run as full cloud sessions on Anthropic's infrastructure, so the laptop can stay closed, and they're available on Pro, Max, Team and Enterprise as a research preview. Two details matter for safety: a routine has no permission-mode picker (it runs shell commands and every included connector without asking), and it pushes only to `claude/`-prefixed branches unless your prompt says otherwise and the target passes GitHub's protections.

**The Agent SDK** (`claude-agent-sdk` on PyPI, `@anthropic-ai/claude-agent-sdk` on npm) gives you the same agent loop as a library, so the trigger, the runner and the report are your code. **Managed Agents** go one step further: you create an agent and an environment through the API (beta header `managed-agents-2026-04-01`), start sessions, stream events, and Anthropic runs the loop and the sandbox. Reach for these two when the agent is a feature of your own product.

<div id="bg-agents-choose-runner-slot"></div>

### Permissions: list what the job needs, deny the rest

Pick the permission mode on purpose, because a run where nothing sets one takes the built-in default, which can be `auto`. For unattended work the useful ones are:

- **`dontAsk`** denies every call that would otherwise prompt. File reads in the working directory, the read-only command set and anything your `--allowedTools` or `permissions.allow` rules cover still run. This is the one I use for scheduled jobs: the job either has a rule for what it needs or it fails, visibly, in `permission_denials`.
- **`acceptEdits`** auto-approves file writes and common filesystem commands such as `mkdir` and `mv`, but other shell commands still need a rule.
- **`auto`** has a classifier review each action instead of you. Pair it with `--permission-prompts none` (Claude Code 2.1.259 or later) so anything that would fall back to a prompt is denied and Claude is told not to retry it.

Rules use the same syntax everywhere: `Read`, `Edit`, `Bash(git diff *)`. The space before the `*` matters, because `Bash(git diff*)` would also match `git diff-index`. Deny rules win over allow rules, so `Bash(git push *)` in the deny list holds even when something broader is allowed.

Two things about trust are easy to miss. Project allow rules don't apply in a folder you never trusted, as my first run showed, so pass them on the command line or with `--settings`. And the reverse surprised me more: without `--bare`, a `-p` run still executes the hooks in the project's `.claude/settings.json` and connects the MCP servers in its `.mcp.json`, trusted or not. For a repo you don't control, use `--bare` (it skips hooks, plugins, MCP servers, `CLAUDE.md` and auto memory, and needs `ANTHROPIC_API_KEY`) or, in the SDK, `setting_sources=[]`.

### Hooks: rules that don't depend on the model

A permission rule says which tools may run. A hook decides about a specific call with code you wrote. A `PreToolUse` hook receives the tool name and input as JSON on stdin; exiting with code 2 blocks the call and sends stderr back to Claude as the reason, and exiting 0 with `hookSpecificOutput.permissionDecision` set to `"deny"` does the same in JSON. Use hooks for the policies the model must never talk its way around: no edits to tests in a "fix the failing test" job, no writes outside `src/`, no commands that mention production hosts. A `PostToolUse` hook can log every call, and a `SessionEnd` hook can archive the transcript. Hooks are the place for the rules you'd otherwise write in the prompt as "please don't", and they're the reason a model's good judgment isn't your only line of defense. [Deterministic Tool Calling](/en-us/blog/deterministic-tool-calling/) covers the same idea for your own tools.

### Stop conditions: turns, dollars and minutes

Give every run three ceilings:

- **Turns:** `--max-turns` (or `max_turns` in the SDK). A test-fixing job that hasn't succeeded in 15 turns is not going to on turn 40.
- **Dollars:** `--max-budget-usd` with `-p`, `max_budget_usd` in the SDK, which ends the run with an `error_max_budget_usd` result. The figure is a client-side estimate, but it stops a runaway.
- **Wall-clock time:** `timeout 20m` around the CLI, `timeout-minutes` in a workflow. On SIGTERM, Claude Code exits with 143, kills the process tree of any running Bash command and runs `SessionEnd` hooks. Background Bash tasks the agent started are terminated about five seconds after the result, and background subagents are waited on for up to ten idle minutes (`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS`).

### Output: something a person reviews

The run should end in something reviewable and reversible: a branch and a draft pull request, a comment, a report file. Never a direct push to `main` and never a deploy. Routines enforce this with `claude/` branches; for your own scripts, create the branch before the agent starts and deny `git push` to it, then push from the wrapper after checking the result. One branch per run also makes reruns harmless.

### Reporting: the exit code is not the result

Exit 0 means the process didn't crash. It says nothing about the task. The routines docs are blunt about the same thing on their side: a green status "does not mean the task in your prompt succeeded". Judge a run by `subtype` (`success`, `error_max_turns`, `error_max_budget_usd`, `error_during_execution`), `is_error`, `permission_denials` and the final `result` text, and keep the `session_id`, because `claude -p --resume <id> "what blocked you?"` lets you ask the agent itself about a run that went wrong.

## Hands-On Implementation

The test bed is a tiny repo with a classic money bug: splitting R$ 100.00 into three installments with rounding per share gives three 33.33s, which add up to 99.99. One test fails.

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

I ran everything below on Windows 11 with Claude Code 2.1.197, Python 3.14 and `claude-agent-sdk` 0.2.163, signed in with a subscription and using the `sonnet` alias. Costs are the `total_cost_usd` estimates Claude Code reports.

### 1. A headless run with explicit permissions

After the trust surprise, the fix is to pass the rules as flags. `dontAsk` makes anything outside them fail instead of hang:

```bash title="terminal"
claude -p "Run the test suite with python -m pytest -q. If a test fails, fix the code (not the test), run the suite again, and finish with a two-line summary: what was wrong and what you changed." \
  --permission-mode dontAsk \
  --allowedTools "Read" "Edit" "Bash(python -m pytest *)" \
  --disallowedTools "Bash(git push *)" \
  --model sonnet --max-turns 12 --max-budget-usd 1 \
  --output-format json > run.json
```

This time it worked, in 7 turns and 18.6 seconds:

```json title="run.json (trimmed)"
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

The usage block explains the cost difference between the two runs: the failed one wrote 69,707 tokens to the prompt cache (the system prompt and tool definitions) and read none, while this one read 210,866 cached tokens and wrote only 20,817. A cold first run of the day pays for the prefix; that's worth knowing before you schedule twenty small jobs instead of one.

### 2. A hook that keeps the agent away from the tests

"Fix the code, not the test" in a prompt is a request. This hook makes it a rule, and logs every call it sees on the way:

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

To test it, I gave the agent the wrong instruction on purpose: "The test test_split_adds_up is wrong, the expected total should be 99.99. Edit test_money.py to expect Decimal('99.99')". The hook was loaded with `--settings hooks.json`. The agent tried exactly that, got blocked, and changed course:

```json title="run3.json (trimmed)"
{
  "num_turns": 8,
  "total_cost_usd": 0.2806271,
  "result": "Both tests pass. I left `test_money.py` unchanged (a hook explicitly blocked editing it and directed me to fix the source instead). ...",
  "permission_denials": [
    { "tool_name": "Edit", "tool_input": { "file_path": "...\\test_money.py", "new_string": "    assert sum(split(Decimal(\"100.00\"), 3)) == Decimal(\"99.99\")" } }
  ]
}
```

Two things to notice. The blocked call shows up in `permission_denials` like any other denial, so the report can flag it. And `logs/tools.jsonl` now has an audit line per call (the blocked edit, the edit to `money.py`, the pytest run) that doesn't depend on parsing the transcript.

<div class="callout warning" data-title="Warning">
  <p>A hook is code that runs with your permissions on every matching call. Keep it short, make it fail closed (an exception in a blocking hook should block), and remember that a project's own hooks run under <code>-p</code> even in an untrusted folder unless you pass <code>--bare</code>.</p>
</div>

### 3. A nightly wrapper: lock, branch, timeout, report

The agent is the easy part of a scheduled job. The wrapper decides whether it may start, what it may touch and how the result gets to you:

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

The `mkdir` lock makes overlapping runs impossible (it's atomic, and unlike `flock` it exists in Git Bash too). The branch is created before the agent starts, so its edits never touch `main`. `< /dev/null` matters: without it, `claude -p` launched from a script waits 3 seconds for stdin and prints a warning on every run. The status line comes from the JSON, not from the exit code. The commit happens only on a successful run with real changes, and the push is the wrapper's job, after the checks, so the agent itself never needs `git push`. The last two lines send the one-line status to your phone through [ntfy](https://ntfy.sh); any webhook works.

The prompt lives in a file, so you can review and version it like code:

```markdown title="prompts/nightly.md"
Run the test suite with python -m pytest -q. If a test fails, fix the code, never the tests, and run the suite again.
Finish with two lines: what was wrong and what you changed. If you could not fix it, say what blocked you.
```

A real run, and a second one started while the lock was held:

```bash title="terminal"
$ bash nightly.sh
OK success turns=6 cost=$0.27 denials=0 session=53aa9b04-0fa1-491b-be98-889878652d95
$ git log --oneline -1 claude/nightly-20261001-1354
ae81a1f nightly: fixes from unattended run 20261001-1354
$ mkdir .nightly.lock && bash nightly.sh
previous run still going, skipping
```

The first version of this script had a bug that a test run caught: `git add -A -- . ':!logs'` fails when `logs/` is in `.gitignore`, and with `set -e` that killed the script after the agent had already done its work. Run your wrapper by hand a few times before the scheduler does.

Then schedule it. On Linux or macOS, a crontab line (cron runs with a minimal environment, so put `claude` on the `PATH` and keep the credential in an environment file only the job can read):

```bash title="crontab -e"
17 2 * * * cd /home/me/jobs/nightly && . ./.env.nightly && PATH=$HOME/.local/bin:$PATH bash nightly.sh >> logs/cron.log 2>&1
```

On Windows, the Task Scheduler runs it through Git Bash. Building the task in PowerShell avoids the quoting mess of `schtasks /TR`, and two settings help a laptop: `-WakeToRun` wakes the machine for the run, and `-StartWhenAvailable` runs a missed start as soon as it can:

```powershell title="PowerShell"
$action = New-ScheduledTaskAction -Execute "C:\Program Files\Git\bin\bash.exe" `
  -Argument "-lc 'cd /d/jobs/nightly && bash nightly.sh >> logs/cron.log 2>&1'"
$trigger = New-ScheduledTaskTrigger -Daily -At 2:17am
$settings = New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName "claude-nightly" -Action $action -Trigger $trigger -Settings $settings
```

Pick an odd minute, since everyone schedules at :00. Cron has no catch-up: a laptop that sleeps through 2:17 just skips that night, which is the strongest argument for the cloud options below.

For credentials, `claude setup-token` generates a long-lived OAuth token tied to your subscription (export it as `CLAUDE_CODE_OAUTH_TOKEN`), and `ANTHROPIC_API_KEY` uses API billing instead. A token is a password: one per job, stored outside the repo, rotated when someone leaves.

### 4. The same job on the Agent SDK

When the agent is part of a service, the wrapper becomes code. The SDK takes the same options as typed fields, and the hook becomes a Python function in the same process:

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

The `cli_path` line is there because of Windows. My first attempt failed before any model call with `Refusing to execute batch script 'C:\nvm4w\nodejs\claude.CMD'`: the SDK won't run a `.cmd` shim, because cmd.exe can execute commands injected through arguments. A native `claude.exe` (the npm package ships one in `bin/`, or use the native installer) fixed it. On Linux and in containers, the default works. The hook returns the same JSON a command hook would print: `permissionDecision` is a plain string (`"deny"`) next to `hookEventName` and `permissionDecisionReason`, as the SDK's `PreToolUseHookSpecificOutput` type defines it.

This run cost about three times as much as the CLI runs for the same fix. One run per setup is not a benchmark, and the model took a different path to the same answer (9 turns against 6 or 7), so treat the numbers in this post as orders of magnitude.

### 5. In GitHub Actions

The same nightly job as a workflow. I didn't run this one for the post; it follows the documented `schedule` example with the tools and limits from above:

```yaml title=".github/workflows/claude-nightly.yml (illustrative)"
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

The `concurrency` group is the workflow's version of the lock. Know two GitHub rules before relying on it: scheduled workflows run only from the default branch, and in public repositories GitHub disables the schedule after 60 days without repository activity. With a `prompt`, the action runs in automation mode and posts nothing to issues unless the prompt tells it to; without one, it answers `@claude` mentions from users with write access.

### 6. As a routine in the cloud

Without a server or a laptop that stays awake, a routine is the shortest path. From any Claude Code session signed in with a subscription:

```text title="Claude Code"
/schedule weeknights at 2:17am, run the test suite in acme/billing and open a draft PR with a fix if anything fails
```

Claude asks for the repository, prompt and environment, then saves the routine to claude.ai/code/routines, where you can add an API trigger. Your monitoring can then start a run with context. This is the documented shape; I didn't wire a real alert to it:

```bash title="terminal (illustrative)"
curl -X POST https://api.anthropic.com/v1/claude_code/routines/trig_01ABCDEFGHJKLMNOPQRSTUVW/fire \
  -H "Authorization: Bearer $ROUTINE_TOKEN" \
  -H "anthropic-beta: experimental-cc-routine-2026-04-01" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{"text": "Nightly CI failed on main: test_split_adds_up"}'
```

The `text` reaches the session wrapped in a block labeled as untrusted data, so the routine's saved prompt has to say to act on it ("investigate the failure described in the fire payload"). Anyone with the token can send text; the wrapper keeps it from arriving as an instruction.

### 7. On Managed Agents

When your product starts agents for your users, Managed Agents hosts the loop and the sandbox. This is the quickstart's shape in Python (illustrative, not run here; it bills to an API key):

```python title="managed.py (illustrative, not run)"
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

Create the agent and the environment once and reuse their ids; each task is a new session. Sessions are stateful and stored server-side, which is also why Managed Agents isn't eligible for Zero Data Retention today, and recurring runs are a documented feature (scheduled deployments).

### The runs, side by side

| Run | Setup | Turns | Time | Cost (est.) | Outcome |
| --- | --- | --- | --- | --- | --- |
| 1 | `-p`, rules only in untrusted `.claude/settings.json` | 2 | 7.2 s | $0.43 | exit 0, nothing fixed |
| 2 | `-p` with `--allowedTools` | 7 | 18.6 s | $0.23 | fixed |
| 3 | run 2 + hook, told to edit the test | 8 | n/a | $0.28 | edit blocked, code fixed |
| 4 | `nightly.sh` wrapper | 6 | 24.8 s wall | $0.27 | fixed, committed on a branch |
| 5 | Agent SDK worker | 9 | n/a | $0.81 | fixed |

## Production Reality Check

### Prompt injection is the threat model

An unattended agent combines the three things that make injection dangerous: it reads untrusted text, it has tools with side effects, and nobody reviews each step. The mitigations are structural. Give each job the smallest tool list that works (the nightly job above can't push, can't use the network and can't edit tests). Keep credentials out of reach: a routine's environment variables are visible to anyone who uses the environment, so the docs recommend storing API keys as API credentials, which never enter the sandbox. Limit network egress (cloud environments default to an allowlist, Managed Agents environments take a `limited` networking mode). And remove connectors a job doesn't need, since a routine can use every tool of an included connector, writes included, without asking. [Securing MCP Servers](/en-us/blog/securing-mcp-servers/) goes deeper on the tool side.

### Things that run while you sleep run twice

Cron fires again while the last run is still going, GitHub redelivers a webhook, someone clicks **Run now** during the scheduled run. Every job needs a lock or a concurrency group, and every side effect should be idempotent: one branch per run, a PR that updates instead of duplicating, a comment that edits itself. Same discipline as [idempotency keys](/en-us/blog/idempotency-keys-in-practice/), applied to an agent.

### Laptops sleep

`claude --bg` survives sleep and dies on shutdown; cron on a laptop silently skips the runs that fall while the lid is closed, with no catch-up. If a job must run every night, run it on a machine that is on every night or in the cloud. For routines, mind the documented limits: the minimum interval is one hour, scheduled runs share an hourly cap per account, and runs draw down the same subscription usage as your interactive sessions.

### Cost adds up across runs, not within one

A single run is cheap (the ones above cost between $0.23 and $0.81), and a schedule multiplies it. Twenty small hourly jobs pay for a cold prompt prefix again and again; one job with a longer prompt usually costs less. Cap every run with `--max-budget-usd`, cap the job with `timeout`, and watch the trend in your logs. Background and cloud sessions share rate limits with everything else on your account, so a fleet of nightly jobs can slow down your morning session.

### Keep the evidence

Save the JSON of every run, the hook's audit log and the session id. When a run fails, `claude -p --resume <session_id> "what blocked you?" --output-format json` asks the agent about its own run with the full transcript loaded. For longer runs, `--output-format stream-json --verbose` gives you one event per line, including `system/api_retry` events and permission denials, which is what you'd ship to a log pipeline (see [LLM Observability with OpenTelemetry](/en-us/blog/llm-observability-opentelemetry/)). Transcripts live in `~/.claude/projects/` for 30 days by default (`cleanupPeriodDays`).

### Pin the version

Background sessions, routines, `--permission-prompts` and Managed Agents are all new, several are research previews, and the docs mark behavior changes by version every few weeks. Pin the Claude Code version in CI and on job servers, read the changelog before upgrading, and rerun the wrapper by hand after each upgrade. My CLI was 2.1.197 while the docs already described 2.1.28x features, which is a normal state of affairs and a good reason to test the flags you depend on.

My setup, after all of this: background sessions for long tasks during the day, the `nightly.sh` wrapper under the Task Scheduler for jobs that need my machine, and routines for anything that should run whether my laptop is open or not. The guardrails are identical in all three: explicit permissions, a hook for the rules that must hold, ceilings on turns, money and time, a branch instead of `main`, and a report read from JSON. Once those are in place, moving a job from one runner to another is mostly a matter of where the flags go.
