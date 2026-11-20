import { useMemo, useState } from "react";
import { ArrowDownUp, ArrowUpRight, Search } from "lucide-react";
import type { Flight } from "../data/network";
import type { SimulationResult } from "../simulation/contract";

type DisruptionTableProps = {
  flights: Flight[];
  selectedAirport: string;
  result: SimulationResult | null;
};

type FlightFilter = "all" | "delayed" | "cancelled" | "on-time" | "not-run";

export function DisruptionTable({ flights, selectedAirport, result }: DisruptionTableProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FlightFilter>("all");
  const resultById = useMemo(() => new Map(result?.flights.map((flight) => [flight.flightId, flight]) ?? []), [result]);
  const airportFlights = flights.filter((flight) => flight.origin === selectedAirport || flight.destination === selectedAirport);
  const rows = airportFlights.filter((flight) => {
    const flightResult = resultById.get(flight.flight_id);
    const matchesQuery = `${flight.flight_id} ${flight.tail_id} ${flight.origin} ${flight.destination}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesFilter = filter === "all"
      || (filter === "not-run" && !flightResult)
      || (filter !== "not-run" && flightResult?.status === filter);
    return matchesQuery && matchesFilter;
  });

  return (
    <section className="panel table-panel">
      <div className="panel-heading table-heading">
        <div className="panel-title-group">
          <div className="panel-icon flight-icon"><ArrowUpRight size={16} /></div>
          <div><h2>Flight operations</h2><p>Services touching {selectedAirport} · {result ? "deterministic simulation output" : "scheduled dataset"}</p></div>
        </div>
        <div className="table-controls">
          <label className="table-search"><Search size={13} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search flight or tail" aria-label="Search flights" /></label>
          <label className="table-filter"><ArrowDownUp size={12} /><select value={filter} onChange={(event) => setFilter(event.target.value as FlightFilter)} aria-label="Filter flights">
            <option value="all">All flights</option>
            <option value="not-run">Not simulated</option>
            <option value="delayed">Delayed</option>
            <option value="cancelled">Cancelled</option>
            <option value="on-time">On time</option>
          </select></label>
        </div>
      </div>
      <div className={`table-preview-banner ${result ? "result-banner" : ""}`}>
        <span className="preview-mini-dot" />
        {result ? "ENGINE RESULT" : "SIMULATION REQUIRED"}
        <span>{result ? `Computed from the supplied network and ${result.scenario.airportId} closure scenario.` : "Predicted times, delays, and cancellations appear after a simulation run."}</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>FLIGHT <ArrowDownUp size={10} /></th><th>ROUTE</th><th>SCHEDULED</th><th>SIMULATED</th><th>ARRIVAL DELAY</th><th>STATUS / REASON</th></tr></thead>
          <tbody>
            {rows.map((flight) => {
              const flightResult = resultById.get(flight.flight_id);
              return (
                <tr key={flight.flight_id}>
                  <td><span className="flight-number">{flight.flight_id}</span><small>{flight.tail_id}</small></td>
                  <td><span className="route-code">{flight.origin}<i />{flight.destination}</span></td>
                  <td className="time-cell">{flight.dep}<small>{flight.arr} arr</small></td>
                  <td className={`time-cell ${flightResult?.status === "delayed" ? "predicted-late" : ""}`}>
                    {flightResult?.status === "cancelled" ? "Cancelled" : flightResult?.predictedDeparture ?? "—"}
                    <small>{flightResult?.predictedArrival ? `${flightResult.predictedArrival} arr` : flightResult?.status === "cancelled" ? flightResult.cancellationReason : "Not simulated"}</small>
                  </td>
                  <td>{flightResult?.status === "cancelled" ? "—" : flightResult ? `${flightResult.arrivalDelayMinutes} min` : "—"}</td>
                  <td>{flightResult ? <span className={`flight-status ${flightResult.status}`}>{flightResult.status === "on-time" ? "On time" : flightResult.status}</span> : <span className="reason-text">Simulation required</span>}
                    {flightResult?.reasons.length ? <small>{flightResult.reasons.join(" · ")}</small> : null}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td className="empty-table" colSpan={6}>No flights match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="table-footer"><span>Showing <strong>{rows.length}</strong> of <strong>{airportFlights.length}</strong> scheduled flights at {selectedAirport}</span><span>{result ? `${result.summary.delayedFlights} delayed · ${result.summary.cancelledFlights} cancelled network-wide` : "No results calculated"}</span></div>
    </section>
  );
}
