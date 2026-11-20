import { useMemo, useState } from "react";
import { Activity, ArrowUpRight, Plane, RadioTower, Users } from "lucide-react";
import { Sidebar, type SectionId } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { StatCard } from "./components/StatCard";
import { ClosureSimulator } from "./components/ClosureSimulator";
import { FlightNetwork } from "./components/FlightNetwork";
import { DisruptionTable } from "./components/DisruptionTable";
import { AircraftRotation, ConnectionPanel, CrewDutyPanel, DispatcherPanel, RecoveryComparison } from "./components/OperationsPanels";
import { actualNetwork } from "./data/network";
import type { ClosureScenario } from "./simulation/contract";

function App() {
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scenario, setScenario] = useState<ClosureScenario>({ airportId: "BOM", startTime: "10:30", durationMinutes: 90 });
  const [scenarioApplied, setScenarioApplied] = useState(false);

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
  };

  return (
    <div className="app-shell">
      <Sidebar activeSection={activeSection} onNavigate={navigate} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-area">
        <TopBar onMenu={() => setSidebarOpen(true)} />
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
          <div className="dataset-notice"><span className="dataset-check">✓</span><span><strong>Supplied flight network loaded</strong><small>Counts above come directly from flight_network.json. Disruption previews elsewhere are illustrative only.</small></span><span className="dataset-tag">DATASET</span></div>

          <div className="primary-grid">
            <FlightNetwork airports={actualNetwork.airports} flights={actualNetwork.flights} selectedAirport={scenario.airportId} />
            <div className="scenario-column">
              <ClosureSimulator
                airports={actualNetwork.airports}
                scenario={scenario}
                applied={scenarioApplied}
                onScenarioChange={updateScenario}
                onApply={() => setScenarioApplied(true)}
              />
              <DispatcherPanel />
            </div>
          </div>

          <DisruptionTable flights={actualNetwork.flights} selectedAirport={scenario.airportId} />

          <div className="operations-grid">
            <AircraftRotation flights={actualNetwork.flights} selectedAirport={scenario.airportId} />
            <ConnectionPanel connections={actualNetwork.connections} />
          </div>

          <div className="bottom-grid">
            <CrewDutyPanel crews={actualNetwork.crews} />
            <RecoveryComparison />
          </div>

          <footer className="dashboard-footer">
            <span>DOMINO SKY <span>·</span> AIRLINE OPERATIONS SIMULATOR</span>
            <span>UI DEVELOPMENT PREVIEW <i /> ENGINE PENDING</span>
            <span>All times local · IST (UTC+05:30)</span>
            <a className="contact-link" href="mailto:?subject=DOMINO%20SKY%20developer%20contact">Contact the developers <ArrowUpRight size={13} /></a>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;
