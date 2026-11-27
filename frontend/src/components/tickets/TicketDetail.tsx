import React, { useState, useEffect } from "react";
import type { User, Ticket, TicketEvent } from "../../api";
import { apiRequest } from "../../api";
import { TicketTimeline } from "./TicketTimeline";
import { AssignModal } from "./AssignModal";
import { TicketAttachments } from "./TicketAttachments";

interface TicketDetailProps {
  ticketId: string;
  user: User;
  token: string;
  onBack: () => void;
  onTicketUpdated?: () => void;
}

export const TicketDetail: React.FC<TicketDetailProps> = ({
  ticketId,
  user,
  token,
  onBack,
  onTicketUpdated,
}) => {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showTriageModal, setShowTriageModal] = useState(false);
  const [triagePriority, setTriagePriority] = useState("HIGH");
  const [triageCategory, setTriageCategory] = useState("");

  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  // CR-1 Merge states
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [duplicateTicketId, setDuplicateTicketId] = useState("");

  useEffect(() => {
    fetchTicketDetails();
    fetchEvents();
  }, [ticketId]);

  const fetchTicketDetails = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await apiRequest<{ ticket: Ticket }>(
        `/api/v1/tickets/${ticketId}`,
        {},
        token,
      );

      if (res.success && res.data?.ticket) {
        setTicket(res.data.ticket);

        if (res.data.ticket.events) {
          setEvents(res.data.ticket.events);
        }
      } else {
        setError(res.error || "Failed to load ticket details");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch ticket");
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    setEventsLoading(true);

    try {
      const res = await apiRequest<{ events: TicketEvent[] }>(
        `/api/v1/tickets/${ticketId}/events`,
        {},
        token,
      );

      if (res.success && res.data?.events) {
        setEvents(res.data.events);
      }
    } catch {
      // Ignore background event refresh errors
    } finally {
      setEventsLoading(false);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([fetchTicketDetails(), fetchEvents()]);

    if (onTicketUpdated) {
      onTicketUpdated();
    }
  };

  // 1. Triage action
  const handleTriageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await apiRequest<{ ticket: Ticket }>(
        `/api/v1/tickets/${ticketId}/triage`,
        {
          method: "POST",
          body: JSON.stringify({
            priority: triagePriority,
            category: triageCategory || ticket?.category || "General",
          }),
        },
        token,
      );

      if (res.success && res.data?.ticket) {
        setSuccessMessage("Ticket triaged successfully!");
        setShowTriageModal(false);
        await handleRefresh();
      } else {
        setError(res.error || "Failed to triage ticket");
      }
    } catch (err: any) {
      setError(err.message || "Network error while triaging ticket");
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Generic status transition
  const handleStatusChange = async (newStatus: string) => {
    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await apiRequest<{ ticket: Ticket }>(
        `/api/v1/tickets/${ticketId}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: newStatus }),
        },
        token,
      );

      if (res.success && res.data?.ticket) {
        setSuccessMessage(`Ticket transitioned to ${newStatus}`);
        await handleRefresh();
      } else {
        setError(res.error || `Failed to update status to ${newStatus}`);
      }
    } catch (err: any) {
      setError(err.message || "Network error while updating status");
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Resolve action
  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await apiRequest<{ ticket: Ticket }>(
        `/api/v1/tickets/${ticketId}/resolve`,
        {
          method: "POST",
          body: JSON.stringify({ resolutionNotes }),
        },
        token,
      );

      if (res.success && res.data?.ticket) {
        setSuccessMessage("Ticket resolved successfully!");
        setShowResolveModal(false);
        setResolutionNotes("");
        await handleRefresh();
      } else {
        setError(res.error || "Failed to resolve ticket");
      }
    } catch (err: any) {
      setError(err.message || "Network error while resolving ticket");
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Close action
  const handleCloseTicket = async () => {
    if (
      !window.confirm("Are you sure you want to mark this ticket as CLOSED?")
    ) {
      return;
    }

    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await apiRequest<{ ticket: Ticket }>(
        `/api/v1/tickets/${ticketId}/close`,
        { method: "POST" },
        token,
      );

      if (res.success && res.data?.ticket) {
        setSuccessMessage("Ticket officially closed!");
        await handleRefresh();
      } else {
        setError(res.error || "Failed to close ticket");
      }
    } catch (err: any) {
      setError(err.message || "Network error while closing ticket");
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Reopen action
  const handleReopenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await apiRequest<{ ticket: Ticket }>(
        `/api/v1/tickets/${ticketId}/reopen`,
        {
          method: "POST",
          body: JSON.stringify({ reason: reopenReason }),
        },
        token,
      );

      if (res.success && res.data?.ticket) {
        setSuccessMessage("Ticket reopened successfully!");
        setShowReopenModal(false);
        setReopenReason("");
        await handleRefresh();
      } else {
        setError(res.error || "Failed to reopen ticket");
      }
    } catch (err: any) {
      setError(err.message || "Network error while reopening ticket");
    } finally {
      setActionLoading(false);
    }
  };

  // 6. CR-1: Merge duplicate ticket into current original ticket
  const handleMergeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const duplicateId = duplicateTicketId.trim();

    if (!duplicateId) {
      setError("Please enter the duplicate ticket ID.");
      return;
    }

    if (duplicateId === ticketId) {
      setError("A ticket cannot be merged into itself.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to merge this duplicate ticket? " +
        "The duplicate will be closed and its comments and watchers " +
        "will be moved to the current ticket.",
    );

    if (!confirmed) {
      return;
    }

    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await apiRequest<{ ticket: Ticket }>(
        `/api/v1/tickets/${ticketId}/merge`,
        {
          method: "POST",
          body: JSON.stringify({
            duplicateTicketId: duplicateId,
          }),
        },
        token,
      );

      if (res.success) {
        setSuccessMessage(
          "Tickets merged successfully! The duplicate ticket has been closed.",
        );

        setShowMergeModal(false);
        setDuplicateTicketId("");

        await handleRefresh();
      } else {
        setError(res.error || "Failed to merge tickets.");
      }
    } catch (err: any) {
      setError(err.message || "Network error while merging tickets.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading ticket details...</p>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="card">
        <div className="alert alert-error">{error || "Ticket not found."}</div>

        <button className="btn-secondary" onClick={onBack}>
          &larr; Back to Tickets List
        </button>
      </div>
    );
  }

  // Check reopen window
  const isReopenActive = ticket.reopenUntil
    ? new Date().getTime() <= new Date(ticket.reopenUntil).getTime()
    : false;

  // Permissions
  const canClose = user.role === "ORG_ADMIN" || user.role === "STAFF";
  const canMerge = user.role === "ORG_ADMIN" || user.role === "STAFF";

  return (
    <div className="ticket-detail-view">
      {/* Top Navigation Bar */}
      <div className="detail-top-nav">
        <button className="btn-back" onClick={onBack}>
          &larr; Back to Tickets
        </button>

        <div className="top-nav-right">
          <button
            className="btn-refresh"
            onClick={handleRefresh}
            disabled={actionLoading}
          >
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {successMessage && (
        <div className="alert alert-success">{successMessage}</div>
      )}

      {/* Main Ticket Card */}
      <div className="card ticket-main-card">
        <div className="ticket-main-header">
          <div>
            <div className="ticket-id-tag">
              TICKET #{ticket.id.substring(0, 8)}
            </div>

            <h2 className="ticket-title">{ticket.title}</h2>
          </div>

          <div className="ticket-header-badges">
            <span
              className={`priority-tag priority-${ticket.priority.toLowerCase()}`}
            >
              {ticket.priority}
            </span>

            <span
              className={`status-tag status-${ticket.status.toLowerCase()}`}
            >
              {ticket.status}
            </span>
          </div>
        </div>

        <div className="ticket-description-box">
          <h4>Problem Description</h4>
          <p>{ticket.description}</p>
        </div>

        {/* Metadata Grid */}
        <div className="ticket-meta-grid">
          <div className="meta-block">
            <span className="meta-title">Property / Store</span>
            <strong>{ticket.property?.name || "N/A"}</strong>
            <small>{ticket.property?.address}</small>
          </div>

          <div className="meta-block">
            <span className="meta-title">Unit Number</span>
            <strong>Unit {ticket.unit?.unitNumber || "N/A"}</strong>
          </div>

          <div className="meta-block">
            <span className="meta-title">Category</span>
            <strong>{ticket.category || "General"}</strong>
          </div>

          <div className="meta-block">
            <span className="meta-title">Raised By</span>
            <strong>{ticket.creator?.name || "Tenant Resident"}</strong>
            <small>
              {ticket.creator?.email} ({ticket.creator?.role})
            </small>
          </div>

          <div className="meta-block">
            <span className="meta-title">Assigned Technician</span>

            {ticket.assignedTo ? (
              <>
                <strong className="text-tech-name">
                  {ticket.assignedTo.name}
                </strong>
                <small>{ticket.assignedTo.email}</small>
              </>
            ) : (
              <span className="unassigned-notice">Unassigned</span>
            )}
          </div>

          <div className="meta-block">
            <span className="meta-title">Created At</span>
            <span>{new Date(ticket.createdAt).toLocaleString()}</span>
          </div>
        </div>

        {/* Timestamps and Reopen Notice */}
        {(ticket.resolvedAt || ticket.closedAt || ticket.reopenUntil) && (
          <div className="reopen-window-box">
            {ticket.resolvedAt && (
              <div>
                Resolved:{" "}
                <strong>{new Date(ticket.resolvedAt).toLocaleString()}</strong>
              </div>
            )}

            {ticket.closedAt && (
              <div>
                Closed:{" "}
                <strong>{new Date(ticket.closedAt).toLocaleString()}</strong>
              </div>
            )}

            {ticket.reopenUntil && (
              <div
                className={`window-status ${
                  isReopenActive ? "window-active" : "window-expired"
                }`}
              >
                Reopening Window:{" "}
                {isReopenActive ? "ACTIVE until " : "EXPIRED on "}
                <strong>{new Date(ticket.reopenUntil).toLocaleString()}</strong>
              </div>
            )}
          </div>
        )}

        {/* Lifecycle Actions */}
        <div className="ticket-actions-toolbar">
          <span className="toolbar-label">Lifecycle Actions:</span>

          {/* Triage */}
          {ticket.status === "NEW" && (
            <button
              className="btn-action btn-triage"
              onClick={() => {
                setTriagePriority(ticket.priority);
                setTriageCategory(ticket.category || "General");
                setShowTriageModal(true);
              }}
              disabled={actionLoading}
            >
              Triage Ticket
            </button>
          )}

          {/* Assign Technician */}
          {ticket.status === "TRIAGED" && (
            <button
              className="btn-action btn-assign"
              onClick={() => setShowAssignModal(true)}
              disabled={actionLoading}
            >
              Assign Technician
            </button>
          )}

          {/* Start Work */}
          {(ticket.status === "ASSIGNED" || ticket.status === "ON_HOLD") && (
            <button
              className="btn-action btn-progress"
              onClick={() => handleStatusChange("IN_PROGRESS")}
              disabled={actionLoading}
            >
              {ticket.status === "ON_HOLD"
                ? "Resume Work"
                : "Start Work (In Progress)"}
            </button>
          )}

          {/* Hold */}
          {ticket.status === "IN_PROGRESS" && (
            <button
              className="btn-action btn-hold"
              onClick={() => handleStatusChange("ON_HOLD")}
              disabled={actionLoading}
            >
              Put on Hold
            </button>
          )}

          {/* Resolve */}
          {ticket.status === "IN_PROGRESS" && (
            <button
              className="btn-action btn-resolve"
              onClick={() => setShowResolveModal(true)}
              disabled={actionLoading}
            >
              Mark as Resolved
            </button>
          )}

          {/* Close */}
          {ticket.status === "RESOLVED" && canClose && (
            <button
              className="btn-action btn-close"
              onClick={handleCloseTicket}
              disabled={actionLoading}
            >
              Close Ticket
            </button>
          )}

          {/* Reopen */}
          {ticket.status === "CLOSED" && (
            <button
              className={`btn-action btn-reopen ${
                !isReopenActive ? "btn-disabled" : ""
              }`}
              onClick={() => {
                if (!isReopenActive) {
                  alert(
                    "The permitted reopening window has expired. Ticket cannot be reopened.",
                  );
                  return;
                }

                setShowReopenModal(true);
              }}
              disabled={actionLoading || !isReopenActive}
            >
              Reopen Ticket
            </button>
          )}

          {/* CR-1 Merge Duplicate Ticket */}
          {canMerge && (
            <button
              className="btn-action"
              onClick={() => {
                setError(null);
                setShowMergeModal(true);
              }}
              disabled={actionLoading}
            >
              Merge Duplicate Ticket
            </button>
          )}
        </div>
      </div>

      {/* Ticket Attachments */}
      <div className="card">
        <TicketAttachments
          ticketId={ticketId}
          token={token}
          attachments={ticket.attachments || []}
          onUploaded={handleRefresh}
        />
      </div>

      {/* Ticket Audit Timeline */}
      <div className="card ticket-timeline-card">
        <TicketTimeline events={events} loading={eventsLoading} />
      </div>

      {/* Assign Technician Modal */}
      {showAssignModal && (
        <AssignModal
          ticket={ticket}
          token={token}
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          onAssigned={() => {
            setSuccessMessage("Technician successfully assigned!");
            handleRefresh();
          }}
        />
      )}

      {/* Triage Modal */}
      {showTriageModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowTriageModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Triage Ticket</h3>

              <button
                className="btn-close-modal"
                onClick={() => setShowTriageModal(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleTriageSubmit}>
              <div className="modal-body">
                <p className="modal-info-text">
                  Set verified priority and classification before dispatching.
                </p>

                <div className="form-group">
                  <label htmlFor="triage-prio">Verified Priority *</label>

                  <select
                    id="triage-prio"
                    value={triagePriority}
                    onChange={(e) => setTriagePriority(e.target.value)}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="triage-cat">Category</label>

                  <input
                    id="triage-cat"
                    type="text"
                    value={triageCategory}
                    onChange={(e) => setTriageCategory(e.target.value)}
                    placeholder="e.g. Electrical, HVAC, Plumbing"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowTriageModal(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? "Saving..." : "Confirm Triage"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {showResolveModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowResolveModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Resolve Maintenance Ticket</h3>

              <button
                className="btn-close-modal"
                onClick={() => setShowResolveModal(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleResolveSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="resolution-notes">
                    Resolution Summary Notes
                  </label>

                  <textarea
                    id="resolution-notes"
                    rows={4}
                    placeholder="Describe how the issue was fixed, parts replaced, or testing conducted..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                  />

                  <small className="form-hint">
                    Resolving will calculate and activate the tenant's permitted
                    reopening window.
                  </small>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowResolveModal(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? "Resolving..." : "Mark as Resolved"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reopen Modal */}
      {showReopenModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowReopenModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reopen Closed Ticket</h3>

              <button
                className="btn-close-modal"
                onClick={() => setShowReopenModal(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleReopenSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="reopen-reason">Reason for Reopening *</label>

                  <textarea
                    id="reopen-reason"
                    rows={3}
                    placeholder="State why the issue has reoccurred or why further work is needed..."
                    value={reopenReason}
                    onChange={(e) => setReopenReason(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowReopenModal(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? "Reopening..." : "Confirm Reopen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CR-1 Merge Duplicate Ticket Modal */}
      {showMergeModal && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!actionLoading) setShowMergeModal(false);
          }}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Merge Duplicate Ticket</h3>

              <button
                className="btn-close-modal"
                onClick={() => setShowMergeModal(false)}
                disabled={actionLoading}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleMergeSubmit}>
              <div className="modal-body">
                <p className="modal-info-text">
                  Current ticket <strong>#{ticket.id.substring(0, 8)}</strong>{" "}
                  will remain the original ticket.
                </p>

                <div className="form-group">
                  <label htmlFor="duplicate-ticket-id">
                    Duplicate Ticket ID *
                  </label>

                  <input
                    id="duplicate-ticket-id"
                    type="text"
                    value={duplicateTicketId}
                    onChange={(e) => setDuplicateTicketId(e.target.value)}
                    placeholder="Enter duplicate ticket ID (e.g. fc9c4b20)"
                    required
                    disabled={actionLoading}
                  />
                </div>

                <small className="form-hint">
                  The duplicate ticket will be closed. Its comments and watchers
                  will be moved to the original ticket.
                </small>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowMergeModal(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={actionLoading || !duplicateTicketId.trim()}
                >
                  {actionLoading ? "Merging..." : "Confirm Merge"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
