"use client";
import { useClock } from "../hooks/useClock";
import { useDispatcher } from "../contexts/useDispatcher";
import { Icon } from "./ui/Icon";

export interface TopbarProps {
  onBroadcast: () => void;
  onLogout: () => void;
}

export function Topbar({ onBroadcast, onLogout }: TopbarProps) {
  const clock = useClock();
  const { status, currentUser, connectionStatus } = useDispatcher();

  const statusDisplay = status === "active" ? "● Active Response" : "○ Inactive / Off Duty";
  const clusterName = currentUser?.cluster || "Metro Cluster 3";

  return (
    <header className="dp-topbar">
      <div className="dp-topbar-left">
        <span className={`dp-phase-badge ${status === "active" ? "active" : "inactive"}`}>
          {statusDisplay}
        </span>
        <span className="dp-topbar-title">
          Sampaloc Command Center — {clusterName}
        </span>
        {connectionStatus === "offline" && (
          <span className="dp-connection-status offline">● Offline</span>
        )}
        {connectionStatus === "syncing" && (
          <span className="dp-connection-status syncing">⟳ Syncing...</span>
        )}
      </div>

      <div className="dp-topbar-right">
        <span className="dp-clock">{clock}</span>
        <button
          className="dp-broadcast-btn"
          disabled={status === "inactive"}
          style={status === "inactive" ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
          onClick={onBroadcast}
        >
          <Icon name="megaphone" size={16} />
          <span>Broadcast</span>
        </button>
        <button
          className="dp-logout-btn"
          onClick={onLogout}
          title="Sign out"
        >
          <Icon name="logout" size={18} />
        </button>
      </div>
    </header>
  );
}
