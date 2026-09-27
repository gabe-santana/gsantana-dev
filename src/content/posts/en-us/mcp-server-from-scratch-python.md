---
title: "Model Context Protocol from Scratch: Build Your First MCP Server in Python"
description: "Build a Python MCP server that exposes tools and data to compatible AI clients."
date: 2025-11-18
tags: [MCP, AI Agents, Python, LLM]
tldr:
  - "MCP separates tools and data from the model host: write one server and any MCP-compatible client can use it."
  - "A server exposes tools (model-controlled actions), resources (app-controlled context) and prompts (user templates) over JSON-RPC, via stdio or Streamable HTTP."
  - "Keep tools narrow and well described, return readable errors, cap output size, and never log to stdout on the stdio transport."
---

Every team building with LLMs eventually writes the same glue code: a function that searches the wiki, another that reads tickets, another that queries the database, each one wrapped in the specific tool-calling format of whichever model or framework was in fashion that month. Then someone wants the same capability inside their IDE, or in a different agent framework, and the glue gets written again.

The Model Context Protocol (MCP) exists to kill that repetition. In this post we'll understand what it actually is (spoiler: it's much less magical than the hype suggests), then build a small but real MCP server in Python, test it, plug it into a client and look at what breaks when you take it to production. The Naive Junior will show up along the way with the questions many people have and few ask.

## The Problem & Context

Picture a company with three AI hosts: a chat assistant, a coding assistant inside the IDE and a homegrown agent that triages alerts. Now picture five internal systems those hosts should reach: the incident tracker, the internal docs, the CRM, the data warehouse and the deploy pipeline.

Without a shared protocol, every host needs its own integration with every system. That's the classic **N-by-M problem**: 3 hosts times 5 systems means 15 integrations, each with its own auth handling, schema format, error conventions and bugs. Add a host, and you owe five more integrations. Add a system, and you owe three.

<div id="mcp-integrations-slot"></div>

MCP turns this into an **N-plus-M problem**. Each system gets wrapped once, as an MCP server. Each host implements the MCP client side once. From then on, any host can talk to any server. If you're old enough to remember life before USB, the analogy writes itself: instead of a different cable for every printer, keyboard and camera, you get one port and one plug.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>But models already have function calling. Isn't MCP just function calling with a fancier name?</span>
    </div>
  </div>
</div>

Not quite. Function calling is the model's ability to say "I want to call `search_docs` with these arguments". It says nothing about where `search_docs` lives, how the host discovers it, how it gets executed or how results flow back. MCP sits one level below: it's the contract between the application that runs the model and the process that owns the tool. The host still uses the model's native function calling; MCP is how the host found out the tool exists and how it executes it. They're complementary, not competitors.

The other important point is ownership. With MCP, the team that owns the incident tracker can ship and maintain the incident MCP server. The AI team doesn't need to understand the tracker's internals, and the tracker team doesn't need to care which model is on the other side. That separation is the real win, more than any line of code saved.

## Deep Dive / Architectural Design

### Host, client and server

MCP has three roles, and mixing them up is the most common source of confusion:

| Role | What it is | Example |
|------|------------|---------|
| Host | The application the user interacts with; it owns the model and the conversation | Claude Desktop, an IDE, your custom agent |
| Client | A connector inside the host that keeps a 1:1 session with one server | One client per configured server |
| Server | A program that exposes tools, resources and prompts | Your incident notes server |

A host with three servers configured runs three clients, one per server. The host decides what to show the model, what to ask the user to approve and how to combine results. The server never talks to the model directly. It just answers requests.

### JSON-RPC 2.0 on the wire

Under the hood, every MCP message is plain JSON-RPC 2.0: requests with an `id`, responses that echo that `id`, and notifications without one. A session starts with an `initialize` handshake where client and server exchange their protocol version and capabilities (does this server offer tools? resources? prompts?). After that, the client can call methods like `tools/list`, `tools/call`, `resources/read` and `prompts/get`.

A tool call looks like this:

```json title="tools-call.json"
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "search_incidents",
    "arguments": { "query": "timeout", "limit": 3 }
  }
}
```

And the response:

```json title="tools-call-response.json"
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [{ "type": "text", "text": "INC-101 | payments-api | Upstream timeout on card processor" }],
    "isError": false
  }
}
```

That's it. No proprietary binary format, no magic. If you can read JSON, you can debug MCP.

### Transports: stdio and Streamable HTTP

The same JSON-RPC messages can travel over different transports:

- **stdio**: the host launches the server as a child process and exchanges messages over stdin and stdout. This is the default for local servers: no ports, no network, and the server inherits the user's machine permissions.
- **Streamable HTTP**: the server runs as an independent HTTP service, clients send messages via HTTP POST, and the server can stream responses back. This is the option for remote, shared servers (for example, one deployed in your cloud and used by the whole company). It replaced the older HTTP+SSE transport, which is now considered legacy.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>So I should always go with HTTP, right? It's the "real" production option.</span>
    </div>
  </div>
</div>

Depends on who uses it. stdio is perfect when the server runs on the same machine as the host and acts on behalf of that one user, like a server that reads local files or calls an API with the user's own token. Streamable HTTP makes sense when the server is shared, centrally deployed and needs proper authentication, rate limiting and observability. Start with stdio while developing; the nice part is that with the Python SDK, switching transports is basically one argument.

### The three primitives

This is where MCP gets more interesting than "remote function calls". A server can expose three kinds of things, and the key difference is **who controls them**:

| Primitive | Controlled by | What it is | Example |
|-----------|---------------|------------|---------|
| Tools | The model | Actions the model decides to invoke, possibly with side effects | `search_incidents`, `add_note` |
| Resources | The application | Read-only context addressed by URI, which the host chooses to attach | `incidents://INC-101` |
| Prompts | The user | Reusable templates the user explicitly picks, often via a slash command or menu | "Draft a postmortem for incident X" |

Tools are the part everyone talks about: the model reads their names, descriptions and input schemas, then decides when to call them. Resources are data the host (or the user through the host) pulls into context, like attaching a file. Prompts are canned workflows that package good instructions so users don't have to write them every time.

Keeping these separate matters for safety and UX. A tool that deletes something should be a tool, so the host can ask the user for confirmation. A reference document should be a resource, so the model isn't burning a tool call just to read static context.

## Hands-On Implementation

Let's build an **incident notes** server: a small service that lets an assistant search past incidents, read their details and append notes. The data lives in memory to keep the example focused, but swapping it for a real database or API is exactly where your own code goes.

### Setup

The official Python SDK is the `mcp` package. The `cli` extra brings the `mcp` command line, including the Inspector launcher.

```bash title="terminal"
python -m venv .venv
source .venv/bin/activate   # on Windows: .venv\Scripts\activate
pip install "mcp[cli]<2"
```

<div class="callout warning" data-title="Warning">
  <p>This post uses the 1.x SDK, hence the <code>&lt;2</code> pin. Version 2 renamed the high-level class: replace <code>from mcp.server.fastmcp import FastMCP</code> with <code>from mcp.server.mcpserver import MCPServer</code> and <code>FastMCP("incident-notes")</code> with <code>MCPServer("incident-notes")</code>. The rest of this example runs the same on both (tested with 1.30 and 2.2). Check your version with <code>pip show mcp</code>.</p>
</div>

### The server

```python title="server.py"
import logging
import sys
from datetime import datetime, timezone

from mcp.server.fastmcp import FastMCP

# Log to stderr: stdout is reserved for JSON-RPC messages on the stdio transport
logging.basicConfig(stream=sys.stderr, level=logging.INFO)
logger = logging.getLogger("incident-notes")

mcp = FastMCP("incident-notes")

# In-memory data to keep the example self-contained
INCIDENTS: dict[str, dict] = {
    "INC-101": {
        "service": "payments-api",
        "severity": "SEV2",
        "title": "Upstream timeout on card processor",
        "summary": "Card authorizations timed out for 18 minutes after the processor rotated its TLS certificate.",
        "notes": [],
    },
    "INC-102": {
        "service": "search",
        "severity": "SEV3",
        "title": "Index lag after bulk import",
        "summary": "A bulk catalog import saturated the indexing queue and results were stale for about an hour.",
        "notes": [],
    },
}

MAX_RESULTS = 10


def _format_incident(incident_id: str, incident: dict) -> str:
    notes = "\n".join(f"- {n}" for n in incident["notes"]) or "(no notes yet)"
    return (
        f"{incident_id} [{incident['severity']}] {incident['service']}\n"
        f"Title: {incident['title']}\n"
        f"Summary: {incident['summary']}\n"
        f"Notes:\n{notes}"
    )


@mcp.tool()
def search_incidents(query: str, limit: int = 5) -> str:
    """Search past incidents by keyword in the title, summary or service name.

    Use this to find incidents similar to a current problem.
    Returns one line per match: id, service and title.
    """
    limit = max(1, min(limit, MAX_RESULTS))
    q = query.lower()
    matches = [
        f"{iid} | {inc['service']} | {inc['title']}"
        for iid, inc in INCIDENTS.items()
        if q in inc["title"].lower() or q in inc["summary"].lower() or q in inc["service"].lower()
    ]
    if not matches:
        return f"No incidents matched '{query}'. Try a broader keyword or a service name."
    return "\n".join(matches[:limit])


@mcp.tool()
def get_incident(incident_id: str) -> str:
    """Get the full details and notes of one incident, by id (for example 'INC-101')."""
    incident = INCIDENTS.get(incident_id.upper())
    if incident is None:
        raise ValueError(f"Incident '{incident_id}' not found. Use search_incidents to find valid ids.")
    return _format_incident(incident_id.upper(), incident)


@mcp.tool()
def add_note(incident_id: str, note: str) -> str:
    """Append a short, timestamped note to an existing incident."""
    incident = INCIDENTS.get(incident_id.upper())
    if incident is None:
        raise ValueError(f"Incident '{incident_id}' not found. Use search_incidents to find valid ids.")
    if not note.strip():
        raise ValueError("Note is empty. Provide the text to append.")
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    incident["notes"].append(f"{stamp}: {note.strip()[:500]}")
    logger.info("Note added to %s", incident_id)
    return f"Note added to {incident_id.upper()}."


@mcp.resource("incidents://{incident_id}")
def incident_resource(incident_id: str) -> str:
    """Read-only view of an incident, for hosts that attach it as context."""
    incident = INCIDENTS.get(incident_id.upper())
    if incident is None:
        return f"Incident '{incident_id}' not found."
    return _format_incident(incident_id.upper(), incident)


@mcp.prompt()
def postmortem_draft(incident_id: str) -> str:
    """Template that asks the model to draft a blameless postmortem."""
    return (
        f"Use the get_incident tool to read {incident_id}. Then draft a blameless postmortem "
        "with these sections: Summary, Impact, Timeline, Root Cause, What Went Well, "
        "Action Items. Do not invent facts that are not in the incident data."
    )


if __name__ == "__main__":
    mcp.run()  # stdio by default
```

A few things are doing a lot of work here. `FastMCP` reads the **type hints** and **docstrings** of each decorated function and turns them into the tool's JSON Schema and description. `query: str, limit: int = 5` becomes a schema with a required string and an optional integer. The docstring becomes the text the model reads when deciding whether to call the tool. In other words, your docstring is now a prompt. Write it like one.

The resource uses a URI template, `incidents://{incident_id}`, and the SDK maps the `{incident_id}` segment to the function argument. The prompt returns a string that becomes a user message in the host.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>Why raise ValueError? Wouldn't it be safer to wrap everything in try/except and return nothing?</span>
    </div>
  </div>
</div>

Returning nothing is the worst option, because the model has no idea what went wrong and will often retry blindly or hallucinate an answer. When a tool function raises, FastMCP catches it and returns a tool result flagged with `isError: true` carrying the message, instead of crashing the server. So the message is what matters: "Incident 'INC-999' not found. Use search_incidents to find valid ids." tells the model exactly how to recover. A raw stack trace, on the other hand, wastes context and can leak internals. Raise with clear, actionable messages for expected problems, and catch unexpected ones at your integration boundary (database, HTTP client) to translate them into something sane.

### Test it with the MCP Inspector

Before connecting any AI host, poke the server by hand. The SDK CLI launches the MCP Inspector, a web UI that acts as a client:

```bash title="terminal"
mcp dev server.py
```

The Inspector needs Node.js available, since it runs via `npx`. Once it opens in your browser, connect, open the Tools tab, call `search_incidents` with `timeout`, try `get_incident` with a bogus id to see the error path, and check that the resource template and the prompt show up. If something looks wrong here, it will look wrong to the model too, just with more confusion.

### Plug it into a client

For Claude Desktop, add an entry to `mcpServers` in `claude_desktop_config.json` (reachable from the app's developer settings). Use absolute paths, and point `command` to the Python inside your virtual environment so the `mcp` package is found:

```json title="claude_desktop_config.json"
{
  "mcpServers": {
    "incident-notes": {
      "command": "/absolute/path/to/project/.venv/bin/python",
      "args": ["/absolute/path/to/project/server.py"]
    }
  }
}
```

On Windows, the interpreter lives at `.venv\Scripts\python.exe`, and backslashes in JSON must be escaped (`C:\\projects\\...`). Restart the app and the tools appear. Other MCP-compatible hosts, including several IDEs, use a very similar `command` plus `args` shape.

### A minimal client of your own

The same server works with your own agent. Here's a minimal client using the SDK's `ClientSession` over stdio. It launches the server, lists its tools and calls one:

```python title="client.py"
import asyncio

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

server_params = StdioServerParameters(command="python", args=["server.py"])


async def main() -> None:
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            tools = await session.list_tools()
            for tool in tools.tools:
                print(f"{tool.name}: {tool.description}")

            result = await session.call_tool("search_incidents", arguments={"query": "timeout"})
            for item in result.content:
                if item.type == "text":
                    print(item.text)


if __name__ == "__main__":
    asyncio.run(main())
```

In a real agent, you'd convert each entry of `tools.tools` (name, description and `inputSchema`) into your model provider's tool format, send it along with the conversation, and when the model asks for a tool, route that request to `session.call_tool`. That loop is the whole trick behind "MCP support" in any host.

<div class="callout tip" data-title="Tip">
  <p>Going remote later is a small change on the server side: <code>mcp.run(transport="streamable-http")</code> serves the same tools over HTTP. The hard part is not the transport, it's the authentication, authorization and operations around it.</p>
</div>

## Production Reality Check

The demo works. Here's what bites when real users and real models hit it.

### Tool design is prompt engineering

The model chooses tools based on names, descriptions and schemas, nothing else. A tool called `query` with the description "Queries data" will be called at the wrong time, with the wrong arguments, or never. Some practical rules:

- **Name tools as verbs with a clear object**: `search_incidents`, `get_incident`, `add_note`. If two servers are loaded at once, generic names like `search` collide in the model's head even when the host namespaces them.
- **Say when to use it and what comes back**: "Use this to find incidents similar to a current problem. Returns one line per match." That sentence prevents a lot of useless calls.
- **Keep schemas small and typed**: few parameters, sensible defaults, enums or literals where the set of values is closed. Every optional parameter is a decision the model can get wrong.
- **Prefer a few focused tools over one Swiss Army knife**: an `execute(action: str, payload: dict)` tool pushes all the design work onto the model.

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>What if I expose all 80 endpoints of our API as tools? More tools, smarter agent, right?</span>
    </div>
  </div>
</div>

The opposite, usually. Every tool definition goes into the model's context on every turn, so 80 tools means a big chunk of tokens spent before the user says anything, and more near-duplicate options for the model to confuse. Design around the tasks users actually perform, not around your API surface. Five well-described tools that cover the real workflows beat eighty thin wrappers.

### Failure modes worth knowing

**Huge outputs blowing up the context.** A tool that returns a full log file or a 5,000-row query result can push useful conversation out of the context window, raise cost and degrade answers. Cap results (like `MAX_RESULTS` above), truncate long fields, paginate, and return summaries with ids the model can drill into with a second tool.

**Logging to stdout breaks stdio.** On the stdio transport, stdout *is* the protocol channel. A stray `print("debug")` injects non-JSON bytes into the stream and the client fails to parse messages, often with confusing errors. Send logs to stderr (as `server.py` does) or to a file.

**Blocking I/O.** A slow synchronous call (a heavy query, an HTTP request without a timeout) can stall the server while the host waits. Define tools with `async def` and use async clients (for example `httpx.AsyncClient`), or push blocking work to a thread with `asyncio.to_thread`. Always set timeouts on outbound calls; a tool that hangs forever is worse than one that fails fast with a clear message.

**Secrets in tool output.** Whatever a tool returns goes into the model's context, may be shown to the user and may end up in logs. Never return connection strings, tokens or full raw records with personal data. Filter fields explicitly on the way out instead of dumping whole objects.

**Vague descriptions.** Already covered, but it's the most common cause of "the agent doesn't use my tool". When behavior is weird, read your descriptions as if you were the model with zero context.

### Security and trust

An MCP server is code that runs with real permissions, triggered by a model that can be influenced by whatever text lands in its context. That includes content returned by other tools, which opens the door to prompt injection. Treat it accordingly:

<div class="callout warning" data-title="Warning">
  <ul>
    <li><strong>Least privilege</strong>: give the server credentials scoped to what its tools actually need. A read-only search server doesn't need write access.</li>
    <li><strong>Confirm destructive actions</strong>: keep side-effecting tools explicit so hosts can ask the user for approval before running them.</li>
    <li><strong>Only install servers you trust</strong>: a local stdio server runs with your user's permissions. Review third-party servers like any other dependency.</li>
    <li><strong>Authenticate remote servers</strong>: a Streamable HTTP server exposed without auth is a public API to your internal systems.</li>
  </ul>
</div>

<div class="junior-card">
  <img src="/shared/jrdev-avatar.webp" alt="Curious junior dev" class="junior-card-img" />
  <div class="junior-card-content">
    <div class="junior-card-title">Naive Junior</div>
    <div class="junior-card-quote">
      <span>If the host asks the user before each tool call, then the server doesn't need to validate anything, right?</span>
    </div>
  </div>
</div>

No. Host-side confirmation is a UX safeguard, not a security boundary: users click "Allow" on autopilot, some hosts let them auto-approve, and your server may be used by clients you don't control. Validate inputs, check authorization and enforce limits inside the server, exactly as you would in any API. The server is the only place you fully own.

### Where to go from here

The incident notes server is small on purpose, but the shape scales: swap the dictionary for your real data source, keep outputs lean, log to stderr, and write docstrings as if they were prompts. Once it's solid over stdio, moving it to Streamable HTTP behind proper auth turns it into a shared capability that every MCP-compatible host in your company can use, without anyone rewriting the integration again. That's the point of MCP: write it once, plug it in everywhere.
