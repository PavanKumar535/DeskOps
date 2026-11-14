import React, { useState } from "react";
import type { User, HealthStatus } from "../api";
import { apiRequest } from "../api";

interface LoginProps {
  health: HealthStatus;
  onLoginSuccess: (token: string, user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ health, onLoginSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Expose pre-seeded demo shortcuts only during local development
  const isDev = import.meta.env.DEV;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiRequest<{ token: string; user: User }>(
        "/api/v1/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        }
      );

      if (res.success && res.data) {
        onLoginSuccess(res.data.token, res.data.user);
      } else {
        setError(res.error || "Login failed");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("Password123!");
    setError(null);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-badge">Walking Skeleton M1.2</div>
          <h2>Sign in to DeskOps</h2>
          <p>Multi-Tenant Facilities & Maintenance Platform</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. admin@acme.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>

        {isDev && (
          <div className="demo-accounts-box">
            <p className="demo-title">Local Development Quick-Fill (Dev Mode Only):</p>
            <div className="demo-buttons">
              <button
                type="button"
                className="btn-demo"
                onClick={() => handleQuickFill("admin@acme.com")}
              >
                <strong>Org A Admin:</strong> admin@acme.com (Acme)
              </button>
              <button
                type="button"
                className="btn-demo"
                onClick={() => handleQuickFill("admin@apex.com")}
              >
                <strong>Org B Admin:</strong> admin@apex.com (Apex)
              </button>
            </div>
            <small className="demo-hint">Dev test password: <code>Password123!</code></small>
          </div>
        )}

        <div className="login-footer">
          <span className={`status-dot ${health.api ? "online" : "offline"}`} />
          <span>Backend Status: {health.message}</span>
        </div>
      </div>
    </div>
  );
};
