const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("nmt_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

export interface ApiKeyInfo {
  id: number;
  key: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
  total_requests: number;
  total_tokens_used: number;
  total_nmt_spent: number;
}

export interface DailyUsage {
  date: string;
  requests: number;
  tokens: number;
  nmt_spent: number;
}

export interface UsageSummary {
  total_requests: number;
  total_tokens: number;
  total_nmt_spent: number;
  daily: DailyUsage[];
}

export const api = {
  // Auth
  getChallenge: (address: string) =>
    request<{ address: string; message: string; nonce: string }>(
      `/api/auth/challenge/${address}`
    ),
  verifyAuth: (address: string, signature: string, message: string) =>
    request<{ access_token: string; address: string }>("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ address, signature, message }),
    }),

  // API Keys
  createKey: (name: string) =>
    request<ApiKeyInfo>("/api/keys", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  listKeys: () => request<ApiKeyInfo[]>("/api/keys"),
  revokeKey: (keyId: number) =>
    request<{ status: string }>(`/api/keys/${keyId}`, { method: "DELETE" }),

  // Usage
  getUsageSummary: (days?: number) =>
    request<UsageSummary>(`/api/usage/summary?days=${days || 30}`),
  getRecentRequests: (limit?: number) =>
    request<any[]>(`/api/usage/recent?limit=${limit || 50}`),

  // Tokens
  getBalance: (address: string) =>
    request<{ address: string; balance: string; balance_raw: string }>(
      `/api/tokens/balance/${address}`
    ),
  getStats: () => request<import("../types").TokenStats>("/api/tokens/stats"),

  // Miners
  getMiners: () => request<import("../types").MinerInfo[]>("/api/miners"),

  // Health
  health: () =>
    request<{ status: string; active_miners: number }>("/api/health"),
};
