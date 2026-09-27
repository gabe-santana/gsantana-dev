---
title: "Sightline: turning hours of video into auditable answers on AWS"
description: "How I built an event-driven AWS pipeline that transcribes, indexes, and queries long-form video, and why the model never gets to write its own citations."
date: "2026-09-27"
tags: [Software Architecture, AI Agents, RAG, AWS, Terraform]
tldr:
  - "Sightline answers compliance questions about recorded video with schema-validated JSON: every finding carries a video ID, a timestamp, and a confidence score."
  - "Ingestion is three EventBridge hops, each with its own retry policy and dead-letter queue; the query route never lets the model supply a video ID or a timestamp."
  - "The transcript pipeline runs on real AWS resources; authentication, the multi-step agent loop, idempotent reprocessing, and visual frames are the honest to-do list."
---

Compliance teams in financial services record everything: advisory sessions, earnings calls, training. Then someone has to watch it. The request that started [Sightline](https://github.com/gabe-santana/sightline) came from exactly that pain: more than 3,000 hours of video a month, manual review costing over a million and a half dollars a year, cycles measured in weeks, and violations still slipping through. The client wanted three things that usually pull against each other: **cents per two-hour video**, answers to questions like *"find every time an advisor discussed unapproved crypto assets and give me the timestamps"*, and **output that survives an audit**.

That last requirement shaped everything. A chatbot that answers in fluent prose is useless here. A compliance analyst needs to jump to minute 47 of a specific recording and hear the sentence for themselves. So Sightline doesn't return prose at all. It returns a JSON document where every finding points to a `video_id` and a `timestamp_s`, and those two fields never come from the language model.

This walkthrough follows the code: what runs, why it is shaped this way, and what I would still require before letting a real compliance team depend on it.

## The architecture on one screen

<div id="sightline-system-slot"></div>

The original design drew five VPCs, one per responsibility: inbound, app, jobs, AI, and storage. The [Terraform](https://github.com/gabe-santana/sightline/tree/main/infra) builds **one VPC with tiered private subnets** instead. Five VPCs would need a peering mesh or a Transit Gateway just so the app can reach storage and the jobs can reach AI, which is real cost and real infrastructure for isolation that security groups already give you inside a single workload. The isolation the diagram was arguing for survives: the [security groups](https://github.com/gabe-santana/sightline/blob/main/infra/security_groups.tf) only allow egress to Postgres on 5432, to the VPC endpoints on 443, and to S3 through its gateway prefix list. Nothing else.

There is also **no NAT gateway**. Every AWS service the compute layer needs (Bedrock, Transcribe, EventBridge, Secrets Manager, S3 Vectors) is reached through an interface endpoint, and S3 through a gateway endpoint, all declared in [`vpc.tf`](https://github.com/gabe-santana/sightline/blob/main/infra/vpc.tf). A Lambda inside this VPC cannot reach the open internet even if its code wanted to. For regulated content, that is a property I'd rather have enforced by the network than promised by the code.

The ingress story took three iterations, and the last one is the least intuitive. `app-service`, a Next.js app that serves both the analyst UI and the query API, runs on **AWS App Runner, publicly accessible on its own domain**, with no gateway or load balancer in front. The first version kept App Runner private behind API Gateway, a VPC Link and a VPC Ingress Connection. It worked, but it was a lot of machinery to reach one backend. The second idea was an Application Load Balancer, which looked like the natural fit for a web app. It can't work: App Runner's private ingress endpoint is shared and routes by the `Host` header, and an ALB can route *on* `Host` but cannot *rewrite* it. So the simplest correct option was to let App Runner, which already load-balances and autoscales behind its domain, be the single internet-facing resource. The [infra README](https://github.com/gabe-santana/sightline/blob/main/infra/README.md) records the whole reasoning, including the tradeoff.

## Ingestion: three hops, zero polling

<div id="sightline-ingestion-slot"></div>

Amazon Transcribe is asynchronous. A long recording takes minutes, far longer than it makes sense to hold a Lambda open waiting. So the pipeline is a chain of **three EventBridge hops**, and `transcriber-job` owns two of them. The same handler receives both S3 "Object Created" events, and the key prefix decides which half of the work to do. From [`transcriber-job/handler.py`](https://github.com/gabe-santana/sightline/blob/main/src/transcriber-job/handler.py#L309-L321):

```python title="src/transcriber-job/handler.py"
def handler(event: dict, context) -> None:
    if config.TRANSCRIBE_ENDPOINT:
        return _handle_local_mock(event)

    detail = event["detail"]
    s3_key = detail["object"]["key"]

    if s3_key.startswith(config.TRANSCRIBE_OUTPUT_PREFIX):
        process_transcription_result(s3_key)
    else:
        video_id = parse_video_id(s3_key)
        db.ensure_video(video_id, s3_key)
        start_transcription(video_id, s3_key)
```

The first hop starts a Transcribe job with speaker labels and returns immediately. The job name is derived from the `video_id`, `sightline-{video_id}`, which makes a redelivered upload event harmless: Transcribe answers with a `ConflictException` instead of transcribing (and billing) the same video twice. When Transcribe writes its result under `transcribe-output/`, the second hop reads it, groups the word-by-word output into segments that break on sentence punctuation, on a speaker change, or at a 40-item cap, saves them in RDS, and publishes a `transcript_ready` event. The third hop, `embedding-job`, is invoked by that event with the exact `video_id` to process. It never scans a table looking for work: one event, one video.

Each hop has its own rule, its own retry policy, and its own dead-letter queue. From [`eventbridge.tf`](https://github.com/gabe-santana/sightline/blob/main/infra/eventbridge.tf):

```hcl title="infra/eventbridge.tf"
retry_policy {
  maximum_retry_attempts       = 3
  maximum_event_age_in_seconds = 3600
}

dead_letter_config {
  arn = aws_sqs_queue.video_uploaded_dlq.arn
}
```

A Transcribe throttling error retries the first hop without touching the embeddings of videos that are already further along, and a poison event ends up in a queue someone can inspect instead of disappearing. The `transcript_status` and `embedding_status` columns in RDS make every video's position in the pipeline queryable, which is what makes SLA reporting and stuck-job alerts possible later.

### The details that only show up when you deploy

Two problems never appear in a diagram. The first: Transcribe doesn't accept MKV, one of the formats in the request. The fix in [`_normalize_for_transcribe`](https://github.com/gabe-santana/sightline/blob/main/src/transcriber-job/handler.py#L111-L153) runs ffmpeg against a **presigned GET URL** instead of downloading the video, drops the video stream entirely (`-vn`), and uploads only the extracted AAC audio. Only the much smaller audio file ever touches the Lambda's `/tmp`, and the ffmpeg timeout (780 s) leaves headroom under the function's own 840 s. An S3 lifecycle rule in [`s3.tf`](https://github.com/gabe-santana/sightline/blob/main/infra/s3.tf) expires those normalized files after 7 days, because nothing reads them twice.

The second is packaging. `psycopg2-binary` has a native extension that must match Lambda's Amazon Linux on arm64. Compiling it under QEMU on a dev machine produced a binary with a mismatched ABI (`undefined symbol: _PyInterpreterState_Get` at import time). The build in [`lambda.tf`](https://github.com/gabe-santana/sightline/blob/main/infra/lambda.tf) skips compilation altogether: `pip install --platform manylinux2014_aarch64 --only-binary=:all:` downloads a wheel already built for the target. The same trick bundles a static ffmpeg through the `imageio-ffmpeg` wheel, with no Docker and no Lambda layer. That pushed the zip to about 44 MB, close to the 50 MB inline upload limit, so both functions deploy from an S3 object instead. And because a zip built on Windows doesn't reliably keep the Unix executable bit, the handler copies the ffmpeg binary into `/tmp` and sets `chmod 755` there once per cold start. None of this is architecture in the slide sense. All of it decides whether the architecture runs.

## The citation the model cannot invent

<div id="sightline-query-slot"></div>

The query route is where the audit requirement becomes code. The question is embedded with Titan Text Embeddings V2 (1024 dimensions), and S3 Vectors returns the five closest transcript segments. Claude on Bedrock then gets those excerpts, numbered, and a narrow job: say **which indices** actually support an answer and write a one-sentence claim for each. It is never asked for a video ID or a timestamp. From [`app/api/query/route.ts`](https://github.com/gabe-santana/sightline/blob/main/src/app-service/app/api/query/route.ts#L111-L124):

```ts title="src/app-service/app/api/query/route.ts"
const plan = await synthesizePlan(question, evidence);
findings = plan.relevant_indices
  .filter((i) => Number.isInteger(i) && i >= 0 && i < evidence.length)
  .map((i) => ({
    video_id: evidence[i].video_id,
    timestamp_s: evidence[i].timestamp_s,
    claim: plan.claims[String(i)] ?? evidence[i].text,
    confidence: Math.max(0, Math.min(1, evidence[i].score)),
    source: "transcript" as const,
  }));
```

The model's output is treated as a set of pointers into evidence the code already holds. Indices outside the range are dropped, so the model cannot cite an excerpt that doesn't exist. `video_id` and `timestamp_s` are copied from the vector search hit, so a hallucinated citation has no path into the response. The confidence is the retrieval score clamped to 0..1, not a number the model made up. If the model replies with something that isn't the expected JSON, the route retries once with a corrective instruction and then fails with a typed error. And when retrieval returns nothing, the model is not called at all: `findings: []` is a valid, honest answer, and nobody gets a low-confidence guess dressed up as a result.

Before anything leaves the API, the response is validated with Ajv against the [shared schema](https://github.com/gabe-santana/sightline/blob/main/packages/schemas/compliance-query-response.schema.json). It is strict on purpose: `additionalProperties: false` at every level, so the model cannot slip an "explanation" field in alongside the data. `source` is an enum with a single value today, `transcript`, kept as an enum so a `visual_frame` source can arrive later without changing the shape of existing data. A response that fails validation becomes a 502, not a best effort.

One thing this does **not** guarantee: the `claim` text is still written by the model. It is short, scoped to one excerpt, and next to a timestamp the analyst can verify in seconds, but it is generated text. That's why the [evaluation strategy](https://github.com/gabe-santana/sightline/blob/main/docs/evaluation-strategy.md) grades claims against an SME-annotated golden set with LLM-as-judge plus human audit sampling, instead of trusting them.

## Cost: what scales and what doesn't

The request set the bar at cents per two-hour video, so every per-video cost here is a function of audio duration and transcript volume. Transcribe bills per second of audio. Embeddings scale with the number of segments, so a recording that is mostly silence costs less than one dense with discussion. S3 Vectors bills per vector stored and per query, with no cluster idling overnight.

That last choice replaced the original design's OpenSearch domain, and I didn't make it from documentation alone. Before committing, I ran a real `create-vector-bucket`, `create-index`, `put-vectors` and `query-vectors` round trip against the account, **with a metadata filter**, confirmed there's an S3 Vectors interface endpoint so the no-NAT design could stay, and bumped the AWS provider to 6.x after reviewing the upgrade guide against every resource in the stack. The index definition in [`s3vectors.tf`](https://github.com/gabe-santana/sightline/blob/main/infra/s3vectors.tf) uses cosine distance and marks the segment text as non-filterable metadata, so it travels with the vector without inflating the filterable index.

The honest part of the cost model is the fixed floor. The dev environment runs at roughly **$70 to $100 a month before any traffic**: a small single-AZ RDS instance, App Runner, and mostly the interface endpoints, which cost the same whether the pipeline processes zero videos or three thousand hours. Removing OpenSearch and the gateway in front of App Runner cut the biggest fixed lines. Raw videos tier down to Infrequent Access after 90 days and to Glacier after a year.

## What it proves and what I would require before production

The two Lambda jobs are real code calling Transcribe, Bedrock and S3 Vectors through boto3, deployed by Terraform to a real AWS account. The query route is real code too, but its container image hasn't been pushed to ECR yet, so App Runner still runs AWS's bootstrap image. The local Docker Compose stack (LocalStack, Postgres, OpenSearch and small mocks for Transcribe and Bedrock) covers ingestion only and hasn't been re-verified since the pipeline became event-driven. If this became a system a compliance team depends on, these would be my first decisions, ordered by risk:

1. **Put authentication in front of everything.** The App Runner endpoint is public and the routes don't authenticate anyone: today, anyone with the URL could request a presigned upload URL or query the corpus. Analyst identity (SSO via Cognito or the company's IdP), per-team authorization on videos, and an audit log of who asked what come before any other feature.
2. **Make reprocessing idempotent end to end.** The upload hop is protected by the deterministic job name. The second hop isn't: a redelivered `transcribe-output` event runs the parsing again, and because segment IDs are random `uuid4` values, it inserts duplicate rows and writes extra vectors. Deterministic segment IDs (a `uuid5` of video ID and segment position) with a delete-and-insert in one transaction would close it. Also, nothing in the production path marks a video `failed`: when retries run out, the event goes to the DLQ and the status stays `transcribing` forever. A DLQ consumer or an alarm needs to own that transition.
3. **Build the agent loop the docs describe.** The route is a single retrieve-then-synthesize pass. The [orchestration doc](https://github.com/gabe-santana/sightline/blob/main/docs/agent-orchestration.md) specifies a bounded loop with `get_video_metadata` and `get_transcript_window` tools, a step budget and a timeout. It matters more than it looks: the vector metadata only holds `video_id`, `timestamp_s` and the text, so *"in Q2"* can't be filtered today. Recording dates need to reach the index. And `evidence_complete` should be computed from the budget by code, not self-reported by the model as it is now.
4. **Add the circuit breakers and alarms.** The reliability doc plans per-dependency circuit breakers. What the job code relies on today is EventBridge's retries and the dead-letter queues. Breakers around Bedrock and Transcribe, plus alarms on DLQ depth and on videos stuck in one status, turn a downstream incident into a page instead of a silent backlog.
5. **Grow out of the dev defaults.** Push the real image, move Terraform state to a remote backend with locking, turn on Multi-AZ for RDS, replace the create-schema-on-cold-start with versioned migrations, and put RDS Proxy in front of Postgres before concurrency opens one connection per invocation.
6. **Handle what the current shape can't.** Lambda's 15-minute ceiling limits how long a recording the normalization step can process: longer ones need Step Functions or MediaConvert, not a bigger timeout. The language is hardcoded to `en-US`, where Transcribe's language identification would do. And the visual half of the request, frame sampling and on-screen summaries, isn't built. That gap is deliberate and documented, but it is a gap.
7. **Prove accuracy before claiming it.** The evaluation strategy prioritizes recall (a missed violation is the failure this system exists to prevent), tracks timestamp accuracy in seconds, and checks confidence calibration. The golden dataset has to exist before anyone quotes a number. Until then, the retrieval score is a similarity, not a probability.

## What the project says about my approach

Sightline is the kind of system I like to build: the requirement that matters most (auditability) is enforced by structure instead of by prompt, the infrastructure decisions were tested against a real account before they were written down, and the documentation separates what exists from what is planned. The list above is long on purpose. **Knowing exactly where a system stops being trustworthy is part of designing it.**

<div class="project-repo-card">
  <p class="project-repo-label">Open-source project</p>
  <div class="project-repo-title">Sightline</div>
  <p>Explore the Terraform, the Lambda jobs, the query route, and the design docs in the repository.</p>
  <a href="https://github.com/gabe-santana/sightline" target="_blank" rel="noopener noreferrer">View code on GitHub <span aria-hidden="true">↗</span></a>
</div>
