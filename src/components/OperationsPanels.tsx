import { ArrowRight, Clock3, GitBranch, ShieldAlert, Sparkles, Users, WandSparkles } from "lucide-react";
import type { Connection, Crew, Flight } from "../data/network";

type AircraftRotationProps = { flights: Flight[]; selectedAirport: string };

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

export function AircraftRotation({ flights, selectedAirport }: AircraftRotationProps) {
  const rows = flights.filter((flight) => ["VT-DS02", "VT-DS04", "VT-DS07", "VT-DS12"].includes(flight.tail_id));
  const tails = [...new Set(rows.map((flight) => flight.tail_id))];
  return (
    <section className="panel rotation-panel" id="rotations">
      <div className="panel-heading compact-heading">
        <div className="panel-title-group"><div className="panel-icon rotation-icon"><GitBranch size={16} /></div><div><h2>Aircraft rotation</h2><p>Schedule from network dataset · 24h local</p></div></div>
        <button className="small-icon-button" aria-label="More rotation options">···</button>
      </div>
      <div className="timeline">
        <div className="timeline-hours"><span className="tail-heading">TAIL</span>{timelineLabels.map((hour) => <span key={hour} style={{ left: `${((hour - HOUR_START) / (HOUR_END - HOUR_START)) * 100}%` }}>{String(hour).padStart(2, "0")}:00</span>)}</div>
        {tails.map((tail) => (
          <div className="timeline-row" key={tail}>
            <div className="tail-label">{tail.replace("VT-", "")}</div>
            <div className="timeline-track">
              {rows.filter((flight) => flight.tail_id === tail).map((flight) => {
                const left = ((minutes(flight.dep) - HOUR_START * 60) / ((HOUR_END - HOUR_START) * 60)) * 100;
                const width = (duration(flight.dep, flight.arr) / ((HOUR_END - HOUR_START) * 60)) * 100;
                const scenarioLeg = flight.origin === selectedAirport || flight.destination === selectedAirport;
                return <div key={flight.flight_id} title={`${flight.flight_id} · ${flight.origin} to ${flight.destination} · ${flight.dep}–${flight.arr}`} className={`rotation-leg ${scenarioLeg ? "rotation-focus" : ""}`} style={{ left: `${left}%`, width: `${width}%` }}><span>{flight.flight_id}</span></div>;
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="rotation-footer"><span><i className="legend-flight" /> Scheduled leg</span><span><i className="legend-focus" /> Scenario airport leg</span><span className="schedule-only">Schedule view only · not recovered</span></div>
    </section>
  );
}

type ConnectionPanelProps = { connections: Connection[] };

export function ConnectionPanel({ connections }: ConnectionPanelProps) {
  return (
    <section className="panel connection-panel" id="connections">
      <div className="panel-heading compact-heading">
        <div className="panel-title-group"><div className="panel-icon connection-icon"><Users size={16} /></div><div><h2>Passenger connections</h2><p>Connection feed · assessment pending</p></div></div>
        <span className="quiet-count">{connections.length} links</span>
      </div>
      <div className="connection-list">
        {connections.slice(0, 3).map((connection) => (
          <div className="connection-row" key={connection.connection_id}>
            <div className="connection-airport">{connection.airport}</div>
            <div className="connection-detail"><strong>{connection.from_flight}<span>→</span>{connection.to_flight}</strong><small>{connection.min_connect_minutes} min minimum connection</small></div>
            <div className="connection-pax"><strong>{connection.passengers}</strong><small>pax</small></div>
            <span className="status-pending">Pending</span>
          </div>
        ))}
      </div>
      <div className="connection-note"><Clock3 size={13} /> Passenger impacts require deterministic connection analysis.</div>
    </section>
  );
}

type CrewPanelProps = { crews: Crew[] };

export function CrewDutyPanel({ crews }: CrewPanelProps) {
  return (
    <section className="panel crew-panel" id="crew">
      <div className="panel-heading compact-heading">
        <div className="panel-title-group"><div className="panel-icon crew-icon"><ShieldAlert size={16} /></div><div><h2>Crew duty watch</h2><p>Roster data · risk assessment pending</p></div></div>
        <span className="crew-dataset-count">{crews.length} crews</span>
      </div>
      <div className="crew-list">
        {crews.slice(0, 3).map((crew) => (
          <div className="crew-row" key={crew.crew_id}>
            <div className="crew-avatar">{crew.crew_id.slice(-2)}</div>
            <div className="crew-details"><strong>{crew.crew_id}<span> · {crew.base} base</span></strong><small>Duty starts {crew.duty_start} · Max {crew.max_duty_mins / 60}h</small></div>
            <span className="crew-unassessed">Not assessed</span>
          </div>
        ))}
      </div>
      <div className="crew-footnote"><span className="risk-outline"><ShieldAlert size={12} /> DUTY LIMITS IN DATASET</span><span>Risk needs engine output</span></div>
    </section>
  );
}

export function DispatcherPanel() {
  return (
    <section className="panel dispatcher-panel">
      <div className="dispatcher-head">
        <div className="ai-orb"><Sparkles size={16} /></div>
        <div><span className="ai-eyebrow">DISPATCH INTELLIGENCE</span><h2>AI Dispatcher</h2></div>
        <span className="advisory-tag">ADVISORY ONLY</span>
      </div>
      <div className="dispatcher-message">
        <div className="ai-message-icon"><WandSparkles size={16} /></div>
        <div><strong>Ready when your engine is.</strong><p>Once deterministic recovery results are available, I can help explain them. I never calculate or invent operational figures.</p></div>
      </div>
      <button className="dispatcher-button" disabled>Awaiting verified simulation output <ArrowRight size={14} /></button>
      <div className="ai-footer"><span className="ai-lock" /> AI explanations only · verified data required</div>
    </section>
  );
}

export function RecoveryComparison() {
  return (
    <section className="panel recovery-panel" id="recovery">
      <div className="panel-heading compact-heading recovery-heading">
        <div className="panel-title-group"><div className="panel-icon recovery-icon"><GitBranch size={16} /></div><div><h2>Before & after recovery</h2><p>Baseline vs recovery plan · results not yet available</p></div></div>
        <span className="comparison-preview-tag">ENGINE NOT CONNECTED</span>
      </div>
      <div className="comparison-columns">
        <div className="comparison-column baseline-column"><div className="comparison-label"><span className="baseline-dot" /> BASELINE <small>Supplied schedule</small></div><div className="comparison-placeholder">Dataset timings available</div><div className="comparison-placeholder">Passenger links available</div><div className="comparison-placeholder">Crew roster available</div></div>
        <div className="comparison-arrow"><ArrowRight size={15} /></div>
        <div className="comparison-column recovery-column"><div className="comparison-label"><span className="recovery-dot" /> RECOVERY <small>Engine output</small></div><div className="comparison-placeholder unavailable">Not calculated</div><div className="comparison-placeholder unavailable">Not calculated</div><div className="comparison-placeholder unavailable">Not calculated</div></div>
      </div>
      <div className="comparison-foot"><span className="comparison-info">No recovery values are generated by this interface.</span><span className="comparison-mark"><Sparkles size={13} /> DOMINO SKY</span></div>
    </section>
  );
}
