import { useState, useEffect } from "react";
import { Pickaxe } from "lucide-react";
import { api } from "../services/api";
import type { MinerInfo } from "../types";

export function MinerPage() {
  const [miners, setMiners] = useState<MinerInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMiners = async () => {
      try {
        const data = await api.getMiners();
        setMiners(data);
      } catch {
        setMiners([]);
      } finally {
        setLoading(false);
      }
    };
    fetchMiners();
    const interval = setInterval(fetchMiners, 5000);
    return () => clearInterval(interval);
  }, []);

  const cardStyle = {
    background: "#111",
    border: "1px solid #2a2a2a",
    borderRadius: 12,
    padding: 20,
  };

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, color: "#eee", marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
        <Pickaxe size={24} color="#10b981" />
        Miner Dashboard
      </h1>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <div style={cardStyle}>
          <div style={{ color: "#888", fontSize: 12, marginBottom: 4 }}>Active Miners</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#10b981" }}>{miners.length}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ color: "#888", fontSize: 12, marginBottom: 4 }}>Total Tasks Completed</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#eee" }}>
            {miners.reduce((sum, m) => sum + m.tasks_completed, 0)}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ color: "#888", fontSize: 12, marginBottom: 4 }}>Total NMB Earned</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#f59e0b" }}>
            {miners.reduce((sum, m) => sum + m.tokens_earned, 0).toFixed(1)}
          </div>
        </div>
      </div>

      {/* How to mine */}
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <h3 style={{ color: "#eee", marginBottom: 12 }}>How to Mine</h3>
        <div style={{ color: "#aaa", fontSize: 14, lineHeight: 1.8 }}>
          <p>1. Install the miner client: <code style={{ background: "#1a1a1a", padding: "2px 6px", borderRadius: 4 }}>cd miner && pip install -r requirements.txt</code></p>
          <p>2. Copy <code style={{ background: "#1a1a1a", padding: "2px 6px", borderRadius: 4 }}>.env.example</code> to <code style={{ background: "#1a1a1a", padding: "2px 6px", borderRadius: 4 }}>.env</code> and set your private key</p>
          <p>3. Install Ollama and pull a model: <code style={{ background: "#1a1a1a", padding: "2px 6px", borderRadius: 4 }}>ollama pull llama3.2:1b</code></p>
          <p>4. Start mining: <code style={{ background: "#1a1a1a", padding: "2px 6px", borderRadius: 4 }}>python main.py</code></p>
        </div>
      </div>

      {/* Miner list */}
      <h3 style={{ color: "#eee", marginBottom: 12 }}>Active Miners</h3>
      {loading ? (
        <p style={{ color: "#666" }}>Loading...</p>
      ) : miners.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", color: "#666" }}>
          No miners online. Start the miner client to begin earning NMB.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {miners.map((miner) => (
            <div key={miner.address} style={{
              ...cardStyle,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: miner.status === "online" ? "#10b981" : miner.status === "busy" ? "#f59e0b" : "#666",
                }} />
                <div>
                  <div style={{ color: "#eee", fontSize: 14, fontFamily: "monospace" }}>
                    {miner.address.slice(0, 10)}...{miner.address.slice(-8)}
                  </div>
                  <div style={{ color: "#666", fontSize: 12 }}>
                    {miner.gpu_name || "CPU"} | {miner.model_loaded || "No model"}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 24 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#888", fontSize: 11 }}>Tasks</div>
                  <div style={{ color: "#eee", fontWeight: 600 }}>{miner.tasks_completed}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#888", fontSize: 11 }}>Earned</div>
                  <div style={{ color: "#f59e0b", fontWeight: 600 }}>{miner.tokens_earned.toFixed(1)} NMB</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
