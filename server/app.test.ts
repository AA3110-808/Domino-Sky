import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApp } from "./app.js";

const app = createApp({ corsOrigins: ["http://localhost:5173"], ai: {} });
let server: Server;
let baseUrl = "";

beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

describe("simulation API", () => {
  it("reports engine and optional AI availability", async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      simulationEngine: "available",
      aiConfigured: false,
    });
  });

  it("runs a validated scenario against the supplied network", async () => {
    const response = await fetch(`${baseUrl}/api/simulations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ airportId: "BOM", startTime: "10:30", durationMinutes: 90 }),
    });
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.summary.totalFlights).toBe(70);
    expect(result.flights.find((flight: { flightId: string }) => flight.flightId === "DS0203").arrivalDelayMinutes).toBe(5);
  });

  it("rejects malformed or infeasible requests with explicit errors", async () => {
    const invalid = await fetch(`${baseUrl}/api/simulations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ airportId: "XXX", startTime: "10:30", durationMinutes: 90 }),
    });
    expect(invalid.status).toBe(400);

    const infeasible = await fetch(`${baseUrl}/api/recovery`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        airportId: "BOM",
        startTime: "10:30",
        durationMinutes: 90,
        actions: [{ type: "substitute-spare", flightId: "DS0202", spareTailId: "VT-DS18" }],
      }),
    });
    expect(infeasible.status).toBe(400);
    await expect(infeasible.json()).resolves.toMatchObject({ error: expect.stringContaining("repositioning") });
  });

  it("returns CSV reports and a clear disabled-AI status", async () => {
    const report = await fetch(`${baseUrl}/api/reports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ airportId: "DEL", startTime: "12:00", durationMinutes: 60, report: "flights" }),
    });
    expect(report.status).toBe(200);
    expect(report.headers.get("content-type")).toContain("text/csv");
    expect(await report.text()).toContain('"flightId","tailId"');

    const rotations = await fetch(`${baseUrl}/api/reports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ airportId: "DEL", startTime: "12:00", durationMinutes: 60, report: "rotations" }),
    });
    expect(rotations.status).toBe(200);
    expect(await rotations.text()).toContain('"actualTurnaroundBeforeMinutes"');

    const ai = await fetch(`${baseUrl}/api/dispatcher/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ airportId: "BOM", startTime: "10:30", durationMinutes: 90 }),
    });
    expect(ai.status).toBe(503);
    await expect(ai.json()).resolves.toMatchObject({ error: expect.stringContaining("not configured") });
  });

  it("compares two scenarios using deterministic summaries", async () => {
    const response = await fetch(`${baseUrl}/api/simulations/compare`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scenarios: [
          { airportId: "BOM", startTime: "10:30", durationMinutes: 90 },
          { airportId: "DEL", startTime: "12:00", durationMinutes: 60 },
        ],
      }),
    });
    const comparison = await response.json();
    expect(response.status).toBe(200);
    expect(comparison.scenarios).toHaveLength(2);
    expect(comparison.scenarios.map((scenario: { airportId: string }) => scenario.airportId)).toEqual(["BOM", "DEL"]);
  });
});
