import { useState, useEffect } from "react";
import type { User, HealthStatus } from "./api";
import { checkHealth, apiRequest } from "./api";
import { Navbar } from "./components/Navbar";
import { Login } from "./components/Login";
import { Dashboard } from "./components/Dashboard";
import "./App.css";

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("deskops_token"));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [health, setHealth] = useState<HealthStatus>({
    api: false,
    db: false,
    message: "Checking connection...",
  });

  // Check backend health
  useEffect(() => {
    checkHealth().then(setHealth);
    const interval = setInterval(() => {
      checkHealth().then(setHealth);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Validate existing token on load
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    apiRequest<{ user: User }>("/api/v1/auth/me", {}, token)
      .then((res) => {
        if (res.success && res.data) {
          setUser(res.data.user);
        } else {
          // Token expired or invalid
          handleLogout();
        }
      })
      .catch(() => {
        handleLogout();
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  const handleLoginSuccess = (newToken: string, loggedInUser: User) => {
    localStorage.setItem("deskops_token", newToken);
    setToken(newToken);
    setUser(loggedInUser);
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await apiRequest("/api/v1/auth/logout", { method: "POST" }, token);
      } catch {
        // Ignore logout network errors
      }
    }
    localStorage.removeItem("deskops_token");
    setToken(null);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
        <p>Loading DeskOps Platform...</p>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Navbar user={user} health={health} onLogout={handleLogout} />

      <main className="main-content">
        {!user || !token ? (
          <Login health={health} onLoginSuccess={handleLoginSuccess} />
        ) : (
          <Dashboard user={user} token={token} health={health} />
        )}
      </main>

      <footer className="app-footer">
        <p>DeskOps Platform &bull; Milestone M1.2 Walking Skeleton &bull; Node.js 22 &bull; React 18/19 &bull; PostgreSQL 16 &bull; Prisma 7</p>
      </footer>
    </div>
  );
}

export default App;
