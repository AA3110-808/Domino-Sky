import { useMemo, useState } from "react";
import { ArrowRight, Clock3, GitBranch, ShieldAlert, Sparkles, Users, WandSparkles } from "lucide-react";
import type { Connection, Crew, Flight, SpareAircraft } from "../data/network";
import type { DispatcherResponse, SimulationResult } from "../simulation/contract";

type AircraftRotationProps = {
  flights: Flight[];
  spareAircraft: SpareAircraft[];
  selectedAirport: string;
  result: SimulationResult | null;
};

const HOUR_START = 6;
const HOUR_END = 22;
const timelineLabels = [6, 9, 12, 15, 18, 21];

function minutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function duration(dep: string, arr: string) {
  return Math.max(20, minutes(arr) - minutes(dep));
}

export function AircraftRotation({ flights, spareAircraft, selectedAirport, result }: AircraftRotationProps) {
  const tails = useMemo(() => [...new Set([
    ...flights.map((flight) => flight.tail_id),
    ...spareAircraft.map((aircraft) => aircraft.tail_id),
    ...(result?.aircraft.map((aircraft) => aircraft.tailId) ?? []),
  ])], [flights, spareAircraft, result]);
  const [selectedTail, setSelectedTail] = useState("VT-DS02");
  const selectedRotation = result?.aircraft.find((aircraft) => aircraft.tailId === selectedTail);
  const rotationFlights = result
    ? result.flights.filter((flight) => flight.tailId === selectedTail)
    : flights.filter((flight) => flight.tail_id === selectedTail).map((flight) => ({
      flightId: flight.flight_id,
      tailId: flight.tail_id,
      originalTailId: flight.tail_id,
      legOrder: flight.leg_order,
      origin: flight.origin,
      destination: flight.destination,
      scheduledDeparture: flight.dep,
      scheduledArrival: flight.arr,
      predictedDeparture: flight.dep,
      predictedArrival: flight.arr,
      departureDelayMinutes: 0,
      arrivalDelayMinutes: 0,
      actualTurnaroundBeforeMinutes: null,
      passengers: flight.pax,
      status: "on-time" as const,
      reasons: [],
    }));
  return (
    <section className="panel rotation-panel" id="rotations">
      <div className="panel-heading compact-heading">
        <div className="panel-title-group"><div className="panel-icon rotation-icon"><GitBranch size={16} /></div><div><h2>Aircraft rotation</h2><p>{selectedRotation ? `${selectedRotation.finalLocation} · available ${selectedRotation.availableAt}` : "Scheduled rotation · local time"}</p></div></div>
        <label className="tail-select"><span>TAIL</span><select value={selectedTail} onChange={(event) => setSelectedTail(event.target.value)}>{tails.map((tail) => <option key={tail} value={tail}>{tail}</option>)}</select></label>
      </div>
      <div className="timeline">
        <div className="timeline-hours"><span className="tail-heading">TAIL</span>{timelineLabels.map((hour) => <span key={hour} style={{ left: `${((hour - HOUR_START) / (HOUR_END - HOUR_START)) * 100}%` }}>{String(hour).padStart(2, "0")}:00</span>)}</div>
        <div className="timeline-row">
          <div className="tail-label">{selectedTail.replace("VT-", "")}</div>
          <div className="timeline-track">
            {rotationFlights.map((flight) => {
              const scheduledDep = flight.scheduledDeparture;
              const predictedDep = flight.predictedDeparture ?? scheduledDep;
              const left = ((minutes(predictedDep) - HOUR_START * 60) / ((HOUR_END - HOUR_START) * 60)) * 100;
              const blockMinutes = flights.find((source) => source.flight_id === flight.flightId)?.block_minutes ?? duration(scheduledDep, flight.scheduledArrival);
              const width = (blockMinutes / ((HOUR_END - HOUR_START) * 60)) * 100;
              const scenarioLeg = flight.origin === selectedAirport || flight.destination === selectedAirport;
              return <div key={flight.flightId} title={`${flight.flightId} · ${flight.origin} to ${flight.destination} · scheduled ${scheduledDep}–${flight.scheduledArrival} · simulated ${flight.predictedDeparture ?? "cancelled"}–${flight.predictedArrival ?? "cancelled"} · delay ${flight.arrivalDelayMinutes} min`} className={`rotation-leg ${scenarioLeg ? "rotation-focus" : ""} ${flight.status === "delayed" ? "rotation-delayed" : ""} ${flight.status === "cancelled" ? "rotation-cancelled" : ""}`} style={{ left: `${left}%`, width: `${width}%` }}><span>{flight.flightId}</span></div>;
            })}
          </div>
        </div>
      </div>
      <div className="rotation-detail-scroll">
        <table className="rotation-detail-table">
          <thead><tr><th>FLIGHT / ROUTE</th><th>SCHEDULED</th><th>SIMULATED</th><th>TURN BEFORE</th><th>ACTUAL TURN</th><th>PROPAGATED DELAY</th></tr></thead>
          <tbody>{rotationFlights.map((flight) => {
            const source = flights.find((item) => item.flight_id === flight.flightId);
            return <tr key={flight.flightId}><td><strong>{flight.flightId}</strong><small>{flight.origin}–{flight.destination}</small></td><td>{flight.scheduledDeparture}–{flight.scheduledArrival}</td><td>{flight.status === "cancelled" ? "Cancelled" : `${flight.predictedDeparture}–${flight.predictedArrival}`}</td><td>{source?.turnaround_before_min === null || source?.turnaround_before_min === undefined ? "—" : `${source.turnaround_before_min} min`}</td><td>{flight.actualTurnaroundBeforeMinutes === null ? "—" : `${flight.actualTurnaroundBeforeMinutes} min`}</td><td>{flight.status === "cancelled" ? flight.cancellationReason : `${flight.arrivalDelayMinutes} min`}</td></tr>;
          })}{rotationFlights.length === 0 && <tr><td className="empty-table" colSpan={6}>No operated flights assigned to this aircraft.</td></tr>}</tbody>
        </table>
      </div>
      <div className="rotation-footer"><span><i className="legend-flight" /> Scheduled leg</span><span><i className="legend-focus" /> Scenario airport leg</span><span className="schedule-only">{selectedRotation?.status ?? "Schedule view"} · all times IST</span></div>
    </section>
  );
}

type ConnectionPanelProps = { connections: Connection[]; result: SimulationResult | null };

export function ConnectionPanel({ connections, result }: ConnectionPanelProps) {
  const resultById = new Map(result?.connections.map((connection) => [connection.connectionId, connection]) ?? []);
  return (
    <section className="panel connection-panel" id="connections">
      <div className="panel-heading compact-heading">
        <div className="panel-title-group"><div className="panel-icon connection-icon"><Users size={16} /></div><div><h2>Passenger connections</h2><p>{result ? "Connection feasibility · deterministic result" : "Listed connecting passengers · not assessed"}</p></div></div>
        <span className="quiet-count">{connections.length} links</span>
      </div>
      <div className="connection-list">
        {connections.map((connection) => {
          const connectionResult = resultById.get(connection.connection_id);
          return (
          <div className="connection-row" key={connection.connection_id}>
            <div className="connection-airport">{connection.airport}</div>
            <div className="connection-detail"><strong>{connection.from_flight}<span>→</span>{connection.to_flight}</strong><small>{connectionResult?.actualConnectMinutes === null || connectionResult?.actualConnectMinutes === undefined ? `${connection.min_connect_minutes} min minimum connection` : `${connectionResult.actualConnectMinutes} min actual · ${connection.min_connect_minutes} min minimum`}</small></div>
            <div className="connection-pax"><strong>{connection.passengers}</strong><small>pax</small></div>
            <span className={`connection-status ${connectionResult?.status ?? "pending"}`}>{connectionResult?.status === "made" ? "Made" : connectionResult?.status === "missed" ? "Missed" : connectionResult ? "Cancelled" : "Not run"}</span>
          </div>
          );
        })}
      </div>
      <div className="connection-note"><Clock3 size={13} /> Listed passengers are connection counts; categories may overlap.</div>
    </section>
  );
}

type CrewPanelProps = { crews: Crew[] };

export function CrewDutyPanel({ crews, result }: CrewPanelProps & { result: SimulationResult | null }) {
  const [selectedCrewId, setSelectedCrewId] = useState(crews[0]?.crew_id ?? "");
  const selectedCrew = crews.find((crew) => crew.crew_id === selectedCrewId);
  const crewResult = result?.crews.find((crew) => crew.crewId === selectedCrewId);
  return (
    <section className="panel crew-panel" id="crew">
      <div className="panel-heading compact-heading">
        <div className="panel-title-group"><div className="panel-icon crew-icon"><ShieldAlert size={16} /></div><div><h2>Crew duty watch</h2><p>{result ? "Simulated duty versus supplied legal limits" : "Roster data · run simulation to assess duty"}</p></div></div>
        <label className="tail-select"><span>CREW</span><select value={selectedCrewId} onChange={(event) => setSelectedCrewId(event.target.value)}>{crews.map((crew) => <option key={crew.crew_id} value={crew.crew_id}>{crew.crew_id}</option>)}</select></label>
      </div>
      {selectedCrew && <div className="crew-detail-card">
        <div className="crew-avatar">{selectedCrew.crew_id.slice(-2)}</div>
        <div className="crew-details"><strong>{selectedCrew.crew_id}<span> · {selectedCrew.base} base</span></strong><small>{selectedCrew.flight_ids.length} assigned legs · duty starts {selectedCrew.duty_start}</small></div>
        <span className={`crew-duty-status ${crewResult?.status ?? "pending"}`}>{crewResult?.status === "limit-exceeded" ? `${crewResult.overLimitMinutes} min over` : crewResult ? "Within limit" : "Not assessed"}</span>
      </div>}
      {crewResult && <div className="crew-duty-metrics"><span>Duty time <strong>{crewResult.dutyMinutes} min</strong></span><span>Maximum <strong>{crewResult.maximumDutyMinutes} min</strong></span><span>Last operated arrival <strong>{crewResult.lastArrival ?? "—"}</strong></span></div>}
      <div className="crew-footnote"><span className="risk-outline"><ShieldAlert size={12} /> DUTY LIMITS FROM DATASET</span><span>{crewResult ? `${crewResult.operatedFlights.length} flights operated` : "Crew changes are not modeled"}</span></div>
    </section>
  );
}

type DispatcherPanelProps = {
  aiConfigured: boolean | null;
  loading: boolean;
  response: DispatcherResponse | null;
  error: string | null;
  onAnalyze: () => void;
};

export function DispatcherPanel({ aiConfigured, loading, response, error, onAnalyze }: DispatcherPanelProps) {
  return (
    <section className="panel dispatcher-panel">
      <div className="dispatcher-head">
        <div className="ai-orb"><Sparkles size={16} /></div>
        <div><span className="ai-eyebrow">DISPATCH INTELLIGENCE</span><h2>AI Dispatcher</h2></div>
        <span className="advisory-tag">{aiConfigured ? "ADVISORY ONLY" : "NOT CONFIGURED"}</span>
      </div>
      <div className="dispatcher-message">
        <div className="ai-message-icon"><WandSparkles size={16} /></div>
        <div>
          <strong>{response ? "Engine-backed operational summary" : aiConfigured === false ? "AI provider is not configured." : "Recommendations require simulation results."}</strong>
          <p>{response?.summary ?? (aiConfigured === false ? "Set AI_API_KEY, AI_API_URL, and AI_MODEL on the backend to enable analysis. The deterministic simulator works without AI." : "The AI can explain verified output. All operational figures come from the deterministic engine.")}</p>
        </div>
      </div>
      {response?.explanations.map((explanation, index) => <p className="dispatcher-explanation" key={`${index}-${explanation}`}>{explanation}</p>)}
      {response?.recommendations.map((recommendation, index) => <div className="ai-recommendation" key={`${index}-${recommendation.title}`}>
        <strong>{recommendation.title}</strong><p>{recommendation.rationale}</p>
        <small>{recommendation.feasible ? "Action validated against current deterministic results before application." : recommendation.validationMessage}</small>
      </div>)}
      {error && <div className="inline-error" role="alert">{error}</div>}
      <button className="dispatcher-button" onClick={onAnalyze} disabled={!aiConfigured || loading}>{loading ? "Analyzing verified results…" : aiConfigured ? "Analyze current simulation" : "AI not configured"} <ArrowRight size={14} /></button>
      <div className="ai-footer"><span className="ai-lock" /> AI explanations only · verified engine output required</div>
    </section>
  );
}

export function RecoveryComparison({ baseline, result }: { baseline: SimulationResult | null; result: SimulationResult | null }) {
  const metrics = [
    { label: "Total arrival delay", value: (summary: SimulationResult["summary"]) => `${summary.totalArrivalDelayMinutes} min` },
    { label: "Delayed flights", value: (summary: SimulationResult["summary"]) => String(summary.delayedFlights) },
    { label: "Cancelled flights", value: (summary: SimulationResult["summary"]) => String(summary.cancelledFlights) },
    { label: "Missed connections", value: (summary: SimulationResult["summary"]) => String(summary.missedConnections) },
    { label: "Flight load on cancelled flights", value: (summary: SimulationResult["summary"]) => String(summary.passengersOnCancelledFlights) },
    { label: "Passengers on missed connection records", value: (summary: SimulationResult["summary"]) => String(summary.passengersWithMissedConnections) },
    { label: "Crew duty violations", value: (summary: SimulationResult["summary"]) => String(summary.crewDutyViolations) },
  ];
  return (
    <section className="panel recovery-panel">
      <div className="panel-heading compact-heading recovery-heading">
        <div className="panel-title-group"><div className="panel-icon recovery-icon"><GitBranch size={16} /></div><div><h2>Before & after recovery</h2><p>Baseline and applied recovery · deterministic results</p></div></div>
        <span className="comparison-preview-tag">{result?.actions.length ? "RECOVERY APPLIED" : "NO ACTIONS APPLIED"}</span>
      </div>
      <div className="comparison-columns recovery-comparison-columns">
        <div className="comparison-label"><span className="baseline-dot" /> OPERATIONAL METRIC <small>Engine result</small></div>
        <div className="comparison-label"><span className="recovery-dot" /> BASELINE</div>
        <div className="comparison-label"><span className="recovery-dot" /> RECOVERY</div>
        {metrics.map((metric) => <div className="comparison-row" key={metric.label}>
          <strong>{metric.label}</strong>
          <span>{baseline ? metric.value(baseline.summary) : "Run scenario"}</span>
          <span>{result ? metric.value(result.summary) : "Not calculated"}</span>
        </div>)}
      </div>
      <div className="comparison-foot"><span className="comparison-info">{result?.summary.passengerCountCaveat ?? "Passenger categories are not added into a unique total."}</span><span className="comparison-mark"><Sparkles size={13} /> ENGINE OUTPUT</span></div>
    </section>
  );
}
