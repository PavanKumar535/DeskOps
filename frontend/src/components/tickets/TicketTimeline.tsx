import React from "react";
import type { TicketEvent } from "../../api";

interface TicketTimelineProps {
  events: TicketEvent[];
  loading?: boolean;
}

export const TicketTimeline: React.FC<TicketTimelineProps> = ({ events, loading }) => {
  if (loading) {
    return <div className="loading-state">Loading audit event timeline...</div>;
  }

  if (!events || events.length === 0) {
    return (
      <div className="empty-state">
        <p>No audit events recorded for this ticket yet.</p>
      </div>
    );
  }

  const getEventBadgeClass = (eventType: string) => {
    switch (eventType) {
      case "TICKET_CREATED":
        return "event-badge-created";
      case "TICKET_TRIAGED":
        return "event-badge-triaged";
      case "TICKET_ASSIGNED":
        return "event-badge-assigned";
      case "TICKET_RESOLVED":
        return "event-badge-resolved";
      case "TICKET_CLOSED":
        return "event-badge-closed";
      case "TICKET_REOPENED":
        return "event-badge-reopened";
      case "STATUS_CHANGED":
        return "event-badge-status";
      default:
        return "event-badge-default";
    }
  };

  return (
    <div className="timeline-container">
      <h4 className="timeline-heading">Ticket Audit & Lifecycle History</h4>
      <div className="timeline-list">
        {events.map((evt, idx) => (
          <div key={evt.id || idx} className="timeline-item">
            <div className="timeline-marker">
              <span className="timeline-dot" />
              {idx < events.length - 1 && <span className="timeline-line" />}
            </div>

            <div className="timeline-content">
              <div className="timeline-header">
                <span className={`timeline-badge ${getEventBadgeClass(evt.eventType)}`}>
                  {evt.eventType.replace(/_/g, " ")}
                </span>
                <span className="timeline-time">
                  {new Date(evt.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </div>

              {evt.previousStatus && evt.newStatus && (
                <div className="timeline-transition">
                  <span className="status-pill status-pill-old">{evt.previousStatus}</span>
                  <span className="transition-arrow">&rarr;</span>
                  <span className="status-pill status-pill-new">{evt.newStatus}</span>
                </div>
              )}

              {evt.description && <p className="timeline-desc">{evt.description}</p>}

              <div className="timeline-actor">
                <span className="actor-label">Actor:</span>
                <span className="actor-name">
                  {evt.actor?.name || "System"} ({evt.actor?.email || "internal"})
                </span>
                {evt.actor?.role && (
                  <span className="actor-role-tag">{evt.actor.role}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
