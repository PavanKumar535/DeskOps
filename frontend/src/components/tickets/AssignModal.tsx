import React, { useState, useEffect } from "react";
import type { Technician, Ticket } from "../../api";
import { apiRequest } from "../../api";

interface AssignModalProps {
  ticket: Ticket;
  token: string;
  isOpen: boolean;
  onClose: () => void;
  onAssigned: (updatedTicket: Ticket) => void;
}

export const AssignModal: React.FC<AssignModalProps> = ({
  ticket,
  token,
  isOpen,
  onClose,
  onAssigned,
}) => {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedTechId, setSelectedTechId] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTechnicians();
      setError(null);
    }
  }, [isOpen]);

  const loadTechnicians = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ technicians: Technician[] }>("/api/v1/technicians", {}, token);
      if (res.success && res.data?.technicians) {
        setTechnicians(res.data.technicians);
        if (res.data.technicians.length > 0) {
          setSelectedTechId(res.data.technicians[0].id);
        }
      } else {
        setError(res.error || "Failed to load technician roster.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load technicians");
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTechId) {
      setError("Please select a technician.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await apiRequest<{ ticket: Ticket }>(
        `/api/v1/tickets/${ticket.id}/assign`,
        {
          method: "POST",
          body: JSON.stringify({ technicianId: selectedTechId }),
        },
        token
      );

      if (res.success && res.data?.ticket) {
        onAssigned(res.data.ticket);
        onClose();
      } else {
        // Specifically identify concurrency conflicts (HTTP 409)
        if (res.error?.includes("already been assigned") || res.error?.includes("conflict")) {
          setError("Concurrency Conflict: This ticket was just assigned by another dispatcher or is no longer in TRIAGED status.");
        } else {
          setError(res.error || "Failed to assign ticket.");
        }
      }
    } catch (err: any) {
      setError(err.message || "Network error while assigning ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Assign Technician to Ticket</h3>
          <button className="btn-close-modal" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        <form onSubmit={handleAssign}>
          <div className="modal-body">
            <p className="modal-info-text">
              Assigning ticket: <strong>{ticket.title}</strong>
            </p>

            {error && <div className="alert alert-error">{error}</div>}

            {loading ? (
              <div className="loading-state">Loading certified technicians...</div>
            ) : technicians.length === 0 ? (
              <div className="empty-state">
                <p>No active technicians registered in this organisation.</p>
              </div>
            ) : (
              <div className="form-group">
                <label htmlFor="technician-select">Select Certified Technician *</label>
                <select
                  id="technician-select"
                  value={selectedTechId}
                  onChange={(e) => setSelectedTechId(e.target.value)}
                  disabled={submitting}
                  required
                >
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.name} ({tech.email})
                    </option>
                  ))}
                </select>
                <small className="form-hint">
                  Protected by PostgreSQL atomic row-locking concurrency control.
                </small>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting || loading || technicians.length === 0}
            >
              {submitting ? "Assigning..." : "Confirm Assignment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
