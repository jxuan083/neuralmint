import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { Activity, Coins, Zap, Clock } from "lucide-react";
import { api } from "../services/api";
import type { UsageSummary } from "../services/api";

interface DashboardPageProps {
  address: string | null;
}

export function DashboardPage({ address }: DashboardPageProps) {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  useEffect(() => {
    if (!address) return;
    api.getUsageSummary(30).then(setUsage).catch(() => {});
  }, [address]);

  const card = {
    background: "#111",
    border: "1px solid #2a2a2a",
    borderRadius: 12,
    padding: 20,
  };

  if (!address) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#666" }}>
        <h2 style={{ color: "#eee", marginBottom: 8 }}>Connect your wallet to view dashboard</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, color: "#eee", marginBottom: 24 }}>Dashboard</h1>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { icon: Activity, label: "Total Requests", value: usage?.total_requests ?? 0, color: "#10b981" },
          { icon: Zap, label: "Total Tokens", value: (usage?.total_tokens ?? 0).toLocaleString(), color: "#8b5cf6" },
          { icon: Coins, label: "NMB Spent", value: (usage?.total_nmt_spent ?? 0).toFixed(4), color: "#f59e0b" },
          { icon: Clock, label: "Period", value: "Last 30 days", color: "#6b7280" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#888", fontSize: 12, marginBottom: 8 }}>
              <Icon size={14} color={color} /> {label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#eee" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={card}>
          <h3 style={{ color: "#eee", marginBottom: 16, fontSize: 14 }}>Daily Requests</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={usage?.daily ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="date" stroke="#666" fontSize={10} tickFormatter={(d) => d.slice(5)} />
              <YAxis stroke="#666" fontSize={10} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8 }} />
              <Bar dataKey="requests" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={card}>
          <h3 style={{ color: "#eee", marginBottom: 16, fontSize: 14 }}>Token Usage</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={usage?.daily ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="date" stroke="#666" fontSize={10} tickFormatter={(d) => d.slice(5)} />
              <YAxis stroke="#666" fontSize={10} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8 }} />
              <Area type="monotone" dataKey="tokens" stroke="#8b5cf6" fill="#8b5cf620" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
