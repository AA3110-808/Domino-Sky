import { useState } from "react";
import { ArrowRight, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { Connection, Flight } from "../data/network";
import type { RecoveryAction } from "../simulation/contract";

type RecoveryCenterProps = {
  flights: Flight[];
  connections: Connection[];
  aircraft: string[];
  spareAircraft: string[];
  actions: RecoveryAction[];
  loading: boolean;
  error: string | null;
  onAdd: (action: RecoveryAction) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
  onRun: () => void;
};

type ActionType = RecoveryAction["type"];

function describeAction(action: RecoveryAction) {
  switch (action.type) {
    case "cancel-flight":
      return `Cancel ${action.flightId}`;
    case "reschedule-departure":
      return `Reschedule ${action.flightId} to ${action.newDeparture}`;
    case "hold-connection":
      return `Hold ${action.connectionId} by ${action.holdMinutes} min`;
    case "substitute-spare":
      return `Substitute ${action.flightId} with ${action.spareTailId}`;
    case "reassign-aircraft":
      return `Reassign ${action.flightId} to ${action.toTailId}`;
  }
}

export function RecoveryCenter({
  flights,
  connections,
  aircraft,
  spareAircraft,
  actions,
  loading,
  error,
  onAdd,
  onRemove,
  onClear,
  onRun,
}: RecoveryCenterProps) {
  const [actionType, setActionType] = useState<ActionType>("cancel-flight");
  const [flightId, setFlightId] = useState(flights[0]?.flight_id ?? "");
  const [connectionId, setConnectionId] = useState(connections[0]?.connection_id ?? "");
  const [targetTailId, setTargetTailId] = useState(aircraft[0] ?? "");
  const [time, setTime] = useState("12:00");
  const [holdMinutes, setHoldMinutes] = useState(15);
  const [open, setOpen] = useState(false);
  const aircraftOptions = actionType === "substitute-spare" ? spareAircraft : aircraft;

  const addAction = () => {
    switch (actionType) {
      case "cancel-flight":
        onAdd({ type: "cancel-flight", flightId });
        break;
      case "reschedule-departure":
        onAdd({ type: "reschedule-departure", flightId, newDeparture: time });
        break;
      case "hold-connection":
        onAdd({ type: "hold-connection", connectionId, holdMinutes });
        break;
      case "substitute-spare":
        onAdd({ type: "substitute-spare", flightId, spareTailId: targetTailId });
        break;
      case "reassign-aircraft":
        onAdd({ type: "reassign-aircraft", flightId, toTailId: targetTailId });
        break;
    }
  };

  return (
    <section className="panel recovery-center" id="recovery">
      <div className="panel-heading compact-heading">
        <div className="panel-title-group">
          <div className="panel-icon recovery-icon"><RotateCcw size={15} /></div>
          <div><h2>Recovery centre</h2><p>Queue actions, then validate them against the complete network.</p></div>
        </div>
        <button className="text-button" onClick={() => setOpen(!open)}>{open ? "Close editor" : "Add action"} <Plus size={13} /></button>
      </div>

      {open && (
        <div className="recovery-editor">
          <label className="field">
            <span>RECOVERY ACTION</span>
            <select value={actionType} onChange={(event) => {
              const nextType = event.target.value as ActionType;
              setActionType(nextType);
              if (nextType === "substitute-spare") setTargetTailId(spareAircraft[0] ?? "");
              else if (nextType === "reassign-aircraft") setTargetTailId(aircraft[0] ?? "");
            }}>
              <option value="cancel-flight">Cancel flight</option>
              <option value="reschedule-departure">Reschedule departure</option>
              <option value="hold-connection">Protect connection with a hold</option>
              <option value="substitute-spare">Substitute spare aircraft</option>
              <option value="reassign-aircraft">Reassign aircraft</option>
            </select>
          </label>
          {actionType === "hold-connection" ? (
            <label className="field">
              <span>CONNECTION</span>
              <select value={connectionId} onChange={(event) => setConnectionId(event.target.value)}>
                {connections.map((connection) => <option key={connection.connection_id} value={connection.connection_id}>{connection.connection_id} · {connection.from_flight} → {connection.to_flight}</option>)}
              </select>
            </label>
          ) : (
            <label className="field">
              <span>FLIGHT</span>
              <select value={flightId} onChange={(event) => setFlightId(event.target.value)}>
                {flights.map((flight) => <option key={flight.flight_id} value={flight.flight_id}>{flight.flight_id} · {flight.origin}–{flight.destination}</option>)}
              </select>
            </label>
          )}
          {actionType === "reschedule-departure" && <label className="field"><span>NEW DEPARTURE</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>}
          {actionType === "hold-connection" && <label className="field"><span>HOLD (MINUTES)</span><input type="number" min={1} max={360} step={1} value={holdMinutes} onChange={(event) => setHoldMinutes(Number(event.target.value))} /></label>}
          {(actionType === "substitute-spare" || actionType === "reassign-aircraft") && (
            <label className="field">
              <span>{actionType === "substitute-spare" ? "SPARE AIRCRAFT" : "TARGET AIRCRAFT"}</span>
              <select value={targetTailId} onChange={(event) => setTargetTailId(event.target.value)}>
                {aircraftOptions.map((tailId) => <option key={tailId} value={tailId}>{tailId}</option>)}
              </select>
            </label>
          )}
          <button className="add-recovery-button" onClick={addAction} disabled={!flightId && actionType !== "hold-connection" || (actionType === "hold-connection" && !connectionId)}>
            Add to action history <Plus size={13} />
          </button>
        </div>
      )}

      {actions.length ? (
        <ol className="recovery-action-list">
          {actions.map((action, index) => (
            <li key={`${action.type}-${index}`}>
              <span className="action-number">{String(index + 1).padStart(2, "0")}</span>
              <span>{describeAction(action)}</span>
              <button onClick={() => onRemove(index)} aria-label={`Remove ${describeAction(action)}`}><Trash2 size={13} /></button>
            </li>
          ))}
        </ol>
      ) : <div className="empty-actions">No recovery actions queued. Add one to test its network-wide feasibility.</div>}

      {error && <div className="inline-error" role="alert">{error}</div>}
      <div className="recovery-actions">
        <button className="reset-button" onClick={onClear} disabled={loading || actions.length === 0}><RotateCcw size={12} /> Clear actions</button>
        <button className="apply-button" onClick={onRun} disabled={loading || actions.length === 0}>{loading ? "Validating…" : "Validate & apply"} <ArrowRight size={14} /></button>
      </div>
    </section>
  );
}
