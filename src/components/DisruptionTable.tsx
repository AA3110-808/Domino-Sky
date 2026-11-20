import { ArrowDownUp, ArrowUpRight, MoreHorizontal } from "lucide-react";
import type { Flight } from "../data/network";
import { previewDisruptions } from "../data/preview";

type DisruptionTableProps = {
  flights: Flight[];
  selectedAirport: string;
};

export function DisruptionTable({ flights, selectedAirport }: DisruptionTableProps) {
  const airportFlights = flights.filter((flight) => flight.origin === selectedAirport || flight.destination === selectedAirport);
  const previewById = new Map(previewDisruptions.map((item) => [item.flightId, item]));
  const rows = airportFlights.slice(0, 5);

  return (
    <section className="panel table-panel">
      <div className="panel-heading table-heading">
        <div className="panel-title-group"><div className="panel-icon flight-icon"><ArrowUpRight size={17} /></div><div><h2>Flight disruption watch</h2><p>Scheduled services touching {selectedAirport}</p></div></div>
        <button className="text-button">View all flights <ArrowUpRight size={14} /></button>
      </div>
      <div className="table-preview-banner"><span className="preview-mini-dot" /> UI PREVIEW <span>Sample predictions below are illustrative and are not simulation output.</span></div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>FLIGHT <ArrowDownUp size={11} /></th><th>ROUTE</th><th>SCHEDULED</th><th>PREDICTED</th><th>DELAY</th><th>REASON</th><th /></tr></thead>
          <tbody>
            {rows.map((flight) => {
              const preview = previewById.get(flight.flight_id);
              return (
                <tr key={flight.flight_id}>
                  <td><span className="flight-number">{flight.flight_id}</span><small>{flight.tail_id}</small></td>
                  <td><span className="route-code">{flight.origin}<i />{flight.destination}</span></td>
                  <td className="time-cell">{flight.dep}<small> departs</small></td>
                  <td className={`time-cell ${preview?.delayMinutes ? "predicted-late" : ""}`}>{preview?.predictedDeparture ?? "—"}<small>{preview ? "preview" : "not assessed"}</small></td>
                  <td>{preview?.delayMinutes ? <span className={`delay-badge ${preview.severity}`}>+{preview.delayMinutes}m</span> : <span className="unassessed-badge">—</span>}</td>
                  <td><span className="reason-text">{preview?.reason ?? "Awaiting simulation"}</span></td>
                  <td><button className="row-menu" aria-label={`More details for ${flight.flight_id}`}><MoreHorizontal size={16} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="table-footer"><span>Showing <strong>{rows.length}</strong> of <strong>{airportFlights.length}</strong> dataset flights at {selectedAirport}</span><span className="table-pages"><button disabled aria-label="Previous page">‹</button><b>1</b><button aria-label="Next page">›</button></span></div>
    </section>
  );
}
