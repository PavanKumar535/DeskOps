const rawBase = import.meta.env.VITE_API_URL || "http://localhost:5001";
const API_BASE = rawBase.startsWith("http://") || rawBase.startsWith("https://")
  ? rawBase.replace(/\/$/, "")
  : `https://${rawBase.replace(/\/$/, "")}`;

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  organisation: {
    id: string;
    name: string;
  };
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  property: { id: string; name: string; address: string };
  unit: { id: string; unitNumber: string };
  creator: { id: string; name: string; email: string; role: string };
  createdAt: string;
}

export interface HealthStatus {
  api: boolean;
  db: boolean;
  message: string;
}

export async function checkHealth(): Promise<HealthStatus> {
  try {
    const [healthRes, dbRes] = await Promise.all([
      fetch(`${API_BASE}/health`),
      fetch(`${API_BASE}/health/db`),
    ]);

    const healthData = await healthRes.json();
    const dbData = await dbRes.json();

    return {
      api: healthRes.ok && healthData.status === "success",
      db: dbRes.ok && dbData.status === "success",
      message: healthData.message || "Connected",
    };
  } catch (err: any) {
    return {
      api: false,
      db: false,
      message: "Backend unreachable",
    };
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null
): Promise<{ success: boolean; data?: T; message?: string; error?: string }> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const json = await res.json();

    if (!res.ok || json.status === "error") {
      return {
        success: false,
        error: json.message || "An error occurred",
      };
    }

    return {
      success: true,
      data: json.data,
      message: json.message,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Network error",
    };
  }
}
