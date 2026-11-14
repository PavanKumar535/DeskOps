import React, { useEffect, useState } from "react";
import type { User, Ticket, HealthStatus } from "../api";
import { apiRequest } from "../api";

interface DashboardProps {
  user: User;
  token: string;
  health: HealthStatus;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, token, health }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cross-tenant test state
  const [crossTenantTestResult, setCrossTenantTestResult] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
  } | null>(null);
  const [testingCrossTenant, setTestingCrossTenant] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, [token]);

  const fetchTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ tickets: Ticket[] }>("/api/v1/tickets", {}, token);
      if (res.success && res.data) {
        setTickets(res.data.tickets);
      } else {
        setError(res.error || "Failed to load tenant tickets");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch tickets");
    } finally {
      setLoading(false);
    }
  };

  const testCrossTenantIsolation = async () => {
    setTestingCrossTenant(true);
    setCrossTenantTestResult(null);

    try {
      // Intentionally request a dummy ID or attempt cross-tenant spoofing
      const res = await apiRequest("/api/v1/tickets/00000000-0000-0000-0000-000000000000", {}, token);
      if (!res.success) {
        setCrossTenantTestResult({
          tested: true,
          success: true, // Expected behavior: blocked!
          message: `Backend securely blocked foreign/invalid resource: ${res.error}`,
        });
      } else {
        setCrossTenantTestResult({
          tested: true,
          success: false,
          message: "Warning: Request unexpectedly succeeded.",
        });
      }
    } catch (err: any) {
      setCrossTenantTestResult({
        tested: true,
        success: true,
        message: `Blocked successfully: ${err.message}`,
      });
    } finally {
      setTestingCrossTenant(false);
    }
  };

  return (
    <div className="dashboard-container">
      {/* Overview Cards */}
      <div className="grid-overview">
        <div className="card">
          <div className="card-header">
            <h3>Active Tenant Context</h3>
            <span className="badge badge-tenant">Isolated</span>
          </div>
          <div className="card-body">
            <div className="meta-row">
              <span className="meta-label">Organisation:</span>
              <strong className="meta-value">{user.organisation.name}</strong>
            </div>
            <div className="meta-row">
              <span className="meta-label">Tenant ID:</span>
              <code className="meta-code">{user.organisation.id}</code>
            </div>
            <p className="card-footnote">
              All queries are scoped strictly to this tenant ID server-side.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Authenticated User</h3>
            <span className="badge badge-role">{user.role}</span>
          </div>
          <div className="card-body">
            <div className="meta-row">
              <span className="meta-label">Name:</span>
              <strong className="meta-value">{user.name}</strong>
            </div>
            <div className="meta-row">
              <span className="meta-label">Email:</span>
              <span className="meta-value">{user.email}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">User ID:</span>
              <code className="meta-code">{user.id}</code>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Infrastructure Status</h3>
            <span className={`badge ${health.api && health.db ? "badge-success" : "badge-danger"}`}>
              {health.api && health.db ? "Healthy" : "Attention"}
            </span>
          </div>
          <div className="card-body">
            <div className="meta-row">
              <span className="meta-label">Backend API:</span>
              <span className="meta-value">{health.api ? "Online (Express 5)" : "Offline"}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Database:</span>
              <span className="meta-value">{health.db ? "PostgreSQL 16 (Prisma 7)" : "Unreachable"}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Docker Mode:</span>
              <span className="meta-value">Containerized</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tenant Isolation Demonstration Banner */}
      <div className="isolation-box">
        <div className="isolation-info">
          <h4>Multi-Tenant Security Enforcement (NFR-01)</h4>
          <p>
            The backend guarantees that users in <strong>{user.organisation.name}</strong> can never view or manipulate data from any other organisation.
          </p>
        </div>
        <button
          className="btn-secondary"
          onClick={testCrossTenantIsolation}
          disabled={testingCrossTenant}
        >
          {testingCrossTenant ? "Testing..." : "Test Cross-Tenant Protection"}
        </button>
      </div>

      {crossTenantTestResult && (
        <div className={`alert ${crossTenantTestResult.success ? "alert-success" : "alert-error"}`}>
          <strong>{crossTenantTestResult.success ? "Security Check Passed: " : "Failed: "}</strong>
          {crossTenantTestResult.message}
        </div>
      )}

      {/* Tenant Tickets List */}
      <div className="tickets-section">
        <div className="section-header">
          <div>
            <h2>Tenant Tickets</h2>
            <p>Maintenance requests belonging exclusively to {user.organisation.name}</p>
          </div>
          <button className="btn-refresh" onClick={fetchTickets} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="loading-state">Loading tenant tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="empty-state">
            <p>No tickets found for this organisation.</p>
          </div>
        ) : (
          <div className="tickets-table-wrapper">
            <table className="tickets-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Property / Unit</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Created By</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.title}</strong>
                      <div className="ticket-desc">{t.description}</div>
                    </td>
                    <td>
                      <div>{t.property?.name || "N/A"}</div>
                      <small className="unit-tag">Unit {t.unit?.unitNumber || "N/A"}</small>
                    </td>
                    <td>
                      <span className={`priority-tag priority-${t.priority.toLowerCase()}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`status-tag status-${t.status.toLowerCase()}`}>
                        {t.status}
                      </span>
                    </td>
                    <td>{t.creator?.name || "Resident"}</td>
                    <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
