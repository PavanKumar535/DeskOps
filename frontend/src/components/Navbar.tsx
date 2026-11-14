import React from "react";
import type { User, HealthStatus } from "../api";

interface NavbarProps {
  user: User | null;
  health: HealthStatus;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, health, onLogout }) => {
  return (
    <header className="navbar">
      <div className="navbar-brand">
        <div className="brand-logo">DO</div>
        <div>
          <h1 className="brand-title">DeskOps</h1>
          <span className="brand-subtitle">Multi-Tenant Service Desk</span>
        </div>
      </div>

      <div className="navbar-actions">
        <div className="health-badge">
          <span className={`status-dot ${health.api && health.db ? "online" : "offline"}`} />
          <span>{health.api && health.db ? "All Systems Operational" : "Degraded Service"}</span>
        </div>

        {user && (
          <div className="user-profile">
            <div className="user-meta">
              <span className="user-name">{user.name}</span>
              <span className="user-org">{user.organisation.name}</span>
            </div>
            <span className="role-tag">{user.role}</span>
            <button className="btn-logout" onClick={onLogout}>
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
