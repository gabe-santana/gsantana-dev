---
title: "AgenticMesh: AI architecture that runs beyond the diagram"
description: "How I built a RAG MVP with FastAPI, Celery, Qdrant, Azure AI Foundry, and streaming, and what production still requires."
date: "2026-09-26"
tags: [Software Architecture, AI Agents, RAG, Python, Azure]
tldr:
  - "AgenticMesh is a working MVP: document upload, asynchronous ingestion, vector search, sourced answers, streaming chat, and pipeline traces."
  - "I separated the UI, API, worker, operational data, vectors, and model provider to make ownership and failure points explicit."
  - "The code demonstrates hands-on delivery; user-scoped vector retrieval, prompt-injection controls, migrations, and cloud operations remain production work."
---

An architecture diagram can promise anything. The less convenient test is to start the services, upload a PDF, follow its processing, ask a question, and find out whether the answer actually came from that document. I built [AgenticMesh](https://github.com/gabe-santana/agentic-mesh) to close that loop.

It is an **architecture and implementation project**, not an attempt to put an LLM in the middle and hope for the best. It connects a Next.js interface to a FastAPI backend, decouples ingestion with Celery and Redis, keeps application state in PostgreSQL, indexes content in Qdrant, and calls chat and embedding models through Azure AI Foundry. The result is an executable end-to-end MVP. This walkthrough covers both what works and the guarantees the prototype does not yet provide.

## See the flow before the diagram

![AgenticMesh demo: document ingestion, streaming RAG chat, and response pipeline trace](/posts/agentic-mesh-architecture-rag-agents/demo.gif)

*Demo from the [original repository](https://github.com/gabe-santana/agentic-mesh/blob/main/docs/res/demo.gif): upload, processing, question, and pipeline inspection. The GIF shows the behavior; the code below shows the choices.*

## The architecture on one screen

<div id="agentic-mesh-canvas-slot"></div>

There are **two paths with different latency needs**. Ingestion is slow work outside the request cycle: the API accepts a file, records a document as `pending`, and queues a task; the worker extracts text, chunks it, generates embeddings, writes vectors, and marks it `ready` or `failed`. A question needs an interactive answer: the API retrieves passages, builds context, and sends model output to the browser through Server-Sent Events (SSE). Upload and generation should not compete for the same response time.

The boundaries are deliberate. PostgreSQL owns **transactional state**; Qdrant owns **similarity-search representations**. Redis is the queue broker, not the source of truth for documents. Model integration lives in [`services/azure_ai.py`](https://github.com/gabe-santana/agentic-mesh/blob/main/backend/app/services/azure_ai.py) instead of leaking into route handlers and UI components. The app runs as separate processes, but I won't call every process a "microservice" merely to decorate the diagram.

## Ingestion: messaging where the work actually is

The document endpoint accepts `.txt`, `.md`, and `.pdf`, saves the file to a volume shared with the worker, and queues a Celery task with the document ID. The task handles the expensive part. This excerpt comes from the [actual worker](https://github.com/gabe-santana/agentic-mesh/blob/main/backend/app/workers/tasks.py):

```python title="backend/app/workers/tasks.py"
text = _extract_text(document.file_path)
chunks = chunk_text(text)
if not chunks:
    raise ValueError("No extractable text found in document")

vectors = azure_ai.embed_texts(chunks)
vector_store.ensure_collection()
vector_store.upsert_chunks(
    document.id, document.filename, document.category, chunks, vectors
)

document.status = "ready"
document.chunk_count = len(chunks)
```

The [splitter](https://github.com/gabe-santana/agentic-mesh/blob/main/backend/app/utils/chunking.py) tries paragraphs, lines, and sentences before falling back to words or characters, with overlap between chunks. [Qdrant](https://github.com/gabe-santana/agentic-mesh/blob/main/backend/app/services/vector_store.py) uses cosine distance and deterministic IDs derived from document ID and chunk index, useful for repeating *upserts* without multiplying points. Deleting a document removes its vectors and file as well as its database row.

One subtlety tends to surface only after an intermittent failure: each Celery task runs its own event loop through `asyncio.run()`. Reusing an async database engine created for a different loop risks connections tied to a closed loop. The worker creates and disposes an engine per invocation. It is an implementation detail, and precisely where architecture meets operations.

## RAG is not a magic word: it is a verifiable chain

For each question, the system embeds the query, searches Qdrant for up to five passages, and numbers them `[1]`, `[2]`, and so on. The synchronous embedding call and vector search run in worker threads via `anyio.to_thread.run_sync` so they do not block the API event loop. The context travels with recent chat history and agent instructions to the Azure AI Foundry chat endpoint.

The orchestration core is a small Python class. Here is the [code that retrieves, assembles the prompt, and streams the answer](https://github.com/gabe-santana/agentic-mesh/blob/main/backend/app/agents/rag_agent.py):

```python title="backend/app/agents/rag_agent.py"
if enable_rag:
    sources = await rag.retrieve(prompt)
    context = rag.build_context_block(sources)
    if context:
        system_content += (
            "\n\n--- Retrieved context ---\n" + context + "\n--- End context ---"
        )

turns = [ChatTurn("system", system_content), *history, ChatTurn("user", prompt)]
async for delta in stream_chat(turns):
    yield {"type": "token", "content": delta}
```

The *system prompt* asks the model to ground answers in context and cite the matching numbers; if context lacks the answer, it asks the model to say so. That is a useful instruction, **not proof that every claim is grounded**. A model-generated citation still needs checking against the retrieved passage. This is why the UI exposes sources and scores instead of demanding blind trust in the final prose.

It is equally important to be precise about **agent**. The project has a `RAGChatAgent` and an `AgentRegistry` for selecting implementations. It does not yet have autonomous planning, external tool use, an execution graph, or multiple cooperating agents. Starting with a small class leaves room for more sophisticated orchestration when a use case actually warrants it, without importing a framework to fill a slide.

## APIs, streaming, and observability are part of the product

The interface does not wait for a complete answer. It calls `POST /api/v1/agent/stream`; the route authenticates the user, validates the session, loads up to 20 earlier messages, and returns an `EventSourceResponse`. The agent emits `token` events during generation and a final `done` event with sources, prompt, and retrieval and generation times. The API stores the message and an `AgentRun` with latency, retrieved-chunk count, and status. That connects user experience to technical diagnosis.

The [model adapter](https://github.com/gabe-santana/agentic-mesh/blob/main/backend/app/services/azure_ai.py) uses the `openai` SDK against Azure AI Foundry's compatible endpoint: `client.responses.create(..., stream=True)` for chat and `client.embeddings.create(...)` for vectors. This is an actual API integration, not a playground screenshot. In the UI, the [Pipeline Trace](https://github.com/gabe-santana/agentic-mesh/blob/main/frontend/src/components/TracePanel.tsx) displays timings, retrieved passages, scores, and the assembled system prompt.

That trace answers real engineering questions: did retrieval find the right document? Was latency in search or generation? Was there enough context to answer? It also exposes a boundary: displaying or persisting a prompt containing document text can disclose sensitive content. Production needs explicit access, redaction, and retention rules for these traces.

## What it proves and what I would require before production

The repository starts six services with [Docker Compose](https://github.com/gabe-santana/agentic-mesh/blob/main/docker/docker-compose.yml): frontend, API, worker, PostgreSQL, Redis, and Qdrant. Azure AI Foundry provides the models. This demonstrates practical **cloud AI integration**, containers, messaging, APIs, and distinct data stores. **It does not demonstrate deployment of the app to Azure, AWS, or GCP**: there is no Kubernetes, Terraform, deployment pipeline, or SLO. The repo includes [backend tests](https://github.com/gabe-santana/agentic-mesh/tree/main/tests/backend), but they do not yet cover the full journey with real dependencies.

If this MVP became a customer-facing solution, these would be my first decisions, ordered by risk:

1. **Isolate data before scaling.** Session and document routes filter by user, but Qdrant retrieval currently has no `user_id`/tenant filter. In a multiuser setup, it could return another user's passages. I would carry document ownership into vector payloads, filter every search server-side, and test cross-user leakage before release.
2. **Put boundaries around untrusted content.** Retrieved documents are data, not instructions. I would add prompt-injection tests, citation validation, passage access policies, and trace safeguards. A system prompt alone cannot guarantee this boundary.
3. **Make ingestion resilient and safe.** Upload size and content limits, restricted parsing, timeouts, retry/backoff, dead-task handling, and reconciliation between PostgreSQL status and Qdrant vectors. A `failed` status is a start, not a recoverable operation by itself.
4. **Evolve data and deployment.** Versioned migrations in place of boot-time `create_all()`, managed secrets, cloud-appropriate file storage, end-to-end health checks, metrics, and distributed tracing. Docker Compose is excellent for local reproducibility; it is not a production strategy.
5. **Measure AI quality.** A question set with expected sources, retrieval and grounding evaluations, token/cost budgets, prompt regression tests, and per-stage latency. Changing a prompt and hoping is not engineering.

This is where architectural vision and code have to meet. The diagram helps decide where boundaries belong. The implementation reveals where they still leak. An honest POC reduces uncertainty and prioritizes the next experiment; it does not declare victory early.

## What the project says about my approach

AgenticMesh shows how I work: define responsibilities, build the entire path, make behavior inspectable, and identify what needs fixing before asking anyone to trust the system. There are APIs, distributed processing, LLM and embedding integrations, vector search, prompt engineering, streaming, and a UI for inspecting the result. There are also decisions I would change when moving from an MVP to a shared platform. **Being able to say both is part of software architecture.**

<div class="project-repo-card">
  <p class="project-repo-label">Open-source project</p>
  <div class="project-repo-title">AgenticMesh</div>
  <p>Explore the implementation, tests, Docker Compose setup, and full demo in the repository.</p>
  <a href="https://github.com/gabe-santana/agentic-mesh" target="_blank" rel="noopener noreferrer">View code on GitHub <span aria-hidden="true">↗</span></a>
</div>
