import type { NetworkDataset } from "../data/network";

export type ClosureScenario = {
  airportId: string;
  startTime: string;
  durationMinutes: number;
};

export type DeterministicSimulationEngine<TResult> = (
  dataset: NetworkDataset,
  scenario: ClosureScenario,
) => TResult;
