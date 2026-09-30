import type { Locale } from "@/lib/i18n";
import { agentHandoff, agentPipeline, mcpIntegrations, mcpTrustBoundaries, supervisorPattern, toolCallGates } from "@/lib/diagrams/agents";
import { costControlLoop, idempotencyFlow, multiCloudReference, pollyPipeline, stranglerFigFlow } from "@/lib/diagrams/architecture";
import { messagingServices, serviceBusOrderStatus } from "@/lib/diagrams/messaging";
import { chunkingPipeline, containerAppsRagApi, hnswLayers, hybridSearch, ragEvaluation } from "@/lib/diagrams/rag";
import { layaDiagrams } from "@/lib/diagrams/laya";
import { projectDiagrams } from "@/lib/diagrams/projects";
import { promptCachingDiagrams } from "@/lib/diagrams/prompt-caching-kv-cache";
import { structuredOutputsDiagrams } from "@/lib/diagrams/structured-outputs-constrained-decoding";
import { speculativeDecodingDiagrams } from "@/lib/diagrams/speculative-decoding-explained";
import { llmJudgeDiagrams } from "@/lib/diagrams/llm-as-judge-calibration";
import { contextEngineeringDiagrams } from "@/lib/diagrams/context-engineering-long-running-agents";
import { quantizationDiagrams } from "@/lib/diagrams/quantizing-llms-in-practice";
import { loraDiagrams } from "@/lib/diagrams/lora-fine-tuning-first-principles";
import { llmServingDiagrams } from "@/lib/diagrams/llm-serving-continuous-batching";
import { embeddingTrainingDiagrams } from "@/lib/diagrams/embedding-models-contrastive-training";
import { llmObservabilityDiagrams } from "@/lib/diagrams/llm-observability-opentelemetry";
import { sightlineDiagrams } from "@/lib/diagrams/sightline";
import { azureNetworkingDiagrams } from "@/lib/diagrams/azure-networking";
import { pageindexAgentLoop, pageindexBenchmarkHarness, pageindexVsRagPipelines } from "@/lib/diagrams/pageindex-vs-vector-rag";
import type { Diagram } from "@/lib/diagrams/types";

/**
 * Every canvas diagram, by id. A post places one with a marker on its own
 * line in the markdown: <div id="<id>-slot"></div>. The blog page swaps each
 * marker for the rendered diagram and fails the build on an unknown id.
 */
const registry: Record<string, (locale: Locale) => Diagram> = {
  ...azureNetworkingDiagrams,
  "pageindex-vs-rag-pipelines": pageindexVsRagPipelines,
  "pageindex-agent-loop": pageindexAgentLoop,
  "pageindex-benchmark-harness": pageindexBenchmarkHarness,
  ...sightlineDiagrams,
  ...layaDiagrams,
  ...projectDiagrams,
  ...promptCachingDiagrams,
  ...structuredOutputsDiagrams,
  ...speculativeDecodingDiagrams,
  ...llmJudgeDiagrams,
  ...contextEngineeringDiagrams,
  ...quantizationDiagrams,
  ...loraDiagrams,
  ...llmServingDiagrams,
  ...embeddingTrainingDiagrams,
  ...llmObservabilityDiagrams,
  "service-bus-order-status": serviceBusOrderStatus,
  "messaging-services": messagingServices,
  "chunking-pipeline": chunkingPipeline,
  "hybrid-search": hybridSearch,
  "rag-evaluation": ragEvaluation,
  "container-apps-rag-api": containerAppsRagApi,
  "hnsw-layers": hnswLayers,
  "tool-call-gates": toolCallGates,
  "supervisor-pattern": supervisorPattern,
  "agent-pipeline": agentPipeline,
  "agent-handoff": agentHandoff,
  "mcp-integrations": mcpIntegrations,
  "mcp-trust-boundaries": mcpTrustBoundaries,
  "multi-cloud-reference": multiCloudReference,
  "polly-pipeline": pollyPipeline,
  "cost-control-loop": costControlLoop,
  "strangler-fig-flow": stranglerFigFlow,
  "idempotency-flow": idempotencyFlow,
};

export const diagramIds = Object.keys(registry);

export function getDiagram(id: string, locale: Locale): Diagram | undefined {
  return registry[id]?.(locale);
}

const MARKER = /<div id="([a-z0-9-]+)-slot"><\/div>/g;

/** Ids of every diagram marker in a rendered article, in order. */
export function diagramMarkerIds(html: string): string[] {
  return [...html.matchAll(MARKER)].map((match) => match[1] ?? "");
}

export function diagramMarker(id: string): string {
  return `<div id="${id}-slot"></div>`;
}
