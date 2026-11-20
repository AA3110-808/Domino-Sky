import { afterEach, describe, expect, it, vi } from "vitest";
import { actualNetwork } from "../../src/data/network";
import type { SimulationRequest } from "../../src/simulation/contract";
import { simulateNetwork } from "../../src/simulation/engine";
import { analyzeWithAI, type AIConfiguration } from "./dispatcher";

const request: SimulationRequest = {
  airportId: "BOM",
  startTime: "10:30",
  durationMinutes: 90,
};
const result = simulateNetwork(actualNetwork, request);
const config: AIConfiguration = {
  apiKey: "test-gemini-key",
  apiUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  model: "test-model",
};
const recommendation = {
  title: "Cancel the affected service",
  rationale: "Cancellation is one available recovery option.",
  benefits: "Prevents operation during the disruption.",
  tradeoffs: "The service is removed from the rotation.",
  flightIds: ["DS0101"],
  action: { type: "cancel-flight", flightId: "DS0101" },
};

function stubProvider(content: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }),
    { status: 200, headers: { "content-type": "application/json" } },
  ));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Gemini dispatcher", () => {
  it("reports missing configuration without making a provider request", async () => {
    await expect(analyzeWithAI(result, request, actualNetwork, {
      apiUrl: config.apiUrl,
      model: config.model,
    })).rejects.toThrow("Set GEMINI_API_KEY and GEMINI_MODEL");
  });

  it("sends a JSON response request and validates recommendations against the engine", async () => {
    const fetchMock = stubProvider({
      summary: "Review the disruption scenario with deterministic outcomes.",
      explanations: ["The engine results provide the verified schedule impact."],
      recommendations: [recommendation],
    });

    const response = await analyzeWithAI(result, request, actualNetwork, config);
    const requestOptions = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const requestBody = JSON.parse(String(requestOptions.body));

    expect(fetchMock).toHaveBeenCalledWith(config.apiUrl, expect.any(Object));
    expect(requestOptions.headers).toMatchObject({ authorization: `Bearer ${config.apiKey}` });
    expect(requestBody).toMatchObject({
      model: config.model,
      response_format: { type: "json_object" },
    });
    expect(response.recommendations[0]).toMatchObject({ feasible: true });
  });

  it("rejects malformed, unsupported-number, and unknown-flight responses", async () => {
    stubProvider({ summary: "Incomplete response" });
    await expect(analyzeWithAI(result, request, actualNetwork, config)).rejects.toThrow();

    stubProvider({
      summary: "The closure causes 987654321 minutes of delay.",
      explanations: [],
      recommendations: [],
    });
    await expect(analyzeWithAI(result, request, actualNetwork, config))
      .rejects.toThrow("numerical claims absent from verified simulation output");

    stubProvider({
      summary: "Review the disruption scenario.",
      explanations: [],
      recommendations: [{ ...recommendation, flightIds: ["UNKNOWN"], action: null }],
    });
    await expect(analyzeWithAI(result, request, actualNetwork, config))
      .rejects.toThrow('AI response referenced unknown flight "UNKNOWN".');
  });
});
