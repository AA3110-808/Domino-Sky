export type AirportRecord = {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  tier: string;
  capacity_per_hour: number;
};

export type FlightRecord = {
  flight_id: string;
  tail_id: string;
  leg_order: number;
  origin: string;
  destination: string;
  dep: string;
  arr: string;
  block_minutes: number;
  pax: number;
  turnaround_before_min: number | null;
};

export type ConnectionRecord = {
  connection_id: string;
  airport: string;
  from_flight: string;
  to_flight: string;
  passengers: number;
  min_connect_minutes: number;
};

export type CrewRecord = {
  crew_id: string;
  tail_id: string;
  base: string;
  duty_start: string;
  max_duty_mins: number;
  flight_ids: string[];
};

export type SpareAircraftRecord = {
  tail_id: string;
  base: string;
  available_from: string;
  seats: number;
};

export type NetworkDataset = {
  meta: {
    dataset: string;
    operating_day: string;
    min_turnaround_minutes: number;
    seats_per_aircraft: number;
    notes: string[];
  };
  airports: AirportRecord[];
  flights: FlightRecord[];
  connections: ConnectionRecord[];
  crews: CrewRecord[];
  spare_aircraft: SpareAircraftRecord[];
};

export type ClosureScenario = {
  airportId: string;
  startTime: string;
  durationMinutes: number;
};

export type RecoveryAction =
  | { type: "cancel-flight"; flightId: string }
  | { type: "reschedule-departure"; flightId: string; newDeparture: string }
  | { type: "hold-connection"; connectionId: string; holdMinutes: number }
  | { type: "substitute-spare"; flightId: string; spareTailId: string }
  | { type: "reassign-aircraft"; flightId: string; toTailId: string };

export type SimulationRequest = ClosureScenario & {
  actions?: RecoveryAction[];
};

export type FlightResult = {
  flightId: string;
  tailId: string;
  originalTailId: string;
  legOrder: number;
  origin: string;
  destination: string;
  scheduledDeparture: string;
  scheduledArrival: string;
  predictedDeparture: string | null;
  predictedArrival: string | null;
  departureDelayMinutes: number;
  arrivalDelayMinutes: number;
  actualTurnaroundBeforeMinutes: number | null;
  passengers: number;
  status: "on-time" | "delayed" | "cancelled";
  reasons: string[];
  cancellationReason?: string;
};

export type ConnectionResult = {
  connectionId: string;
  airport: string;
  fromFlight: string;
  toFlight: string;
  passengers: number;
  minimumConnectMinutes: number;
  actualConnectMinutes: number | null;
  status: "made" | "missed" | "disrupted-by-cancellation";
};

export type CrewResult = {
  crewId: string;
  tailId: string;
  base: string;
  assignedFlights: string[];
  operatedFlights: string[];
  dutyStart: string;
  lastArrival: string | null;
  dutyMinutes: number;
  maximumDutyMinutes: number;
  overLimitMinutes: number;
  status: "within-limit" | "limit-exceeded";
};

export type AircraftRotationResult = {
  tailId: string;
  isSpare: boolean;
  flightIds: string[];
  operatedFlightIds: string[];
  finalLocation: string;
  availableAt: string;
  status: "available" | "in-operation" | "disrupted";
};

export type SimulationSummary = {
  totalFlights: number;
  delayedFlights: number;
  cancelledFlights: number;
  totalArrivalDelayMinutes: number;
  affectedAircraft: number;
  missedConnections: number;
  passengersOnCancelledFlights: number;
  passengersWithMissedConnections: number;
  crewDutyViolations: number;
  passengerCountCaveat: string;
};

export type SimulationResult = {
  scenario: ClosureScenario;
  actions: RecoveryAction[];
  actionHistory: RecoveryAction[];
  flights: FlightResult[];
  connections: ConnectionResult[];
  crews: CrewResult[];
  aircraft: AircraftRotationResult[];
  summary: SimulationSummary;
  warnings: string[];
  infeasibleActions: string[];
};

export type DispatcherRecommendation = {
  title: string;
  rationale: string;
  benefits: string;
  tradeoffs: string;
  flightIds: string[];
  action: RecoveryAction | null;
  feasible: boolean;
  validationMessage: string;
};

export type DispatcherResponse = {
  summary: string;
  explanations: string[];
  recommendations: DispatcherRecommendation[];
};

export type DeterministicSimulationEngine<TResult> = (
  dataset: NetworkDataset,
  scenario: SimulationRequest,
) => TResult;
