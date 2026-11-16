import React, { useState, useEffect } from "react";
import type { Property, Unit, Ticket } from "../../api";
import { apiRequest } from "../../api";

interface CreateTicketModalProps {
  token: string;
  isOpen: boolean;
  onClose: () => void;
  onTicketCreated: (newTicket: Ticket) => void;
}

export const CreateTicketModal: React.FC<CreateTicketModalProps> = ({
  token,
  isOpen,
  onClose,
  onTicketCreated,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [category, setCategory] = useState("General");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");

  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadProperties();
      // Reset form
      setTitle("");
      setDescription("");
      setPriority("MEDIUM");
      setCategory("General");
      setSelectedPropertyId("");
      setSelectedUnitId("");
      setError(null);
    }
  }, [isOpen]);

  const loadProperties = async () => {
    setLoadingMeta(true);
    try {
      const res = await apiRequest<{ properties: Property[] }>("/api/v1/properties", {}, token);
      if (res.success && res.data?.properties) {
        setProperties(res.data.properties);
        if (res.data.properties.length > 0) {
          const firstProp = res.data.properties[0];
          setSelectedPropertyId(firstProp.id);
          setUnits(firstProp.units || []);
          if (firstProp.units && firstProp.units.length > 0) {
            setSelectedUnitId(firstProp.units[0].id);
          }
        }
      } else {
        setError(res.error || "Failed to load properties for this organisation.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load properties");
    } finally {
      setLoadingMeta(false);
    }
  };

  const handlePropertyChange = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    const foundProp = properties.find((p) => p.id === propertyId);
    const propUnits = foundProp?.units || [];
    setUnits(propUnits);
    setSelectedUnitId(propUnits.length > 0 ? propUnits[0].id : "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (title.trim().length < 3) {
      setError("Title must be at least 3 characters long.");
      return;
    }
    if (description.trim().length < 5) {
      setError("Description must be at least 5 characters long.");
      return;
    }
    if (!selectedPropertyId) {
      setError("Please select a valid property/store.");
      return;
    }
    if (!selectedUnitId) {
      setError("Please select a unit within the selected property.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest<{ ticket: Ticket }>(
        "/api/v1/tickets",
        {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            priority,
            category: category.trim() || "General",
            propertyId: selectedPropertyId,
            unitId: selectedUnitId,
          }),
        },
        token
      );

      if (res.success && res.data?.ticket) {
        onTicketCreated(res.data.ticket);
        onClose();
      } else {
        setError(res.error || "Failed to create ticket.");
      }
    } catch (err: any) {
      setError(err.message || "Network error while creating ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Raise New Maintenance Ticket</h3>
          <button className="btn-close-modal" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="ticket-form">
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            {loadingMeta ? (
              <div className="loading-state">Loading property and unit choices...</div>
            ) : (
              <>
                <div className="form-group">
                  <label htmlFor="ticket-title">Title *</label>
                  <input
                    id="ticket-title"
                    type="text"
                    placeholder="e.g. Broken water pipe in 2nd floor restroom"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="ticket-description">Detailed Description *</label>
                  <textarea
                    id="ticket-description"
                    rows={4}
                    placeholder="Describe the issue, exact location, and any safety concerns..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group flex-1">
                    <label htmlFor="ticket-priority">Priority</label>
                    <select
                      id="ticket-priority"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                      disabled={submitting}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>

                  <div className="form-group flex-1">
                    <label htmlFor="ticket-category">Category</label>
                    <select
                      id="ticket-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      disabled={submitting}
                    >
                      <option value="General">General</option>
                      <option value="Plumbing">Plumbing</option>
                      <option value="Electrical">Electrical</option>
                      <option value="HVAC">HVAC</option>
                      <option value="Security">Security</option>
                      <option value="Structural">Structural</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group flex-1">
                    <label htmlFor="ticket-property">Property / Store *</label>
                    <select
                      id="ticket-property"
                      value={selectedPropertyId}
                      onChange={(e) => handlePropertyChange(e.target.value)}
                      required
                      disabled={submitting || properties.length === 0}
                    >
                      {properties.length === 0 && <option value="">No properties found</option>}
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group flex-1">
                    <label htmlFor="ticket-unit">Unit Number *</label>
                    <select
                      id="ticket-unit"
                      value={selectedUnitId}
                      onChange={(e) => setSelectedUnitId(e.target.value)}
                      required
                      disabled={submitting || units.length === 0}
                    >
                      {units.length === 0 && <option value="">No units available</option>}
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          Unit {u.unitNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
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
              disabled={submitting || loadingMeta}
            >
              {submitting ? "Submitting..." : "Create Ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
