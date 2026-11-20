import { Menu } from "lucide-react";

type TopBarProps = {
  apiAvailable: boolean | null;
  onMenu: () => void;
};

export function TopBar({ apiAvailable, onMenu }: TopBarProps) {
  return (
    <header className="topbar">
      <button className="icon-button mobile-menu" onClick={onMenu} aria-label="Open navigation"><Menu size={20} /></button>
      <div className="topbar-page">
        <span className="topbar-kicker">OPERATIONS CONTROL</span>
        <strong>Network overview</strong>
      </div>
      <div className="topbar-actions">
        <div className="date-chip"><span>OPERATING DATE</span><strong>20 Nov 2026</strong><i /> IST</div>
        <div className={`network-chip ${apiAvailable === false ? "offline" : ""}`}><span className="network-dot" /> {apiAvailable === null ? "Connecting API" : apiAvailable ? "Simulation API online" : "Simulation API offline"}</div>
      </div>
    </header>
  );
}
