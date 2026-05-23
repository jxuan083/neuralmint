import { useState, useEffect, useCallback } from "react";
import { Vote, Plus, CheckCircle, XCircle, Clock, Ban } from "lucide-react";
import { Contract, JsonRpcSigner, formatEther, parseEther } from "ethers";
import { CONTRACTS, GOVERNANCE_ABI, TOKEN_ABI } from "../services/contracts";

interface GovernancePageProps {
  address: string | null;
  signer: JsonRpcSigner | null;
}

type ProposalState = "Pending" | "Active" | "Defeated" | "Succeeded" | "Queued" | "Executed" | "Canceled";

const STATE_LABELS: ProposalState[] = [
  "Pending", "Active", "Defeated", "Succeeded", "Queued", "Executed", "Canceled",
];

interface Proposal {
  id: number;
  proposer: string;
  description: string;
  target: string;
  forVotes: string;
  againstVotes: string;
  startTime: number;
  endTime: number;
  eta: number;
  executed: boolean;
  canceled: boolean;
  state: ProposalState;
  hasVoted: boolean;
}

const STATE_COLOR: Record<ProposalState, string> = {
  Pending: "#6b7280",
  Active: "#10b981",
  Defeated: "#ef4444",
  Succeeded: "#8b5cf6",
  Queued: "#f59e0b",
  Executed: "#3b82f6",
  Canceled: "#4b5563",
};

const STATE_ICON: Record<ProposalState, React.FC<{ size: number }>> = {
  Pending: ({ size }) => <Clock size={size} />,
  Active: ({ size }) => <Vote size={size} />,
  Defeated: ({ size }) => <XCircle size={size} />,
  Succeeded: ({ size }) => <CheckCircle size={size} />,
  Queued: ({ size }) => <Clock size={size} />,
  Executed: ({ size }) => <CheckCircle size={size} />,
  Canceled: ({ size }) => <Ban size={size} />,
};

// Preset proposal templates for common governance actions
const TEMPLATES = [
  { label: "Set min stake to 50 NMB", callData: (addr: string) => encodeSetMinStake(addr, 50) },
  { label: "Set min stake to 200 NMB", callData: (addr: string) => encodeSetMinStake(addr, 200) },
  { label: "Set min stake to 500 NMB", callData: (addr: string) => encodeSetMinStake(addr, 500) },
];

function encodeSetMinStake(stakingAddr: string, amount: number): { target: string; callData: string } {
  // ABI encode setMinStake(uint256)
  const iface = new (require("ethers").Interface)(["function setMinStake(uint256)"]);
  return {
    target: stakingAddr,
    callData: iface.encodeFunctionData("setMinStake", [parseEther(amount.toString())]),
  };
}

export function GovernancePage({ address, signer }: GovernancePageProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formDesc, setFormDesc] = useState("");
  const [formTemplate, setFormTemplate] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [nmb, setNmb] = useState("0");

  const noContracts = !CONTRACTS.GOVERNANCE;

  const card = {
    background: "#111",
    border: "1px solid #2a2a2a",
    borderRadius: 12,
    padding: 20,
  };

  const fetchProposals = useCallback(async () => {
    if (!signer || !CONTRACTS.GOVERNANCE) {
      setLoading(false);
      return;
    }
    try {
      const gov = new Contract(CONTRACTS.GOVERNANCE, GOVERNANCE_ABI, signer);
      const count = await gov.proposalCount();
      const list: Proposal[] = [];

      for (let i = 1; i <= Number(count); i++) {
        const [proposer, description, target, forVotes, againstVotes, startTime, endTime, eta, executed, canceled] =
          await gov.getProposal(i);
        const stateIdx = await gov.state(i);
        const voted = address ? await gov.hasVoted(i, address) : false;

        list.push({
          id: i,
          proposer,
          description,
          target,
          forVotes: formatEther(forVotes),
          againstVotes: formatEther(againstVotes),
          startTime: Number(startTime),
          endTime: Number(endTime),
          eta: Number(eta),
          executed,
          canceled,
          state: STATE_LABELS[Number(stateIdx)],
          hasVoted: voted,
        });
      }
      setProposals(list.reverse());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [signer, address]);

  useEffect(() => {
    fetchProposals();
    if (signer && CONTRACTS.TOKEN && address) {
      const token = new Contract(CONTRACTS.TOKEN, TOKEN_ABI, signer);
      token.balanceOf(address).then((b: bigint) => setNmb(parseFloat(formatEther(b)).toFixed(2)));
    }
  }, [signer, address, fetchProposals]);

  const handleVote = async (proposalId: number, support: boolean) => {
    if (!signer || !CONTRACTS.GOVERNANCE) return;
    setTxStatus("Sending vote...");
    try {
      const gov = new Contract(CONTRACTS.GOVERNANCE, GOVERNANCE_ABI, signer);
      const tx = await gov.vote(proposalId, support);
      await tx.wait();
      setTxStatus(`Vote cast successfully`);
      fetchProposals();
    } catch (e: any) {
      setTxStatus(`Error: ${e.reason || e.message}`);
    }
    setTimeout(() => setTxStatus(null), 4000);
  };

  const handleExecute = async (proposalId: number) => {
    if (!signer || !CONTRACTS.GOVERNANCE) return;
    setTxStatus("Executing proposal...");
    try {
      const gov = new Contract(CONTRACTS.GOVERNANCE, GOVERNANCE_ABI, signer);
      const tx = await gov.execute(proposalId);
      await tx.wait();
      setTxStatus("Proposal executed");
      fetchProposals();
    } catch (e: any) {
      setTxStatus(`Error: ${e.reason || e.message}`);
    }
    setTimeout(() => setTxStatus(null), 4000);
  };

  const handlePropose = async () => {
    if (!signer || !CONTRACTS.GOVERNANCE || !CONTRACTS.MINER_STAKING) return;
    setSubmitting(true);
    setTxStatus("Submitting proposal...");
    try {
      const gov = new Contract(CONTRACTS.GOVERNANCE, GOVERNANCE_ABI, signer);
      const tmpl = TEMPLATES[formTemplate];
      const { target, callData } = tmpl.callData(CONTRACTS.MINER_STAKING);
      const tx = await gov.propose(formDesc || tmpl.label, target, callData);
      await tx.wait();
      setTxStatus("Proposal created");
      setShowForm(false);
      setFormDesc("");
      fetchProposals();
    } catch (e: any) {
      setTxStatus(`Error: ${e.reason || e.message}`);
    } finally {
      setSubmitting(false);
      setTimeout(() => setTxStatus(null), 4000);
    }
  };

  const formatTime = (ts: number) =>
    new Date(ts * 1000).toLocaleDateString("zh-TW", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, color: "#eee", display: "flex", alignItems: "center", gap: 8 }}>
          <Vote size={24} color="#10b981" /> DAO Governance
        </h1>
        {address && !noContracts && (
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 8, border: "1px solid #10b981",
              background: "transparent", color: "#10b981", cursor: "pointer", fontSize: 14,
            }}
          >
            <Plus size={16} /> New Proposal
          </button>
        )}
      </div>

      {/* Info cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Your NMB Balance", value: `${nmb} NMB`, note: "= voting power" },
          { label: "Proposal Threshold", value: "1,000 NMB", note: "to create proposals" },
          { label: "Quorum", value: "100,000 NMB", note: "to pass proposals" },
        ].map(({ label, value, note }) => (
          <div key={label} style={card}>
            <div style={{ color: "#888", fontSize: 12, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#eee" }}>{value}</div>
            <div style={{ color: "#555", fontSize: 11, marginTop: 2 }}>{note}</div>
          </div>
        ))}
      </div>

      {/* How DAO works */}
      <div style={{ ...card, marginBottom: 24, background: "#0d1a13", borderColor: "#1a3a26" }}>
        <div style={{ color: "#10b981", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>How DAO Works</div>
        <div style={{ color: "#888", fontSize: 13, lineHeight: 1.8 }}>
          NMB holders vote on parameter changes (e.g., min miner stake).
          Voting period: <strong style={{ color: "#ccc" }}>3 days</strong> →
          Timelock: <strong style={{ color: "#ccc" }}>1 day</strong> →
          Anyone can execute. 1 NMB = 1 vote.
        </div>
      </div>

      {noContracts && (
        <div style={{ ...card, color: "#f59e0b", textAlign: "center", marginBottom: 24 }}>
          Contracts not deployed. Set VITE_GOVERNANCE_ADDRESS in .env to enable DAO.
        </div>
      )}

      {/* Create proposal form */}
      {showForm && (
        <div style={{ ...card, marginBottom: 24, borderColor: "#10b981" }}>
          <h3 style={{ color: "#eee", marginBottom: 16, fontSize: 16 }}>New Proposal</h3>
          <div style={{ marginBottom: 12 }}>
            <label style={{ color: "#888", fontSize: 12 }}>Action Template</label>
            <select
              value={formTemplate}
              onChange={(e) => setFormTemplate(Number(e.target.value))}
              style={{
                width: "100%", marginTop: 4, padding: "10px 12px", borderRadius: 8,
                border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#eee",
                fontSize: 14, outline: "none",
              }}
            >
              {TEMPLATES.map((t, i) => (
                <option key={i} value={i}>{t.label}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: "#888", fontSize: 12 }}>Description (optional)</label>
            <input
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder={TEMPLATES[formTemplate].label}
              style={{
                width: "100%", marginTop: 4, padding: "10px 12px", borderRadius: 8,
                border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#eee",
                fontSize: 14, outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
          <button
            onClick={handlePropose}
            disabled={submitting}
            style={{
              padding: "10px 24px", borderRadius: 8, border: "none",
              background: submitting ? "#1a1a1a" : "#10b981",
              color: submitting ? "#555" : "#000", fontWeight: 600,
              cursor: submitting ? "default" : "pointer", fontSize: 14,
            }}
          >
            {submitting ? "Submitting..." : "Submit Proposal"}
          </button>
        </div>
      )}

      {txStatus && (
        <div style={{ ...card, marginBottom: 16, color: "#10b981", fontSize: 14 }}>{txStatus}</div>
      )}

      {/* Proposals list */}
      <h3 style={{ color: "#eee", marginBottom: 12, fontSize: 16 }}>Proposals</h3>
      {loading ? (
        <p style={{ color: "#666" }}>Loading...</p>
      ) : proposals.length === 0 ? (
        <div style={{ ...card, color: "#666", textAlign: "center" }}>
          No proposals yet. Be the first to propose a change.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {proposals.map((p) => {
            const stateColor = STATE_COLOR[p.state];
            const StateIcon = STATE_ICON[p.state];
            const totalVotes = parseFloat(p.forVotes) + parseFloat(p.againstVotes);
            const forPct = totalVotes > 0 ? (parseFloat(p.forVotes) / totalVotes) * 100 : 0;

            return (
              <div key={p.id} style={card}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{
                        display: "flex", alignItems: "center", gap: 4,
                        color: stateColor, fontSize: 12, fontWeight: 600,
                        background: `${stateColor}20`, padding: "2px 8px", borderRadius: 99,
                      }}>
                        <StateIcon size={11} /> {p.state}
                      </span>
                      <span style={{ color: "#555", fontSize: 12 }}>#{p.id}</span>
                    </div>
                    <div style={{ color: "#eee", fontSize: 15, fontWeight: 500 }}>{p.description}</div>
                    <div style={{ color: "#555", fontSize: 11, marginTop: 4 }}>
                      by {p.proposer.slice(0, 8)}...{p.proposer.slice(-6)} ·
                      ends {formatTime(p.endTime)}
                    </div>
                  </div>
                </div>

                {/* Vote bar */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#888", marginBottom: 4 }}>
                    <span style={{ color: "#10b981" }}>For: {parseFloat(p.forVotes).toFixed(0)} NMB ({forPct.toFixed(1)}%)</span>
                    <span style={{ color: "#ef4444" }}>Against: {parseFloat(p.againstVotes).toFixed(0)} NMB</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "#1a1a1a", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${forPct}%`, background: "#10b981", borderRadius: 3 }} />
                  </div>
                </div>

                {/* Actions */}
                {p.state === "Active" && address && !p.hasVoted && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => handleVote(p.id, true)}
                      style={{
                        padding: "6px 16px", borderRadius: 6, border: "1px solid #10b981",
                        background: "transparent", color: "#10b981", cursor: "pointer", fontSize: 13,
                      }}
                    >
                      Vote For
                    </button>
                    <button
                      onClick={() => handleVote(p.id, false)}
                      style={{
                        padding: "6px 16px", borderRadius: 6, border: "1px solid #ef4444",
                        background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 13,
                      }}
                    >
                      Vote Against
                    </button>
                  </div>
                )}
                {p.state === "Active" && address && p.hasVoted && (
                  <div style={{ color: "#555", fontSize: 12 }}>You have voted on this proposal.</div>
                )}
                {p.state === "Queued" && address && (
                  <button
                    onClick={() => handleExecute(p.id)}
                    style={{
                      padding: "6px 16px", borderRadius: 6, border: "none",
                      background: "#10b981", color: "#000", cursor: "pointer",
                      fontSize: 13, fontWeight: 600,
                    }}
                  >
                    Execute
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
