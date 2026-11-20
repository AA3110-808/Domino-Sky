import { z } from "zod";
import type { DispatcherResponse, SimulationResult } from "../../src/simulation/contract.js";
import type { NetworkDataset, SimulationRequest } from "../../src/simulation/contract.js";
import { simulateNetwork } from "../../src/simulation/engine.js";

export type AIConfiguration = {
  apiKey?: string;
  apiUrl?: string;
  model?: string;
};

const recommendationSchema = z.object({
  title: z.string().min(1).max(120),
  rationale: z.string().min(1).max(500),
  benefits: z.string().min(1).max(300),
  tradeoffs: z.string().min(1).max(300),
  flightIds: z.array(z.string()).max(20),
  action: z.discriminatedUnion("type", [
    z.object({ type: z.literal("cancel-flight"), flightId: z.string() }),
    z.object({ type: z.literal("reschedule-departure"), flightId: z.string(), newDeparture: z.string() }),
    z.object({ type: z.literal("hold-connection"), connectionId: z.string(), holdMinutes: z.number().int() }),
    z.object({ type: z.literal("substitute-spare"), flightId: z.string(), spareTailId: z.string() }),
    z.object({ type: z.literal("reassign-aircraft"), flightId: z.string(), toTailId: z.string() }),
  ]).nullable(),
});

const dispatcherResponseSchema = z.object({
  summary: z.string().min(1).max(700),
  explanations: z.array(z.string().min(1).max(400)).max(8),
  recommendations: z.array(recommendationSchema).max(6),
});

function assertNoUnsupportedNumbers(text: string, result: SimulationResult) {
  const allowedTokens = new Set(JSON.stringify(result).match(/\b\d+(?:\.\d+)?\b/g) ?? []);
  const tokens = text.match(/\b\d+(?:\.\d+)?\b/g) ?? [];
  const unsupported = tokens.filter((token) => !allowedTokens.has(token));
  if (unsupported.length > 0) {
    throw new Error(`AI response contains numerical claims absent from verified simulation output: ${[...new Set(unsupported)].join(", ")}.`);
  }
}

function validateIds(response: z.infer<typeof dispatcherResponseSchema>, result: SimulationResult) {
  const flightIds = new Set(result.flights.map((flight) => flight.flightId));
  const safeText = [
    response.summary,
    ...response.explanations,
    ...response.recommendations.flatMap((item) => [item.title, item.rationale, item.benefits, item.tradeoffs]),
  ].join("\n");
  assertNoUnsupportedNumbers(safeText, result);
  for (const recommendation of response.recommendations) {
    const unknownId = recommendation.flightIds.find((flightId) => !flightIds.has(flightId));
    if (unknownId) throw new Error(`AI response referenced unknown flight "${unknownId}".`);
  }
}

export async function analyzeWithAI(
  result: SimulationResult,
  request: SimulationRequest,
  dataset: NetworkDataset,
  config: AIConfiguration,
): Promise<DispatcherResponse> {
  if (!config.apiKey || !config.apiUrl || !config.model) {
    throw new Error("AI dispatcher is not configured. Set AI_API_KEY, AI_API_URL, and AI_MODEL on the backend.");
  }
  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are an airline operations analyst. The deterministic simulation is the only source of numbers. Return JSON with keys summary, explanations, recommendations. Each recommendation has title, rationale, benefits, tradeoffs, flightIds, action. Action is null or one supported recovery action. Do not invent IDs or numbers. Only mention numerical values present in the supplied results. Do not claim feasibility; proposed actions are checked separately.",
        },
        {
          role: "user",
          content: JSON.stringify({
            scenario: result.scenario,
            actionHistory: result.actionHistory,
            summary: result.summary,
            flights: result.flights,
            connections: result.connections,
            crews: result.crews,
            aircraft: result.aircraft,
            availableSpares: result.aircraft.filter((aircraft) => aircraft.isSpare),
          }),
        },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`AI provider request failed with HTTP ${response.status}.`);
  const providerBody: unknown = await response.json();
  const content = z.object({
    choices: z.array(z.object({
      message: z.object({ content: z.string() }),
    })).min(1),
  }).parse(providerBody).choices[0].message.content;
  const candidate: unknown = JSON.parse(content);
  const validated = dispatcherResponseSchema.parse(candidate);
  validateIds(validated, result);
  const recommendations = validated.recommendations.map((recommendation) => {
    let feasible = false;
    let validationMessage = "No recovery action was proposed.";
    if (recommendation.action) {
      try {
        const checked = simulateNetwork(dataset, {
          ...request,
          actions: [...(request.actions ?? []), recommendation.action],
        });
        feasible = checked.infeasibleActions.length === 0;
        validationMessage = feasible
          ? "Action passed deterministic feasibility checks and can be reviewed before application."
          : checked.infeasibleActions.join(" ");
      } catch (reason) {
        validationMessage = reason instanceof Error ? reason.message : "The action failed deterministic feasibility checks.";
      }
    }
    return { ...recommendation, feasible, validationMessage };
  });
  return {
    ...validated,
    recommendations,
  };
}
