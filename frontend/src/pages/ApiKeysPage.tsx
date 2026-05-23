import { useState, useEffect } from "react";
import { Key, Plus, Trash2, Copy, Check } from "lucide-react";
import { api } from "../services/api";
import type { ApiKeyInfo } from "../services/api";

interface ApiKeysPageProps {
  address: string | null;
}

export function ApiKeysPage({ address }: ApiKeysPageProps) {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (address) {
      api.listKeys().then(setKeys).catch(() => {});
    }
  }, [address]);

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    setLoading(true);
    try {
      const key = await api.createKey(newKeyName.trim());
      setCreatedKey(key.key); // Show full key only once
      setNewKeyName("");
      const updated = await api.listKeys();
      setKeys(updated);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const revokeKey = async (id: number) => {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    try {
      await api.revokeKey(id);
      const updated = await api.listKeys();
      setKeys(updated);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const copyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const card = {
    background: "#111",
    border: "1px solid #2a2a2a",
    borderRadius: 12,
    padding: 20,
  };

  if (!address) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#666" }}>
        <h2 style={{ color: "#eee", marginBottom: 8 }}>Connect your wallet to manage API keys</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, color: "#eee", marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
        <Key size={24} color="#10b981" />
        API Keys
      </h1>

      {/* Created key banner */}
      {createdKey && (
        <div style={{
          ...card,
          border: "1px solid #10b981",
          marginBottom: 16,
          background: "#10b98110",
        }}>
          <div style={{ color: "#10b981", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            API Key Created - Copy it now. You won't see it again.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <code style={{
              flex: 1,
              padding: "10px 12px",
              background: "#0a0a0a",
              borderRadius: 6,
              color: "#eee",
              fontSize: 13,
              fontFamily: "monospace",
            }}>
              {createdKey}
            </code>
            <button onClick={copyKey} style={{
              padding: "10px 14px",
              borderRadius: 6,
              border: "none",
              background: "#10b981",
              color: "#000",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {/* Create new key */}
      <div style={{ ...card, marginBottom: 24 }}>
        <h3 style={{ color: "#eee", marginBottom: 12, fontSize: 15 }}>Create New Key</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createKey()}
            placeholder="Key name (e.g. my-app, testing)"
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #2a2a2a",
              background: "#0a0a0a",
              color: "#eee",
              fontSize: 14,
              outline: "none",
            }}
          />
          <button
            onClick={createKey}
            disabled={!newKeyName.trim() || loading}
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              border: "none",
              background: newKeyName.trim() ? "#10b981" : "#1a1a1a",
              color: newKeyName.trim() ? "#000" : "#555",
              cursor: newKeyName.trim() ? "pointer" : "default",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Plus size={16} />
            Create
          </button>
        </div>
      </div>

      {/* Key list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {keys.length === 0 ? (
          <div style={{ ...card, textAlign: "center", color: "#666" }}>
            No API keys yet. Create one to get started.
          </div>
        ) : keys.map((k) => (
          <div key={k.id} style={{
            ...card,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            opacity: k.is_active ? 1 : 0.5,
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ color: "#eee", fontWeight: 600, fontSize: 14 }}>{k.name}</span>
                {!k.is_active && (
                  <span style={{ color: "#ef4444", fontSize: 11, background: "#ef444420", padding: "2px 6px", borderRadius: 4 }}>
                    Revoked
                  </span>
                )}
              </div>
              <code style={{ color: "#888", fontSize: 12, fontFamily: "monospace" }}>{k.key}</code>
              <div style={{ color: "#555", fontSize: 11, marginTop: 4 }}>
                Created {new Date(k.created_at).toLocaleDateString()}
                {k.last_used_at && ` | Last used ${new Date(k.last_used_at).toLocaleDateString()}`}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "#eee", fontSize: 16, fontWeight: 600 }}>{k.total_requests}</div>
                <div style={{ color: "#666", fontSize: 11 }}>requests</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "#f59e0b", fontSize: 16, fontWeight: 600 }}>{k.total_nmt_spent.toFixed(4)}</div>
                <div style={{ color: "#666", fontSize: 11 }}>NMB spent</div>
              </div>
              {k.is_active && (
                <button onClick={() => revokeKey(k.id)} style={{
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid #2a2a2a",
                  background: "transparent",
                  color: "#ef4444",
                  cursor: "pointer",
                }}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
