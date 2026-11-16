import React, { useState } from "react";
import type { Ticket } from "../../api";

interface TicketListProps {
  tickets: Ticket[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSelectTicket: (ticketId: string) => void;
  onCreateTicketClick: () => void;
  organisationName: string;
}

export const TicketList: React.FC<TicketListProps> = ({
  tickets,
  loading,
  error,
  onRefresh,
  onSelectTicket,
  onCreateTicketClick,
  organisationName,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredTickets = tickets.filter((t) => {
    const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.property?.name && t.property.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.assignedTo?.name && t.assignedTo.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="tickets-section">
      <div className="section-header">
        <div>
          <h2>Tenant Maintenance Tickets</h2>
          <p>Tickets scoped exclusively to <strong>{organisationName}</strong></p>
        </div>

        <div className="header-actions">
          <button className="btn-secondary btn-new-ticket" onClick={onCreateTicketClick}>
            + Raise New Ticket
          </button>
          <button className="btn-refresh" onClick={onRefresh} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="table-filter-bar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by title, description, store, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="status-filter">
          <label htmlFor="filter-status">Status:</label>
          <select
            id="filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses ({tickets.length})</option>
            <option value="NEW">New</option>
            <option value="TRIAGED">Triaged</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
            <option value="REOPENED">Reopened</option>
          </select>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading tenant tickets...</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="empty-state">
          <p>
            {tickets.length === 0
              ? "No tickets found for this organisation. Raise your first ticket!"
              : "No tickets match your search or filter criteria."}
          </p>
          {tickets.length === 0 && (
            <button className="btn-primary" onClick={onCreateTicketClick}>
              + Raise New Ticket
            </button>
          )}
        </div>
      ) : (
        <div className="tickets-table-wrapper">
          <table className="tickets-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Title & Issue</th>
                <th>Property / Unit</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Technician</th>
                <th>Raised By</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map((t) => (
                <tr
                  key={t.id}
                  className="ticket-row-clickable"
                  onClick={() => onSelectTicket(t.id)}
                >
                  <td className="ticket-id-cell">
                    <code>#{t.id.substring(0, 8)}</code>
                  </td>
                  <td>
                    <strong className="ticket-title-link">{t.title}</strong>
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
                  <td>
                    {t.assignedTo ? (
                      <span className="tech-assigned-name">{t.assignedTo.name}</span>
                    ) : (
                      <span className="unassigned-muted">Unassigned</span>
                    )}
                  </td>
                  <td>{t.creator?.name || "Resident"}</td>
                  <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn-view-ticket"
                      onClick={() => onSelectTicket(t.id)}
                    >
                      View &rarr;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
