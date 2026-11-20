import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowUpRight, Plane, RadioTower, Users } from "lucide-react";
import { Sidebar, type SectionId } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { StatCard } from "./components/StatCard";
import { ClosureSimulator } from "./components/ClosureSimulator";
import { FlightNetwork } from "./components/FlightNetwork";
import { DisruptionTable } from "./components/DisruptionTable";
import { AircraftRotation, ConnectionPanel, CrewDutyPanel, DispatcherPanel, RecoveryComparison } from "./components/OperationsPanels";
import { RecoveryCenter } from "./components/RecoveryCenter";
import { ScenarioComparison } from "./components/ScenarioComparison";
import { ReportExport } from "./components/ReportExport";
import { actualNetwork } from "./data/network";
import type { ClosureScenario, DispatcherResponse, RecoveryAction, SimulationResult } from "./simulation/contract";
import { getApiHealth, postJson } from "./services/api";

function App() {
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scenario, setScenario] = useState<ClosureScenario>({ airportId: "BOM", startTime: "10:30", durationMinutes: 90 });
  const [scenarioApplied, setScenarioApplied] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [baselineResult, setBaselineResult] = useState<SimulationResult | null>(null);
  const [recoveryActions, setRecoveryActions] = useState<RecoveryAction[]>([]);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [dispatcherLoading, setDispatcherLoading] = useState(false);
  const [dispatcherResponse, setDispatcherResponse] = useState<DispatcherResponse | null>(null);
  const [dispatcherError, setDispatcherError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getApiHealth().then((health) => {
      if (!active) return;
      setApiAvailable(health.status === "ok");
      setAiConfigured(health.aiConfigured);
    }).catch(() => {
      if (!active) return;
      setApiAvailable(false);
      setAiConfigured(false);
    });
    return () => { active = false; };
  }, []);

  const stats = useMemo(() => [
    { label: "SCHEDULED FLIGHT LEGS", value: String(actualNetwork.flights.length), detail: "Supplied network dataset", icon: Plane, tone: "blue" as const },
    { label: "AIRPORTS IN NETWORK", value: String(actualNetwork.airports.length), detail: "Across the domestic network", icon: RadioTower, tone: "green" as const },
    { label: "CREW ROSTERS", value: String(actualNetwork.crews.length), detail: "Duty limits included", icon: Users, tone: "violet" as const },
    { label: "CONNECTION LINKS", value: String(actualNetwork.connections.length), detail: "Minimum connect times included", icon: Activity, tone: "orange" as const },
  ], []);

  const navigate = (section: SectionId) => {
    setActiveSection(section);
    setSidebarOpen(false);
    if (section !== "overview") document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateScenario = (changes: Partial<ClosureScenario>) => {
    setScenario((current) => ({ ...current, ...changes }));
    setScenarioApplied(false);
    setSimulationResult(null);
    setBaselineResult(null);
    setRecoveryActions([]);
    setSimulationError(null);
    setDispatcherResponse(null);
  };

  const runBaseScenario = async () => {
    setSimulationLoading(true);
    setSimulationError(null);
    setDispatcherError(null);
    setDispatcherResponse(null);
    try {
      const result = await postJson<SimulationResult>("/api/simulations", { ...scenario, actions: [] });
      setApiAvailable(true);
      setBaselineResult(result);
      setSimulationResult(result);
      setRecoveryActions([]);
      setScenarioApplied(true);
    } catch (reason) {
      setSimulationError(reason instanceof Error ? reason.message : "Simulation failed.");
    } finally {
      setSimulationLoading(false);
    }
  };

  const runRecovery = async () => {
    if (recoveryActions.length === 0) return;
    setSimulationLoading(true);
    setSimulationError(null);
    setDispatcherError(null);
    try {
      const baseline = baselineResult ?? await postJson<SimulationResult>("/api/simulations/reset", scenario);
      const recovered = await postJson<SimulationResult>("/api/recovery", { ...scenario, actions: recoveryActions });
      setApiAvailable(true);
      setBaselineResult(baseline);
      setSimulationResult(recovered);
      setScenarioApplied(true);
    } catch (reason) {
      setSimulationError(reason instanceof Error ? reason.message : "Recovery simulation failed.");
    } finally {
      setSimulationLoading(false);
    }
  };

  const resetScenario = async () => {
    const initialScenario: ClosureScenario = { airportId: "BOM", startTime: "10:30", durationMinutes: 90 };
    setScenario(initialScenario);
    setRecoveryActions([]);
    setSimulationResult(null);
    setBaselineResult(null);
    setScenarioApplied(false);
    setSimulationError(null);
    setDispatcherResponse(null);
    setSimulationLoading(true);
    try {
      const result = await postJson<SimulationResult>("/api/simulations/reset", initialScenario);
      setApiAvailable(true);
      setBaselineResult(result);
      setSimulationResult(result);
      setScenarioApplied(true);
    } catch (reason) {
      setSimulationError(reason instanceof Error ? reason.message : "Unable to reset simulation.");
    } finally {
      setSimulationLoading(false);
    }
  };

  const analyzeCurrentResult = async () => {
    if (!simulationResult) {
      setDispatcherError("Run a deterministic simulation before requesting AI analysis.");
      return;
    }
    setDispatcherLoading(true);
    setDispatcherError(null);
    try {
      const response = await postJson<DispatcherResponse>("/api/dispatcher/analyze", {
        ...scenario,
        actions: simulationResult.actions,
      });
      setApiAvailable(true);
      setDispatcherResponse(response);
    } catch (reason) {
      setDispatcherError(reason instanceof Error ? reason.message : "Dispatcher analysis failed.");
    } finally {
      setDispatcherLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar activeSection={activeSection} onNavigate={navigate} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-area">
        <TopBar apiAvailable={apiAvailable} onMenu={() => setSidebarOpen(true)} />
        <div className="dashboard-content" id="overview">
          <div className="page-heading">
            <div>
              <div className="page-eyebrow"><span className="eyebrow-line" /> OPERATIONS CONTROL <span className="live-status"><i /> DATASET LOADED</span></div>
              <h1>Network operations</h1>
              <p>Monitor scheduled services and configure an airport disruption scenario.</p>
            </div>
            <div className="heading-context"><span className="context-label">OPERATING NETWORK</span><strong>India · Domestic</strong></div>
          </div>

          <div className="stats-grid">
            {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
          </div>
          <div className="dataset-notice"><span className="dataset-check">✓</span><span><strong>Supplied flight network loaded</strong><small>Scheduled figures come directly from flight_network.json. Scenario forecasts are calculated by the deterministic engine.</small></span><span className="dataset-tag">DATASET</span></div>

          <div className="primary-grid">
            <FlightNetwork airports={actualNetwork.airports} flights={actualNetwork.flights} selectedAirport={scenario.airportId} />
            <div className="scenario-column">
              <ClosureSimulator
                airports={actualNetwork.airports}
                scenario={scenario}
                applied={scenarioApplied}
                loading={simulationLoading}
                onScenarioChange={updateScenario}
                onApply={runBaseScenario}
                onReset={resetScenario}
              />
              <DispatcherPanel
                aiConfigured={aiConfigured}
                loading={dispatcherLoading}
                response={dispatcherResponse}
                error={dispatcherError}
                onAnalyze={analyzeCurrentResult}
              />
              {apiAvailable === false && <div className="backend-unavailable" role="status">Simulation API is offline. Start it with <code>npm run dev:server</code>.</div>}
            </div>
          </div>

          {simulationError && recoveryActions.length === 0 && <div className="inline-error page-error" role="alert">{simulationError}</div>}
          <DisruptionTable flights={actualNetwork.flights} selectedAirport={scenario.airportId} result={simulationResult} />

          <RecoveryCenter
            flights={actualNetwork.flights}
            connections={actualNetwork.connections}
            aircraft={[...new Set(actualNetwork.flights.map((flight) => flight.tail_id))]}
            spareAircraft={actualNetwork.spare_aircraft.map((aircraft) => aircraft.tail_id)}
            actions={recoveryActions}
            loading={simulationLoading}
            error={simulationError}
            onAdd={(action) => { setRecoveryActions((current) => [...current, action]); setSimulationResult(baselineResult); setSimulationError(null); setDispatcherResponse(null); }}
            onRemove={(index) => { setRecoveryActions((current) => current.filter((_, actionIndex) => actionIndex !== index)); setSimulationResult(baselineResult); setSimulationError(null); setDispatcherResponse(null); }}
            onClear={() => { setRecoveryActions([]); setSimulationResult(baselineResult); setSimulationError(null); setDispatcherResponse(null); }}
            onRun={runRecovery}
          />

          <div className="operations-grid">
            <AircraftRotation flights={actualNetwork.flights} spareAircraft={actualNetwork.spare_aircraft} selectedAirport={scenario.airportId} result={simulationResult} />
            <ConnectionPanel connections={actualNetwork.connections} result={simulationResult} />
          </div>

          <div className="bottom-grid">
            <CrewDutyPanel crews={actualNetwork.crews} result={simulationResult} />
            <RecoveryComparison baseline={baselineResult} result={simulationResult} />
          </div>
          <ScenarioComparison scenario={scenario} />
          <ReportExport scenario={scenario} actions={simulationResult?.actions ?? []} />

          <footer className="dashboard-footer">
            <span>DOMINO SKY <span>·</span> AIRLINE OPERATIONS SIMULATOR</span>
            <span>DETERMINISTIC ENGINE <i /> API STATUS REPORTED ABOVE</span>
            <span>All times local · IST (UTC+05:30)</span>
            <a className="contact-link" href="https://github.com/AA3110-808/domino-sky/issues/new" target="_blank" rel="noreferrer">Contact the developers <ArrowUpRight size={13} /></a>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;
