import { describe, expect, it } from "vitest";
import { actualNetwork } from "../data/network";
import type { SimulationRequest } from "./contract";
import { formatTime, parseTime, simulateNetwork, SimulationInputError } from "./engine";

const scenario: SimulationRequest = {
  airportId: "BOM",
  startTime: "10:30",
  durationMinutes: 90,
};

describe("simulation time utilities", () => {
  it("parses strict local HH:MM and formats midnight crossings", () => {
    expect(parseTime("00:00")).toBe(0);
    expect(parseTime("23:59")).toBe(1439);
    expect(formatTime(1490)).toBe("00:50");
    expect(() => parseTime("24:00")).toThrow(SimulationInputError);
  });
});

describe("deterministic network simulation", () => {
  it("produces repeatable schedule-based output without a closure impact", () => {
    const request = { ...scenario, startTime: "23:00", durationMinutes: 30 };
    const first = simulateNetwork(actualNetwork, request);
    const second = simulateNetwork(actualNetwork, request);
    expect(first).toEqual(second);
    expect(first.flights).toHaveLength(actualNetwork.flights.length);
    expect(first.summary.cancelledFlights).toBe(0);
    expect(first.summary.delayedFlights).toBe(0);
  });

  it("holds arrivals and departures during an airport closure and propagates turnaround delay", () => {
    const result = simulateNetwork(actualNetwork, scenario);
    const incoming = result.flights.find((flight) => flight.flightId === "DS0203");
    const departing = result.flights.find((flight) => flight.flightId === "DS0403");
    const followingLeg = result.flights.find((flight) => flight.flightId === "DS0404");

    expect(incoming?.predictedArrival).toBe("12:00");
    expect(incoming?.arrivalDelayMinutes).toBe(5);
    expect(departing?.predictedDeparture).toBe("12:00");
    expect(followingLeg?.departureDelayMinutes).toBeGreaterThan(0);
    if (!departing?.predictedArrival || !followingLeg?.predictedDeparture) {
      throw new Error("Expected both aircraft rotation legs to operate.");
    }
    expect(followingLeg.actualTurnaroundBeforeMinutes).toBe(
      parseTime(followingLeg.predictedDeparture) - parseTime(departing.predictedArrival),
    );
  });

  it("uses actual arrival and departure times to identify missed connections", () => {
    const result = simulateNetwork(actualNetwork, {
      airportId: "DEL",
      startTime: "12:00",
      durationMinutes: 60,
    });
    const connection = result.connections.find((item) => item.connectionId === "CX10");

    expect(connection?.status).toBe("missed");
    expect(connection?.passengers).toBe(18);
    expect(result.summary.passengersWithMissedConnections).toBeGreaterThanOrEqual(18);
  });

  it("handles a closure and flight that cross local midnight", () => {
    const dataset = structuredClone(actualNetwork);
    const firstLeg = dataset.flights.find((flight) => flight.flight_id === "DS0101");
    if (!firstLeg) throw new Error("Expected first flight in supplied dataset.");
    firstLeg.dep = "23:55";
    firstLeg.arr = "00:45";

    const result = simulateNetwork(dataset, {
      airportId: "DEL",
      startTime: "23:50",
      durationMinutes: 60,
    });
    const flight = result.flights.find((item) => item.flightId === "DS0101");

    expect(flight?.scheduledArrival).toBe("00:45");
    expect(flight?.predictedDeparture).toBe("00:50");
    expect(flight?.predictedArrival).toBe("01:40");
    expect(flight?.departureDelayMinutes).toBe(55);
  });

  it("marks cancelled-flight connections and passenger loads separately", () => {
    const result = simulateNetwork(actualNetwork, {
      ...scenario,
      actions: [{ type: "cancel-flight", flightId: "DS1502" }],
    });

    expect(result.flights.find((flight) => flight.flightId === "DS1502")?.status).toBe("cancelled");
    expect(result.connections.find((connection) => connection.connectionId === "CX01")?.status)
      .toBe("disrupted-by-cancellation");
    expect(result.summary.passengersOnCancelledFlights).toBeGreaterThan(0);
    expect(result.summary.passengerCountCaveat).toContain("may overlap");
  });

  it("propagates a rescheduled departure through minimum turnaround and crew duty", () => {
    const result = simulateNetwork(actualNetwork, {
      ...scenario,
      actions: [{ type: "reschedule-departure", flightId: "DS0105", newDeparture: "18:00" }],
    });

    expect(result.flights.find((flight) => flight.flightId === "DS0105")?.predictedDeparture).toBe("18:00");
    expect(result.crews.find((crew) => crew.crewId === "CR01")?.status).toBe("limit-exceeded");
  });

  it("substitutes a co-located spare across the remaining aircraft rotation", () => {
    const result = simulateNetwork(actualNetwork, {
      ...scenario,
      actions: [{ type: "substitute-spare", flightId: "DS0201", spareTailId: "VT-DS18" }],
    });
    const substituted = result.flights.filter((flight) => flight.originalTailId === "VT-DS02");

    expect(substituted.map((flight) => flight.tailId)).toEqual(Array(4).fill("VT-DS18"));
    expect(substituted.every((flight) => flight.status !== "cancelled")).toBe(true);
    expect(result.aircraft.find((aircraft) => aircraft.tailId === "VT-DS18")?.operatedFlightIds).toHaveLength(4);
  });

  it("rejects spare-aircraft moves that need an unmodeled reposition", () => {
    expect(() => simulateNetwork(actualNetwork, {
      ...scenario,
      actions: [{ type: "substitute-spare", flightId: "DS0202", spareTailId: "VT-DS18" }],
    })).toThrow(/repositioning is not available/);
  });
});
