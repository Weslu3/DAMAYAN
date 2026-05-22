"use client";
import { useDispatcher } from "../contexts/useDispatcher";
import { NavPage, MOCK_DISPATCHER } from "../data";
import { Icon, IconName } from "./ui/Icon";

export interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  newCount: number;
  activeCount: number;
  currentPage: NavPage;
  onPageChange: (page: NavPage) => void;
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
  newCount,
  activeCount,
  currentPage,
  onPageChange,
}: SidebarProps) {
  const { currentUser, status } = useDispatcher();

  const user = currentUser || { name: MOCK_DISPATCHER.name, initials: MOCK_DISPATCHER.initials, cluster: MOCK_DISPATCHER.cluster };

  const NAV: { id: NavPage; icon: IconName; label: string; badge?: number }[] = [
    { id: "dashboard", icon: "dashboard", label: "Dashboard" },
    { id: "resource-map", icon: "map", label: "Resource Map", badge: newCount || undefined },
    { id: "rescue-monitoring", icon: "activity", label: "Rescue Monitoring", badge: activeCount || undefined },
    { id: "incidents", icon: "ticket", label: "Incidents" },
    { id: "resources", icon: "users", label: "Resources" },
  ];

  return (
    <aside className={`dp-sidebar${collapsed ? " collapsed" : ""}`}>
      <button
        className="dp-sidebar-toggle"
        onClick={onToggleCollapse}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? "›" : "‹"}
      </button>

      <div className="dp-sidebar-top">
        <div className="dp-sidebar-brand">
          <div className="dp-sidebar-brand-mark">D</div>
          <div>
            <div className="dp-sidebar-brand-name">Damayan</div>
            <div className="dp-sidebar-brand-role">Dispatcher</div>
          </div>
        </div>

        <div className="dp-status-pill">
          <div className="dp-status-row">
            <span className={`dp-status-dot ${status}`} />
            <span className={status === "active" ? "dp-status-active" : "dp-status-inactive"}>
              {status === "active" ? "Active / On Duty" : "Inactive"}
            </span>
          </div>
          <div className="dp-status-cluster">{user.cluster}</div>
        </div>
      </div>

      <nav className="dp-sidebar-nav">
        {NAV.map((item) => (
          <button
            key={item.id}
            data-label={item.label}
            className={`dp-nav-item ${currentPage === item.id ? "active" : ""}`}
            onClick={() => onPageChange(item.id)}
          >
            <span className="dp-nav-icon">
              <Icon name={item.icon} size={18} />
            </span>
            {item.label}
            {item.badge != null && item.badge > 0 && (
              <span className="dp-nav-badge">{item.badge}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="dp-sidebar-footer">
        <button
          data-label="My Profile"
          className={`dp-nav-item profile-item ${currentPage === "profile" ? "active" : ""}`}
          onClick={() => onPageChange("profile")}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "linear-gradient(135deg,var(--d-primary),var(--d-primary-deep))",
              display: "grid",
              placeItems: "center",
              fontSize: "0.65rem",
              fontWeight: 900,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            {user.initials}
          </div>
          My Profile
        </button>
      </div>
    </aside>
  );
}
