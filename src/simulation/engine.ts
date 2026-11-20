import type {
  AircraftRotationResult,
  ClosureScenario,
  ConnectionResult,
  CrewResult,
  FlightRecord,
  FlightResult,
  NetworkDataset,
  RecoveryAction,
  SimulationRequest,
  SimulationResult,
} from "./contract.js";

const MINUTES_PER_DAY = 1440;

export class SimulationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SimulationInputError";
  }
}

export function parseTime(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw new SimulationInputError(`Invalid 24-hour time "${value}". Expected HH:MM.`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatTime(absoluteMinutes: number): string {
  const normalized = ((absoluteMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hour = Math.floor(normalized / 60).toString().padStart(2, "0");
  const minute = (normalized % 60).toString().padStart(2, "0");
  return `${hour}:${minute}`;
}

function unwrapTime(time: string, notBefore: number): number {
  let value = parseTime(time);
  while (value < notBefore) value += MINUTES_PER_DAY;
  return value;
}

function validateScenario(dataset: NetworkDataset, request: SimulationRequest): ClosureScenario {
  if (!dataset.airports.some((airport) => airport.id === request.airportId)) {
    throw new SimulationInputError(`Unknown airport "${request.airportId}".`);
  }
  parseTime(request.startTime);
  if (!Number.isInteger(request.durationMinutes) || request.durationMinutes < 1 || request.durationMinutes > MINUTES_PER_DAY) {
    throw new SimulationInputError("Closure duration must be an integer between 1 and 1440 minutes.");
  }
  return {
    airportId: request.airportId,
    startTime: request.startTime,
    durationMinutes: request.durationMinutes,
  };
}

function buildScheduledDepartures(flights: FlightRecord[]): Map<string, number> {
  const scheduled = new Map<string, number>();
  const groups = new Map<string, FlightRecord[]>();
  for (const flight of flights) {
    const legs = groups.get(flight.tail_id) ?? [];
    legs.push(flight);
    groups.set(flight.tail_id, legs);
  }
  for (const legs of groups.values()) {
    legs.sort((a, b) => a.leg_order - b.leg_order);
    let previousArrival = 0;
    for (const [index, flight] of legs.entries()) {
      const departure = unwrapTime(flight.dep, index === 0 ? 0 : previousArrival);
      scheduled.set(flight.flight_id, departure);
      previousArrival = departure + flight.block_minutes;
    }
  }
  return scheduled;
}

function applyActions(dataset: NetworkDataset, actions: RecoveryAction[]) {
  const flightsById = new Map(dataset.flights.map((flight) => [flight.flight_id, flight]));
  const connectionsById = new Map(dataset.connections.map((connection) => [connection.connection_id, connection]));
  const cancelled = new Set<string>();
  const departureOverrides = new Map<string, number>();
  const departureHolds = new Map<string, number>();
  const effectiveTail = new Map<string, string>();
  const actionOwner = new Map<string, string>();

  for (const [index, action] of actions.entries()) {
    const connectionForHold = action.type === "hold-connection"
      ? dataset.connections.find((connection) => connection.connection_id === action.connectionId)
      : undefined;
    if (action.type === "hold-connection" && !connectionForHold) {
      throw new SimulationInputError(`Unknown connection "${action.connectionId}".`);
    }
    const actionFlightId = action.type === "hold-connection" ? connectionForHold?.to_flight : action.flightId;
    if (!actionFlightId) throw new SimulationInputError("Connection hold action has no outbound flight.");
    const actionId = `${index + 1}:${action.type}:${action.type === "hold-connection" ? action.connectionId : action.flightId}`;
    const target = flightsById.get(actionFlightId);
    if (!target) throw new SimulationInputError(`Action references unknown flight "${actionFlightId}".`);

    switch (action.type) {
      case "cancel-flight":
        cancelled.add(action.flightId);
        break;
      case "reschedule-departure":
        departureOverrides.set(action.flightId, parseTime(action.newDeparture));
        actionOwner.set(action.flightId, actionId);
        break;
      case "hold-connection":
        if (!Number.isInteger(action.holdMinutes) || action.holdMinutes < 1 || action.holdMinutes > 360) {
          throw new SimulationInputError("A connection hold must be an integer between 1 and 360 minutes.");
        }
        {
          const connection = connectionsById.get(action.connectionId);
          if (!connection) throw new SimulationInputError(`Unknown connection "${action.connectionId}".`);
          const outbound = flightsById.get(connection.to_flight);
          if (!outbound) throw new SimulationInputError(`Connection "${connection.connection_id}" has no outbound flight.`);
          departureHolds.set(outbound.flight_id, (departureHolds.get(outbound.flight_id) ?? 0) + action.holdMinutes);
          actionOwner.set(outbound.flight_id, actionId);
        }
        break;
      case "substitute-spare": {
        const spare = dataset.spare_aircraft.find((aircraft) => aircraft.tail_id === action.spareTailId);
        if (!spare) throw new SimulationInputError(`Unknown spare aircraft "${action.spareTailId}".`);
        if (spare.base !== target.origin) {
          throw new SimulationInputError(`${spare.tail_id} is based at ${spare.base}, not ${target.origin}; repositioning is not available in the dataset.`);
        }
        if (spare.seats < target.pax) {
          throw new SimulationInputError(`${spare.tail_id} capacity (${spare.seats}) is below the target flight's listed passenger load (${target.pax}).`);
        }
        reassignSuffix(dataset, target, spare.tail_id, effectiveTail, actionOwner, actionId);
        break;
      }
      case "reassign-aircraft": {
        const knownTail = dataset.flights.some((flight) => flight.tail_id === action.toTailId)
          || dataset.spare_aircraft.some((aircraft) => aircraft.tail_id === action.toTailId);
        if (!knownTail) throw new SimulationInputError(`Unknown aircraft "${action.toTailId}".`);
        if (action.toTailId === target.tail_id) {
          throw new SimulationInputError(`${target.flight_id} is already assigned to ${target.tail_id}.`);
        }
        const spare = dataset.spare_aircraft.find((aircraft) => aircraft.tail_id === action.toTailId);
        if (spare && (spare.base !== target.origin || spare.seats < target.pax)) {
          throw new SimulationInputError(`${spare.tail_id} is not a feasible substitute for ${target.flight_id} at ${target.origin}.`);
        }
        reassignSuffix(dataset, target, action.toTailId, effectiveTail, actionOwner, actionId);
        break;
      }
      default: {
        const exhaustive: never = action;
        throw new SimulationInputError(`Unsupported recovery action: ${String(exhaustive)}.`);
      }
    }
  }

  return { cancelled, departureOverrides, departureHolds, effectiveTail, actionOwner };
}

function reassignSuffix(
  dataset: NetworkDataset,
  target: FlightRecord,
  toTailId: string,
  effectiveTail: Map<string, string>,
  actionOwner: Map<string, string>,
  actionId: string,
) {
  for (const flight of dataset.flights) {
    if (flight.tail_id === target.tail_id && flight.leg_order >= target.leg_order) {
      effectiveTail.set(flight.flight_id, toTailId);
      actionOwner.set(flight.flight_id, actionId);
    }
  }
}

function closureEndIfClosed(
  airportId: string,
  movementTime: number,
  scenario: ClosureScenario,
): number | undefined {
  if (airportId !== scenario.airportId) return undefined;
  const startOfDay = Math.floor(movementTime / MINUTES_PER_DAY);
  const closureStart = parseTime(scenario.startTime);
  for (let day = startOfDay - 1; day <= startOfDay + 1; day += 1) {
    const start = day * MINUTES_PER_DAY + closureStart;
    const end = start + scenario.durationMinutes;
    if (movementTime >= start && movementTime < end) return end;
  }
  return undefined;
}

function protectClosedAirports(
  flight: FlightRecord,
  proposedDeparture: number,
  readyAt: number,
  scenario: ClosureScenario,
  minimumTurnaround: number,
) {
  let departure = Math.max(proposedDeparture, readyAt);
  let closureAffected = false;
  for (let pass = 0; pass < 4; pass += 1) {
    const originEnd = closureEndIfClosed(flight.origin, departure, scenario);
    if (originEnd !== undefined) {
      departure = Math.max(departure, originEnd);
      closureAffected = true;
    }
    const arrival = departure + flight.block_minutes;
    const destinationEnd = closureEndIfClosed(flight.destination, arrival, scenario);
    if (destinationEnd !== undefined) {
      departure = Math.max(departure, destinationEnd - flight.block_minutes);
      closureAffected = true;
    }
    departure = Math.max(departure, readyAt);
  }
  return {
    departure,
    arrival: departure + flight.block_minutes,
    closureAffected,
    rotationAffected: departure > proposedDeparture && readyAt > proposedDeparture,
    minimumTurnaround,
  };
}

function buildFlightResults(
  dataset: NetworkDataset,
  scenario: ClosureScenario,
  actions: RecoveryAction[],
  schedule: Map<string, number>,
) {
  const applied = applyActions(dataset, actions);
  const flightsByTail = new Map<string, FlightRecord[]>();
  for (const flight of dataset.flights) {
    const tailId = applied.effectiveTail.get(flight.flight_id) ?? flight.tail_id;
    const flights = flightsByTail.get(tailId) ?? [];
    flights.push(flight);
    flightsByTail.set(tailId, flights);
  }

  const resultById = new Map<string, FlightResult>();
  const absoluteById = new Map<string, { departure: number | null; arrival: number | null }>();
  const aircraft: AircraftRotationResult[] = [];
  const infeasibleActions = new Set<string>();
  const minimumTurnaround = dataset.meta.min_turnaround_minutes;

  for (const [tailId, flights] of flightsByTail) {
    flights.sort((a, b) => (schedule.get(a.flight_id)! - schedule.get(b.flight_id)!) || a.leg_order - b.leg_order);
    const spare = dataset.spare_aircraft.find((item) => item.tail_id === tailId);
    let location = spare?.base ?? flights[0].origin;
    let readyAt = spare ? parseTime(spare.available_from) : schedule.get(flights[0].flight_id)!;
    let previousArrival: number | null = null;
    const operatedFlightIds: string[] = [];
    let disrupted = false;

    for (const flight of flights) {
      const scheduledDeparture = schedule.get(flight.flight_id)!;
      const scheduledArrival = scheduledDeparture + flight.block_minutes;
      const originalTailId = flight.tail_id;
      const assignedTailId = tailId;
      const actionId = applied.actionOwner.get(flight.flight_id);

      const makeCancelled = (reason: string): FlightResult => {
        if (actionId && reason !== "Cancelled by recovery action.") infeasibleActions.add(`${actionId}: ${flight.flight_id} cannot be operated: ${reason}`);
        disrupted = true;
        resultById.set(flight.flight_id, {
          flightId: flight.flight_id,
          tailId: assignedTailId,
          originalTailId,
          legOrder: flight.leg_order,
          origin: flight.origin,
          destination: flight.destination,
          scheduledDeparture: formatTime(scheduledDeparture),
          scheduledArrival: formatTime(scheduledArrival),
          predictedDeparture: null,
          predictedArrival: null,
          departureDelayMinutes: 0,
          arrivalDelayMinutes: 0,
          actualTurnaroundBeforeMinutes: null,
          passengers: flight.pax,
          status: "cancelled",
          reasons: [reason],
          cancellationReason: reason,
        });
        absoluteById.set(flight.flight_id, { departure: null, arrival: null });
        return resultById.get(flight.flight_id)!;
      };

      if (applied.cancelled.has(flight.flight_id)) {
        makeCancelled("Cancelled by recovery action.");
        continue;
      }
      if (location !== flight.origin) {
        makeCancelled(`Aircraft is at ${location}, not the scheduled origin ${flight.origin}.`);
        continue;
      }

      let desiredDeparture = applied.departureOverrides.has(flight.flight_id)
        ? scheduledDeparture - (scheduledDeparture % MINUTES_PER_DAY) + applied.departureOverrides.get(flight.flight_id)!
        : scheduledDeparture;
      if (desiredDeparture < scheduledDeparture - MINUTES_PER_DAY / 2) desiredDeparture += MINUTES_PER_DAY;
      desiredDeparture += applied.departureHolds.get(flight.flight_id) ?? 0;
      const timing = protectClosedAirports(flight, desiredDeparture, readyAt, scenario, minimumTurnaround);
      const departure = timing.departure;
      const arrival = timing.arrival;
      const reasons: string[] = [];
      if (departure > scheduledDeparture && timing.rotationAffected) reasons.push("Aircraft rotation / minimum turnaround");
      if (timing.closureAffected) reasons.push(`Airport closure at ${scenario.airportId}`);
      if (applied.departureOverrides.has(flight.flight_id) || applied.departureHolds.has(flight.flight_id)) reasons.push("Recovery action");

      const departureDelayMinutes = Math.max(0, departure - scheduledDeparture);
      const arrivalDelayMinutes = Math.max(0, arrival - scheduledArrival);
      const status = arrivalDelayMinutes > 0 ? "delayed" : "on-time";
      resultById.set(flight.flight_id, {
        flightId: flight.flight_id,
        tailId: assignedTailId,
        originalTailId,
        legOrder: flight.leg_order,
        origin: flight.origin,
        destination: flight.destination,
        scheduledDeparture: formatTime(scheduledDeparture),
        scheduledArrival: formatTime(scheduledArrival),
        predictedDeparture: formatTime(departure),
        predictedArrival: formatTime(arrival),
        departureDelayMinutes,
        arrivalDelayMinutes,
        actualTurnaroundBeforeMinutes: previousArrival === null ? null : departure - previousArrival,
        passengers: flight.pax,
        status,
        reasons: [...new Set(reasons)],
      });
      absoluteById.set(flight.flight_id, { departure, arrival });
      operatedFlightIds.push(flight.flight_id);
      location = flight.destination;
      previousArrival = arrival;
      readyAt = arrival + minimumTurnaround;
      disrupted ||= arrivalDelayMinutes > 0;
    }

    aircraft.push({
      tailId,
      isSpare: Boolean(spare),
      flightIds: flights.map((flight) => flight.flight_id),
      operatedFlightIds,
      finalLocation: location,
      availableAt: formatTime(readyAt),
      status: disrupted ? "disrupted" : "available",
    });
  }

  const flights = dataset.flights.map((flight) => resultById.get(flight.flight_id)!);
  const affectedTails = new Set(flights.filter((flight) => flight.status !== "on-time").map((flight) => flight.tailId));
  return { flights, absoluteById, aircraft, infeasibleActions: [...infeasibleActions], affectedTails };
}

function buildConnectionResults(
  dataset: NetworkDataset,
  flights: FlightResult[],
  absoluteById: Map<string, { departure: number | null; arrival: number | null }>,
) {
  const flightById = new Map(flights.map((flight) => [flight.flightId, flight]));
  const connections: ConnectionResult[] = dataset.connections.map((connection) => {
    const from = flightById.get(connection.from_flight);
    const to = flightById.get(connection.to_flight);
    const fromTimes = absoluteById.get(connection.from_flight);
    const toTimes = absoluteById.get(connection.to_flight);
    if (!from || !to || !fromTimes || !toTimes) {
      throw new SimulationInputError(`Connection "${connection.connection_id}" references a missing flight.`);
    }
    if (from.status === "cancelled" || to.status === "cancelled" || fromTimes.arrival === null || toTimes.departure === null) {
      return {
        connectionId: connection.connection_id,
        airport: connection.airport,
        fromFlight: connection.from_flight,
        toFlight: connection.to_flight,
        passengers: connection.passengers,
        minimumConnectMinutes: connection.min_connect_minutes,
        actualConnectMinutes: null,
        status: "disrupted-by-cancellation",
      };
    }
    let inboundArrival = fromTimes.arrival;
    while (inboundArrival > toTimes.departure + MINUTES_PER_DAY / 2) inboundArrival -= MINUTES_PER_DAY;
    let outboundDeparture = toTimes.departure;
    while (outboundDeparture < inboundArrival - MINUTES_PER_DAY / 2) outboundDeparture += MINUTES_PER_DAY;
    const actualConnectMinutes = outboundDeparture - inboundArrival;
    return {
      connectionId: connection.connection_id,
      airport: connection.airport,
      fromFlight: connection.from_flight,
      toFlight: connection.to_flight,
      passengers: connection.passengers,
      minimumConnectMinutes: connection.min_connect_minutes,
      actualConnectMinutes,
      status: actualConnectMinutes >= connection.min_connect_minutes ? "made" : "missed",
    };
  });
  return connections;
}

function buildCrewResults(dataset: NetworkDataset, flights: FlightResult[], absoluteById: Map<string, { departure: number | null; arrival: number | null }>): CrewResult[] {
  const flightsById = new Map(flights.map((flight) => [flight.flightId, flight]));
  return dataset.crews.map((crew) => {
    const operatedFlights = crew.flight_ids.filter((flightId) => flightsById.get(flightId)?.status !== "cancelled");
    const arrivals = operatedFlights
      .map((flightId) => absoluteById.get(flightId)?.arrival)
      .filter((arrival): arrival is number => arrival !== undefined && arrival !== null);
    const start = parseTime(crew.duty_start);
    let lastArrival = arrivals.length ? Math.max(...arrivals) : null;
    if (lastArrival !== null) {
      while (lastArrival < start) lastArrival += MINUTES_PER_DAY;
    }
    const dutyMinutes = lastArrival === null ? 0 : lastArrival - start;
    const overLimitMinutes = Math.max(0, dutyMinutes - crew.max_duty_mins);
    return {
      crewId: crew.crew_id,
      tailId: crew.tail_id,
      base: crew.base,
      assignedFlights: [...crew.flight_ids],
      operatedFlights,
      dutyStart: crew.duty_start,
      lastArrival: lastArrival === null ? null : formatTime(lastArrival),
      dutyMinutes,
      maximumDutyMinutes: crew.max_duty_mins,
      overLimitMinutes,
      status: overLimitMinutes > 0 ? "limit-exceeded" : "within-limit",
    };
  });
}

export function simulateNetwork(dataset: NetworkDataset, request: SimulationRequest): SimulationResult {
  const scenario = validateScenario(dataset, request);
  const actions = request.actions ?? [];
  const scheduled = buildScheduledDepartures(dataset.flights);
  const flightCalculation = buildFlightResults(dataset, scenario, actions, scheduled);
  const connections = buildConnectionResults(dataset, flightCalculation.flights, flightCalculation.absoluteById);
  const crews = buildCrewResults(dataset, flightCalculation.flights, flightCalculation.absoluteById);
  const infeasibleActions = [...flightCalculation.infeasibleActions];
  for (const [index, action] of actions.entries()) {
    if (action.type !== "hold-connection") continue;
    const connection = connections.find((item) => item.connectionId === action.connectionId);
    if (connection?.status !== "made") {
      infeasibleActions.push(`${index + 1}:${action.type}:${action.connectionId}: the requested hold does not protect this connection.`);
    }
  }
  if (actions.length > 0) {
    const baseline = simulateNetwork(dataset, { ...scenario, actions: [] });
    const baselineCrews = new Map(baseline.crews.map((crew) => [crew.crewId, crew]));
    for (const crew of crews) {
      const previous = baselineCrews.get(crew.crewId);
      if (!previous || crew.overLimitMinutes <= previous.overLimitMinutes) continue;
      const affectedFlights = new Set(crew.assignedFlights);
      for (const [index, action] of actions.entries()) {
        let targetFlightId: string | undefined;
        if (action.type === "hold-connection") {
          targetFlightId = dataset.connections.find((item) => item.connection_id === action.connectionId)?.to_flight;
        } else {
          targetFlightId = action.flightId;
        }
        if (targetFlightId && affectedFlights.has(targetFlightId)) {
          infeasibleActions.push(`${index + 1}:${action.type}:${targetFlightId}: would exceed ${crew.crewId}'s maximum duty by ${crew.overLimitMinutes} minutes.`);
        }
      }
    }
  }
  const missed = connections.filter((connection) => connection.status !== "made");
  const summary = {
    totalFlights: dataset.flights.length,
    delayedFlights: flightCalculation.flights.filter((flight) => flight.status === "delayed").length,
    cancelledFlights: flightCalculation.flights.filter((flight) => flight.status === "cancelled").length,
    totalArrivalDelayMinutes: flightCalculation.flights.reduce((total, flight) => total + flight.arrivalDelayMinutes, 0),
    affectedAircraft: flightCalculation.affectedTails.size,
    missedConnections: missed.length,
    passengersOnCancelledFlights: flightCalculation.flights
      .filter((flight) => flight.status === "cancelled")
      .reduce((total, flight) => total + flight.passengers, 0),
    passengersWithMissedConnections: missed.reduce((total, connection) => total + connection.passengers, 0),
    crewDutyViolations: crews.filter((crew) => crew.status === "limit-exceeded").length,
    passengerCountCaveat: "Flight loads and connection passenger counts are reported separately from the supplied dataset. No passenger-level identities are available; these categories may overlap and must not be summed as unique passengers.",
  };
  const warnings = [
    "Crew duty uses each roster's assigned flight list and the last operated arrival. Crew swaps, reserve crew, and duty extensions are not present in the dataset.",
    "A listed passenger count on a cancelled flight is a scheduled flight load, not a passenger-level rebooking outcome.",
  ];

  return {
    scenario,
    actions: [...actions],
    actionHistory: [...actions],
    flights: flightCalculation.flights,
    connections,
    crews,
    aircraft: flightCalculation.aircraft,
    summary,
    warnings,
    infeasibleActions: [...new Set(infeasibleActions)],
  };
}
