---
title: "Sightline: turning hours of video into auditable answers on AWS"
description: "How I built an event-driven AWS pipeline that transcribes, indexes, and queries long-form video, and why the model never gets to write its own citations."
date: "2026-09-27"
tags: [Software Architecture, AI Agents, RAG, AWS, Terraform]
# ?v= busts the 404 some CDN edges cached before the image was uploaded.
cover: "/posts/sightline-video-compliance-intelligence/cover.webp?v=2"
tldr:
  - "Sightline answers compliance questions about recorded video with schema-validated JSON: every finding carries a video ID, a timestamp, and a confidence score."
  - "Ingestion is three EventBridge hops, each with its own retry policy and dead-letter queue; the query route never lets the model supply a video ID or a timestamp."
  - "Compute runs in private subnets with no NAT gateway: every AWS service is reached through a VPC endpoint, and App Runner is the only internet-facing resource."
---

Compliance teams in financial services record everything: advisory sessions, earnings calls, training. Then someone has to watch it. The request that started [Sightline](https://github.com/gabe-santana/sightline) came from exactly that pain: more than 3,000 hours of video a month, manual review costing over a million and a half dollars a year, cycles measured in weeks, and violations still slipping through. The client wanted three things that usually pull against each other: **cents per two-hour video**, answers to questions like *"find every time an advisor discussed unapproved crypto assets and give me the timestamps"*, and **output that survives an audit**.

That last requirement shaped everything. A chatbot that answers in fluent prose is useless here. A compliance analyst needs to jump to minute 47 of a specific recording and hear the sentence for themselves. So Sightline doesn't return prose at all. It returns a JSON document where every finding points to a `video_id` and a `timestamp_s`, and those two fields never come from the language model.

This walkthrough follows the code: how each part works and why it is shaped this way.

## The architecture on one screen

<div id="sightline-system-slot"></div>

Everything runs in **one VPC with tiered private subnets**, built by the [Terraform](https://github.com/gabe-santana/sightline/tree/main/infra): one for the app, one for the database, and one for the jobs, spread across two availability zones. The tiers are isolated by [security groups](https://github.com/gabe-santana/sightline/blob/main/infra/security_groups.tf) that only allow egress to Postgres on 5432, to the VPC endpoints on 443, and to S3 through its gateway prefix list. Nothing else. Each responsibility stays separate without the app needing peering or a Transit Gateway to reach storage.

<figure style="margin:2rem 0;">
  <img src="/posts/sightline-video-compliance-intelligence/infra.svg" alt="Sightline infrastructure on AWS: one VPC across two availability zones with three private subnets. app-service sits in the first, Amazon RDS in the second, and the transcriber-job and embedding-job Lambdas in the third. They reach Amazon Bedrock, Amazon EventBridge, Amazon Transcribe and S3 storage outside the subnets." width="671" height="681" style="display:block;width:100%;max-width:671px;height:auto;margin:0 auto;" />
  <figcaption style="margin-top:8px;text-align:center;font-size:0.9rem;color:#8b93a7;font-style:italic;">The infrastructure as deployed, from the repository's <a href="https://github.com/gabe-santana/sightline/blob/main/docs/res/img/infra.svg" target="_blank" rel="noopener noreferrer">draw.io diagram</a>.</figcaption>
</figure>

**There is no NAT gateway.** Every AWS service the compute layer needs (Bedrock, Transcribe, EventBridge, Secrets Manager, S3 Vectors) is reached through an interface endpoint, and S3 through a gateway endpoint, all declared in [`vpc.tf`](https://github.com/gabe-santana/sightline/blob/main/infra/vpc.tf). A Lambda inside this VPC cannot reach the open internet even if its code wanted to. For regulated content, that is a property I'd rather have enforced by the network than promised by the code.

The entry point is just as lean. `app-service`, a Next.js app that serves both the analyst UI and the query API, runs on **AWS App Runner, on its own domain**. App Runner already handles TLS, load balancing and autoscaling, so it is the single internet-facing resource, with no extra gateway or load balancer in front, and it reaches into the VPC through a VPC connector to talk to the database and the endpoints. The [infra README](https://github.com/gabe-santana/sightline/blob/main/infra/README.md) documents the network topology.

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

A Transcribe throttling error retries the first hop without touching the embeddings of videos that are already further along, and a poison event ends up in a queue someone can inspect instead of disappearing. The `transcript_status` and `embedding_status` columns in RDS make every video's position in the pipeline queryable, the basis for SLA reporting and stuck-job alerts.

### Only the audio travels

The pipeline accepts the formats compliance teams actually record, MKV included. Before transcribing, [`_normalize_for_transcribe`](https://github.com/gabe-santana/sightline/blob/main/src/transcriber-job/handler.py#L111-L153) runs ffmpeg straight against a **presigned GET URL** for the video, without downloading it, drops the video stream (`-vn`), and uploads only the extracted AAC audio. A multi-gigabyte recording becomes a small audio file, and only that file touches the Lambda's `/tmp`. The ffmpeg timeout (780 s) sits under the function's own 840 s, so a bad file fails cleanly and falls into the retry. An S3 lifecycle rule in [`s3.tf`](https://github.com/gabe-santana/sightline/blob/main/infra/s3.tf) expires those normalized files after 7 days, because nothing reads them twice.

The Lambdas run on arm64, and the build in [`lambda.tf`](https://github.com/gabe-santana/sightline/blob/main/infra/lambda.tf) assembles the package with no Docker and no Lambda layer: `pip install --platform manylinux2014_aarch64 --only-binary=:all:` downloads wheels already built for the target, including `psycopg2-binary` and a static ffmpeg through the `imageio-ffmpeg` wheel. The zip deploys from an S3 object, and Terraform updates the function's code whenever the package hash changes.

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

Before anything leaves the API, the response is validated with Ajv against the [shared schema](https://github.com/gabe-santana/sightline/blob/main/packages/schemas/compliance-query-response.schema.json). It is strict on purpose: `additionalProperties: false` at every level, so the model cannot slip an "explanation" field in alongside the data. `source` is an enum, `transcript` today, so new evidence sources can arrive without changing the shape of existing data. A response that fails validation becomes a 502, not a best effort.

The only text the model writes is the `claim`: one short sentence, scoped to one excerpt, shown next to the timestamp the analyst can check in seconds. The structure guarantees the citation, and the person checks the summary.

## Cost: paying for what was processed

The request set the bar at cents per two-hour video, so every per-video cost is a function of audio duration and transcript volume. Transcribe bills per second of audio, and because only the audio is sent, the size of the video file doesn't matter. Embeddings scale with the number of segments, so a recording that is mostly silence costs less than one dense with discussion.

The vector index is **Amazon S3 Vectors**, billed per vector stored and per query, with no cluster idling overnight. It supports metadata filters and has its own interface endpoint, which keeps the design free of NAT. The index definition in [`s3vectors.tf`](https://github.com/gabe-santana/sightline/blob/main/infra/s3vectors.tf) uses cosine distance and marks the segment text as non-filterable metadata, so it travels with the vector without inflating the filterable index.

What is fixed stays small: a lean RDS instance, App Runner, and the VPC endpoints. No service sits running while it waits for video, and raw videos tier down to Infrequent Access after 90 days and to Glacier after a year, per the bucket's lifecycle rules.

## What the project says about my approach

Sightline is the kind of system I like to build. The requirement that matters most, auditability, is enforced by structure instead of by prompt: the model chooses among evidence, and the code writes the citations. The network blocks what the code shouldn't do, each pipeline stage fails and recovers on its own, and the cost follows the volume of video. **When the guarantee lives in the architecture, nobody has to trust the model to trust the answer.**

<div class="project-repo-card">
  <p class="project-repo-label">Open-source project</p>
  <div class="project-repo-title">Sightline</div>
  <p>Explore the Terraform, the Lambda jobs, the query route, and the design docs in the repository.</p>
  <a href="https://github.com/gabe-santana/sightline" target="_blank" rel="noopener noreferrer">View code on GitHub <span aria-hidden="true">↗</span></a>
</div>
