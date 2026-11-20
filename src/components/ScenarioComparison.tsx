import { useEffect, useState } from "react";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import type { ClosureScenario, SimulationSummary } from "../simulation/contract";

type SavedScenario = { id: string; label: string; scenario: ClosureScenario };
type CompareResponse = {
  scenarios: Array<{
    index: number;
    airportId: string;
    startTime: string;
    durationMinutes: number;
    summary: SimulationSummary;
  }>;
};

type ScenarioComparisonProps = { scenario: ClosureScenario };

function isSavedScenario(value: unknown): value is SavedScenario {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.label !== "string" || typeof item.scenario !== "object" || item.scenario === null) return false;
  const scenario = item.scenario as Record<string, unknown>;
  return typeof scenario.airportId === "string"
    && typeof scenario.startTime === "string"
    && typeof scenario.durationMinutes === "number";
}

export function ScenarioComparison({ scenario }: ScenarioComparisonProps) {
  const [saved, setSaved] = useState<SavedScenario[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [comparison, setComparison] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("domino-sky-scenarios");
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (!Array.isArray(parsed) || !parsed.every(isSavedScenario)) {
          throw new Error("Saved scenarios have an invalid format. Clear browser storage to continue.");
        }
        setSaved(parsed);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load saved scenarios.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem("domino-sky-scenarios", JSON.stringify(saved));
    } catch {
      setError("Scenarios are available for this session but could not be saved to browser storage.");
    }
  }, [loaded, saved]);

  const saveCurrent = () => {
    const label = `${scenario.airportId} · ${scenario.startTime} · ${scenario.durationMinutes} min closure`;
    setSaved((current) => [...current, { id: `${Date.now()}-${current.length}`, label, scenario: { ...scenario } }]);
    setComparison(null);
    setError(null);
  };

  const runComparison = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/simulations/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenarios: saved.map((item) => ({ ...item.scenario, actions: [] })) }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = typeof payload === "object" && payload !== null && "error" in payload ? String(payload.error) : "Scenario comparison failed.";
        throw new Error(message);
      }
      setComparison(payload as CompareResponse);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Scenario comparison failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel scenario-comparison">
      <div className="panel-heading compact-heading">
        <div className="panel-title-group">
          <div className="panel-icon map-icon"><ArrowRight size={15} /></div>
          <div><h2>Scenario comparison</h2><p>Save closure inputs and compare engine-generated network results.</p></div>
        </div>
        <button className="text-button" onClick={saveCurrent}><Plus size={13} /> Save current scenario</button>
      </div>
      {saved.length === 0 ? (
        <div className="empty-actions">No scenarios saved. Save the current airport, start time, and duration to begin a comparison.</div>
      ) : (
        <div className="saved-scenarios">
          {saved.map((item) => (
            <div className="saved-scenario" key={item.id}>
              <span className="scenario-saved-dot" />
              <span><strong>{item.label}</strong><small>Recovery actions are not included in scenario comparisons.</small></span>
              <button onClick={() => { setSaved((current) => current.filter((entry) => entry.id !== item.id)); setComparison(null); }} aria-label={`Remove ${item.label}`}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}
      {saved.length >= 2 && <button className="apply-button compare-button" onClick={runComparison} disabled={loading}>{loading ? "Comparing…" : "Compare saved scenarios"} <ArrowRight size={14} /></button>}
      {error && <div className="inline-error" role="alert">{error}</div>}
      {comparison && (
        <div className="table-scroll comparison-table">
          <table>
            <thead><tr><th>SCENARIO</th><th>DELAYED</th><th>CANCELLED</th><th>ARRIVAL DELAY (MIN)</th><th>MISSED CONNECTIONS</th><th>CREW LIMITS</th></tr></thead>
            <tbody>{comparison.scenarios.map((item) => {
              const label = saved[item.index]?.label ?? `${item.airportId} · ${item.startTime}`;
              return <tr key={`${item.index}-${item.airportId}`}><td>{label}</td><td>{item.summary.delayedFlights}</td><td>{item.summary.cancelledFlights}</td><td>{item.summary.totalArrivalDelayMinutes}</td><td>{item.summary.missedConnections}</td><td>{item.summary.crewDutyViolations}</td></tr>;
            })}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
