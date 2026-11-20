import {
  Activity,
  Plane,
  Radio,
  Route,
  Users,
  Gauge,
  FileText,
  Settings,
  Mail,
  X,
} from "lucide-react";

export type SectionId = "overview" | "network" | "rotations" | "connections" | "crew" | "recovery";

type SidebarProps = {
  activeSection: SectionId;
  onNavigate: (section: SectionId) => void;
  open: boolean;
  onClose: () => void;
};

const navigation: { id: SectionId; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "network", label: "Flight network", icon: Route },
  { id: "rotations", label: "Aircraft rotations", icon: Plane },
  { id: "connections", label: "Connections", icon: Users },
  { id: "crew", label: "Crew duty", icon: Activity },
  { id: "recovery", label: "Recovery plans", icon: FileText },
];

export function Sidebar({ activeSection, onNavigate, open, onClose }: SidebarProps) {
  return (
    <>
      <button className={`sidebar-scrim ${open ? "visible" : ""}`} onClick={onClose} aria-label="Close navigation" />
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Plane size={19} strokeWidth={2.2} /></div>
          <div className="brand-copy">
            <span className="brand-name">DOMINO SKY</span>
            <span className="brand-subtitle">AIRLINE OPERATIONS</span>
          </div>
          <button className="icon-button sidebar-close" onClick={onClose} aria-label="Close navigation"><X size={18} /></button>
        </div>

        <div className="workspace-label">WORKSPACE</div>
        <div className="workspace-switch">
          <span className="workspace-avatar">DS</span>
          <span className="workspace-copy"><strong>India network</strong><small>Operations · IST</small></span>
          <span className="switch-chevron">⌄</span>
        </div>

        <div className="nav-label">OPERATIONS</div>
        <nav className="nav-list" aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${activeSection === id ? "active" : ""}`} onClick={() => onNavigate(id)}>
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
              {id === "overview" && <span className="nav-live-dot" />}
            </button>
          ))}
        </nav>

        <div className="nav-label tools-label">TOOLS</div>
        <button className="nav-item" onClick={() => onNavigate("overview")}><Radio size={17} strokeWidth={1.8} /><span>Live operations</span><span className="live-tag">LIVE</span></button>
        <button className="nav-item" onClick={() => onNavigate("recovery")}><Settings size={17} strokeWidth={1.8} /><span>Scenario settings</span></button>

        <div className="sidebar-bottom">
          <div className="system-card">
            <div className="system-card-top"><span className="system-pulse" /> ALL SYSTEMS NORMAL</div>
            <p>Data feed connected</p>
            <span className="system-time">Last sync · 2 min ago</span>
          </div>
          <a className="nav-item help-link" href="mailto:?subject=DOMINO%20SKY%20developer%20contact"><Mail size={17} strokeWidth={1.8} /><span>Contact developers</span></a>
          <div className="profile">
            <div className="profile-avatar">AK</div>
            <div className="profile-copy"><strong>Alex Kim</strong><span>Network controller</span></div>
            <span className="profile-menu">···</span>
          </div>
        </div>
      </aside>
    </>
  );
}
