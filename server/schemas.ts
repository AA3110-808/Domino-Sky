import { z } from "zod";

const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Expected local 24-hour HH:MM time.");

export const ClosureScenarioSchema = z.object({
  airportId: z.string().min(3).max(3),
  startTime: timeSchema,
  durationMinutes: z.number().int().min(1).max(1440),
});

export const RecoveryActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("cancel-flight"), flightId: z.string().min(1) }),
  z.object({ type: z.literal("reschedule-departure"), flightId: z.string().min(1), newDeparture: timeSchema }),
  z.object({ type: z.literal("hold-connection"), connectionId: z.string().min(1), holdMinutes: z.number().int().min(1).max(360) }),
  z.object({ type: z.literal("substitute-spare"), flightId: z.string().min(1), spareTailId: z.string().min(1) }),
  z.object({ type: z.literal("reassign-aircraft"), flightId: z.string().min(1), toTailId: z.string().min(1) }),
]);

export const SimulationRequestSchema = ClosureScenarioSchema.extend({
  actions: z.array(RecoveryActionSchema).max(100).default([]),
});

export const ScenarioCompareSchema = z.object({
  scenarios: z.array(SimulationRequestSchema).min(2).max(10),
});

export const ReportRequestSchema = SimulationRequestSchema.extend({
  report: z.enum(["summary", "flights", "rotations", "connections", "crew"]),
});

export type ParsedSimulationRequest = z.infer<typeof SimulationRequestSchema>;
