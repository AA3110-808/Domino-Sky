import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type { NetworkDataset } from "../src/simulation/contract.js";

const datasetSchema = z.object({
  meta: z.object({
    dataset: z.string(),
    operating_day: z.string(),
    min_turnaround_minutes: z.number().int().positive(),
    seats_per_aircraft: z.number().int().positive(),
    notes: z.array(z.string()),
  }),
  airports: z.array(z.object({
    id: z.string().min(3).max(3),
    name: z.string(),
    city: z.string(),
    lat: z.number(),
    lng: z.number(),
    tier: z.string(),
    capacity_per_hour: z.number().positive(),
  })),
  flights: z.array(z.object({
    flight_id: z.string(),
    tail_id: z.string(),
    leg_order: z.number().int().positive(),
    origin: z.string(),
    destination: z.string(),
    dep: z.string(),
    arr: z.string(),
    block_minutes: z.number().int().positive(),
    pax: z.number().int().nonnegative(),
    turnaround_before_min: z.number().int().nonnegative().nullable(),
  })),
  connections: z.array(z.object({
    connection_id: z.string(),
    airport: z.string(),
    from_flight: z.string(),
    to_flight: z.string(),
    passengers: z.number().int().nonnegative(),
    min_connect_minutes: z.number().int().positive(),
  })),
  crews: z.array(z.object({
    crew_id: z.string(),
    tail_id: z.string(),
    base: z.string(),
    duty_start: z.string(),
    max_duty_mins: z.number().int().positive(),
    flight_ids: z.array(z.string()),
  })),
  spare_aircraft: z.array(z.object({
    tail_id: z.string(),
    base: z.string(),
    available_from: z.string(),
    seats: z.number().int().positive(),
  })),
});

const datasetPath = resolve(process.cwd(), "flight_network.json");
const parsedDataset = datasetSchema.parse(JSON.parse(readFileSync(datasetPath, "utf8")));

export const operationalDataset: NetworkDataset = parsedDataset;
