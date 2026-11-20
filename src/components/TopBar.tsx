import { Bell, Menu, Search } from "lucide-react";

type TopBarProps = {
  onMenu: () => void;
};

export function TopBar({ onMenu }: TopBarProps) {
  return (
    <header className="topbar">
      <button className="icon-button mobile-menu" onClick={onMenu} aria-label="Open navigation"><Menu size={20} /></button>
      <div className="topbar-page">
        <span className="topbar-kicker">OPERATIONS CONTROL</span>
        <strong>Network overview</strong>
      </div>
      <div className="topbar-actions">
        <div className="date-chip"><span>OPERATING DATE</span><strong>20 Nov 2026</strong><i /> IST</div>
        <button className="topbar-icon search-button" aria-label="Search"><Search size={17} /></button>
        <button className="topbar-icon notification-button" aria-label="Notifications"><Bell size={17} /></button>
        <div className="network-chip"><span className="network-dot" /> Dataset loaded</div>
      </div>
    </header>
  );
}
