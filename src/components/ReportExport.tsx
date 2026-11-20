import { useState } from "react";
import { Download, FileText } from "lucide-react";
import type { ClosureScenario, RecoveryAction } from "../simulation/contract";

type ReportType = "summary" | "flights" | "rotations" | "connections" | "crew";

type ReportExportProps = { scenario: ClosureScenario; actions: RecoveryAction[] };

export function ReportExport({ scenario, actions }: ReportExportProps) {
  const [report, setReport] = useState<ReportType>("summary");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...scenario, actions, report }),
      });
      if (!response.ok) {
        const payload: unknown = await response.json();
        const message = typeof payload === "object" && payload !== null && "error" in payload ? String(payload.error) : "Report export failed.";
        throw new Error(message);
      }
      const csv = await response.blob();
      const url = URL.createObjectURL(csv);
      const link = document.createElement("a");
      link.href = url;
      link.download = `domino-sky-${report}-report.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Report export failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel report-export">
      <div className="panel-heading compact-heading">
        <div className="panel-title-group">
          <div className="panel-icon flight-icon"><FileText size={15} /></div>
          <div><h2>Operational reports</h2><p>Export CSV generated from a fresh deterministic run.</p></div>
        </div>
      </div>
      <div className="report-controls">
        <label className="field"><span>REPORT</span><select value={report} onChange={(event) => setReport(event.target.value as ReportType)}>
          <option value="summary">Simulation summary</option>
          <option value="flights">Flight delay report</option>
          <option value="rotations">Aircraft rotation report</option>
          <option value="connections">Passenger connections report</option>
          <option value="crew">Crew duty report</option>
        </select></label>
        <button className="text-button report-button" onClick={exportReport} disabled={loading}>{loading ? "Preparing…" : "Export CSV"} <Download size={14} /></button>
      </div>
      {error && <div className="inline-error" role="alert">{error}</div>}
    </section>
  );
}
