import cors from "cors";
import express, { type ErrorRequestHandler, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import type { AIConfiguration } from "./ai/dispatcher.js";
import { analyzeWithAI } from "./ai/dispatcher.js";
import { operationalDataset } from "./dataset.js";
import { ReportRequestSchema, ScenarioCompareSchema, SimulationRequestSchema } from "./schemas.js";
import { simulateNetwork, SimulationInputError } from "../src/simulation/engine.js";
import type { SimulationResult } from "../src/simulation/contract.js";

export type ServerConfig = {
  corsOrigins: string[];
  ai: AIConfiguration;
};

class HttpError extends Error {
  constructor(message: string, readonly status: number, readonly details?: unknown) {
    super(message);
    this.name = "HttpError";
  }
}

type ReportKind = "summary" | "flights" | "rotations" | "connections" | "crew";

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : Array.isArray(value) ? value.join("; ") : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function reportCsv(result: SimulationResult, report: ReportKind): string {
  switch (report) {
    case "summary":
      return toCsv(Object.keys(result.summary), [Object.values(result.summary)]);
    case "flights":
      return toCsv(
        ["flightId", "tailId", "origin", "destination", "scheduledDeparture", "predictedDeparture", "scheduledArrival", "predictedArrival", "departureDelayMinutes", "arrivalDelayMinutes", "actualTurnaroundBeforeMinutes", "passengers", "status", "reasons", "cancellationReason"],
        result.flights.map((flight) => [
          flight.flightId, flight.tailId, flight.origin, flight.destination, flight.scheduledDeparture,
          flight.predictedDeparture, flight.scheduledArrival, flight.predictedArrival, flight.departureDelayMinutes,
          flight.arrivalDelayMinutes, flight.actualTurnaroundBeforeMinutes, flight.passengers, flight.status, flight.reasons, flight.cancellationReason,
        ]),
      );
    case "rotations":
      return toCsv(
        ["tailId", "flightId", "legOrder", "origin", "destination", "scheduledDeparture", "simulatedDeparture", "scheduledArrival", "simulatedArrival", "actualTurnaroundBeforeMinutes", "arrivalDelayMinutes", "flightStatus", "finalLocation", "availableAt", "aircraftStatus"],
        result.flights.map((flight) => {
          const aircraft = result.aircraft.find((item) => item.tailId === flight.tailId);
          return [
            flight.tailId, flight.flightId, flight.legOrder, flight.origin, flight.destination,
            flight.scheduledDeparture, flight.predictedDeparture, flight.scheduledArrival, flight.predictedArrival,
            flight.actualTurnaroundBeforeMinutes, flight.arrivalDelayMinutes, flight.status,
            aircraft?.finalLocation, aircraft?.availableAt, aircraft?.status,
          ];
        }),
      );
    case "connections":
      return toCsv(
        ["connectionId", "airport", "fromFlight", "toFlight", "passengers", "minimumConnectMinutes", "actualConnectMinutes", "status"],
        result.connections.map((connection) => [
          connection.connectionId, connection.airport, connection.fromFlight, connection.toFlight,
          connection.passengers, connection.minimumConnectMinutes, connection.actualConnectMinutes, connection.status,
        ]),
      );
    case "crew":
      return toCsv(
        ["crewId", "tailId", "base", "assignedFlights", "operatedFlights", "dutyStart", "lastArrival", "dutyMinutes", "maximumDutyMinutes", "overLimitMinutes", "status"],
        result.crews.map((crew) => [
          crew.crewId, crew.tailId, crew.base, crew.assignedFlights, crew.operatedFlights, crew.dutyStart,
          crew.lastArrival, crew.dutyMinutes, crew.maximumDutyMinutes, crew.overLimitMinutes, crew.status,
        ]),
      );
    default: {
      const exhaustive: never = report as never;
      throw new HttpError(`Unsupported report type "${String(exhaustive)}".`, 400);
    }
  }
}

function runValidatedScenario(input: unknown) {
  const request = SimulationRequestSchema.parse(input);
  const result = simulateNetwork(operationalDataset, request);
  if (result.infeasibleActions.length > 0) {
    throw new HttpError("One or more recovery actions are infeasible.", 422, {
      infeasibleActions: result.infeasibleActions,
      result,
    });
  }
  return result;
}

export function createApp(config: ServerConfig) {
  const app = express();
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new HttpError("Origin is not allowed by CORS configuration.", 403));
    },
  }));
  app.use(express.json({ limit: "256kb" }));

  app.get("/api/health", (_request, response) => {
    response.json({
      status: "ok",
      simulationEngine: "available",
      aiConfigured: Boolean(config.ai.apiKey && config.ai.apiUrl && config.ai.model),
    });
  });

  app.get("/api/dataset", (_request, response) => {
    response.json(operationalDataset);
  });

  app.post("/api/simulations", (request, response) => {
    response.json(runValidatedScenario(request.body));
  });

  app.post("/api/simulations/reset", (request, response) => {
    const scenario = SimulationRequestSchema.omit({ actions: true }).parse(request.body);
    response.json(simulateNetwork(operationalDataset, { ...scenario, actions: [] }));
  });

  app.post("/api/recovery", (request, response) => {
    response.json(runValidatedScenario(request.body));
  });

  app.post("/api/simulations/compare", (request, response) => {
    const { scenarios } = ScenarioCompareSchema.parse(request.body);
    const results = scenarios.map((scenario) => runValidatedScenario(scenario));
    response.json({
      scenarios: results.map((result, index) => ({
        index,
        airportId: result.scenario.airportId,
        startTime: result.scenario.startTime,
        durationMinutes: result.scenario.durationMinutes,
        summary: result.summary,
      })),
    });
  });

  app.post("/api/reports", (request, response) => {
    const { report, ...simulationRequest } = ReportRequestSchema.parse(request.body);
    const result = runValidatedScenario(simulationRequest);
    response.type("text/csv");
    response.attachment(`domino-sky-${report}-report.csv`);
    response.send(reportCsv(result, report));
  });

  app.post("/api/dispatcher/analyze", async (request, response, next) => {
    try {
      const simulationRequest = SimulationRequestSchema.parse(request.body);
      const result = simulateNetwork(operationalDataset, simulationRequest);
      if (result.infeasibleActions.length > 0) {
        throw new HttpError("Current recovery actions are infeasible.", 422, result.infeasibleActions);
      }
      if (!config.ai.apiKey || !config.ai.apiUrl || !config.ai.model) {
        throw new HttpError("AI dispatcher is not configured. The simulation engine remains available.", 503);
      }
      response.json(await analyzeWithAI(result, simulationRequest, operationalDataset, config.ai));
    } catch (error) {
      next(error instanceof HttpError ? error : new HttpError(error instanceof Error ? error.message : "AI provider failed.", 502));
    }
  });

  app.use((_request, _response, next) => {
    next(new HttpError("API route not found.", 404));
  });

  const errorHandler: ErrorRequestHandler = (error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof HttpError) {
      response.status(error.status).json({ error: error.message, details: error.details });
      return;
    }
    if (error instanceof z.ZodError) {
      response.status(400).json({ error: "Request validation failed.", details: error.issues });
      return;
    }
    if (error instanceof SimulationInputError) {
      response.status(400).json({ error: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    response.status(500).json({ error: message });
  };
  app.use(errorHandler);

  return app;
}
