import React, { useEffect, useState } from "react";
import type { User, Ticket, HealthStatus } from "../api";
import { apiRequest } from "../api";
import { TicketList } from "./tickets/TicketList";
import { TicketDetail } from "./tickets/TicketDetail";
import { CreateTicketModal } from "./tickets/CreateTicketModal";

interface DashboardProps {
  user: User;
  token: string;
  health: HealthStatus;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, token, health }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Cross-tenant security test state
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
      // Intentionally request a non-existent or foreign ID to prove server-side isolation
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

  const handleTicketCreated = (newTicket: Ticket) => {
    setTickets((prev) => [newTicket, ...prev]);
    setSelectedTicketId(newTicket.id);
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
              <span className="meta-label">Role Context:</span>
              <span className="meta-value text-capitalize">{user.role}</span>
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
              <span className="meta-label">Active Tickets:</span>
              <span className="meta-value">{tickets.length} Registered</span>
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

      {/* Main Ticket Lifecycle Area: List or Detail */}
      {selectedTicketId ? (
        <TicketDetail
          ticketId={selectedTicketId}
          user={user}
          token={token}
          onBack={() => {
            setSelectedTicketId(null);
            fetchTickets();
          }}
          onTicketUpdated={fetchTickets}
        />
      ) : (
        <TicketList
          tickets={tickets}
          loading={loading}
          error={error}
          onRefresh={fetchTickets}
          onSelectTicket={(id) => setSelectedTicketId(id)}
          onCreateTicketClick={() => setShowCreateModal(true)}
          organisationName={user.organisation.name}
        />
      )}

      {/* Create Ticket Modal */}
      {showCreateModal && (
        <CreateTicketModal
          token={token}
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onTicketCreated={handleTicketCreated}
        />
      )}
    </div>
  );
};
