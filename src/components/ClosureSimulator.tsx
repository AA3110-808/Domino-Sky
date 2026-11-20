import { useState } from "react";
import { AlertTriangle, ArrowRight, Clock3, MapPin, RotateCcw } from "lucide-react";
import type { Airport } from "../data/network";
import type { ClosureScenario } from "../simulation/contract";

type ClosureSimulatorProps = {
  airports: Airport[];
  scenario: ClosureScenario;
  applied: boolean;
  onScenarioChange: (scenario: Partial<ClosureScenario>) => void;
  onApply: () => void;
};

export function ClosureSimulator({
  airports,
  scenario,
  applied,
  onScenarioChange,
  onApply,
}: ClosureSimulatorProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <section className="panel closure-panel" aria-labelledby="closure-title">
      <div className="panel-heading closure-heading">
        <div className="panel-title-group">
          <div className="panel-icon warning-icon"><AlertTriangle size={17} /></div>
          <div><h2 id="closure-title">Airport closure scenario</h2><p>Configure a disruption to explore network impact</p></div>
        </div>
        <div className="preview-pill"><span /> SIMULATION PREVIEW</div>
      </div>
      {expanded && (
        <>
          <div className="closure-controls">
            <label className="field airport-field">
              <span><MapPin size={13} /> AIRPORT</span>
              <select value={scenario.airportId} onChange={(event) => onScenarioChange({ airportId: event.target.value })}>
                {airports.map((airport) => <option key={airport.id} value={airport.id}>{airport.id} · {airport.city}</option>)}
              </select>
            </label>
            <label className="field">
              <span><Clock3 size={13} /> CLOSURE START</span>
              <input type="time" value={scenario.startTime} onChange={(event) => onScenarioChange({ startTime: event.target.value })} />
            </label>
            <label className="field duration-field">
              <span><Clock3 size={13} /> DURATION</span>
              <select value={scenario.durationMinutes} onChange={(event) => onScenarioChange({ durationMinutes: Number(event.target.value) })}>
                {[30, 60, 90, 120, 180].map((minutes) => <option key={minutes} value={minutes}>{minutes < 60 ? `${minutes} min` : `${minutes / 60} hr${minutes > 60 ? "s" : ""}`}</option>)}
              </select>
            </label>
            <button className="apply-button" onClick={onApply}>{applied ? "Inputs captured" : "Apply scenario"} <ArrowRight size={15} /></button>
          </div>
          <div className="closure-foot">
            <span className="closure-note"><span className="note-dot" /> Inputs are for UI development; recovery calculations are not connected.</span>
            <button className="reset-button" onClick={() => onScenarioChange({ airportId: "BOM", startTime: "10:30", durationMinutes: 90 })}><RotateCcw size={12} /> Reset</button>
          </div>
          {applied && <div className="scenario-feedback" role="status">Scenario inputs captured. No delay, passenger, or recovery results have been calculated.</div>}
        </>
      )}
      {!expanded && <button className="expand-scenario" onClick={() => setExpanded(true)}>Show scenario controls <ArrowRight size={14} /></button>}
      <button className="collapse-scenario" onClick={() => setExpanded(!expanded)} aria-label={expanded ? "Collapse scenario controls" : "Expand scenario controls"}>{expanded ? "−" : "+"}</button>
    </section>
  );
}
