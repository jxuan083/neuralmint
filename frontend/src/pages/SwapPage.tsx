import { useState, useEffect } from "react";
import { ArrowDownUp } from "lucide-react";
import { Contract, formatEther, parseEther, JsonRpcSigner } from "ethers";
import { CONTRACTS, TOKEN_ABI, AMM_ABI } from "../services/contracts";

interface SwapPageProps {
  address: string | null;
  signer: JsonRpcSigner | null;
  onBalanceRefresh: () => void;
}

export function SwapPage({ address, signer, onBalanceRefresh }: SwapPageProps) {
  const [amountIn, setAmountIn] = useState("");
  const [amountOut, setAmountOut] = useState("");
  const [direction, setDirection] = useState<"a_to_b" | "b_to_a">("b_to_a"); // default: buy NMB
  const [reserveA, setReserveA] = useState("0");
  const [reserveB, setReserveB] = useState("0");
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    if (!signer || !CONTRACTS.AMM) return;
    const fetchReserves = async () => {
      try {
        const amm = new Contract(CONTRACTS.AMM, AMM_ABI, signer);
        const rA = await amm.reserveA();
        const rB = await amm.reserveB();
        setReserveA(formatEther(rA));
        setReserveB(formatEther(rB));
      } catch {}
    };
    fetchReserves();
  }, [signer]);

  const getQuote = async (value: string) => {
    if (!signer || !CONTRACTS.AMM || !value || parseFloat(value) <= 0) {
      setAmountOut("");
      return;
    }
    try {
      const amm = new Contract(CONTRACTS.AMM, AMM_ABI, signer);
      const tokenIn = direction === "a_to_b"
        ? await amm.tokenA()
        : await amm.tokenB();
      const out = await amm.getAmountOut(tokenIn, parseEther(value));
      setAmountOut(formatEther(out));
    } catch {
      setAmountOut("--");
    }
  };

  const handleSwap = async () => {
    if (!signer || !CONTRACTS.AMM || !amountIn) return;
    setLoading(true);
    setTxHash(null);

    try {
      const amm = new Contract(CONTRACTS.AMM, AMM_ABI, signer);
      const tokenAddress = direction === "a_to_b"
        ? await amm.tokenA()
        : await amm.tokenB();

      // Approve if selling NMB
      const tokenContract = new Contract(tokenAddress, TOKEN_ABI, signer);
      const allowance = await tokenContract.allowance(address, CONTRACTS.AMM);
      const amountWei = parseEther(amountIn);
      if (allowance < amountWei) {
        const approveTx = await tokenContract.approve(CONTRACTS.AMM, amountWei);
        await approveTx.wait();
      }

      const minOut = parseEther(amountOut) * 95n / 100n; // 5% slippage
      const tx = await amm.swap(tokenAddress, amountWei, minOut);
      const receipt = await tx.wait();
      setTxHash(receipt.hash);
      onBalanceRefresh();
    } catch (e: any) {
      alert(e.message || "Swap failed");
    } finally {
      setLoading(false);
    }
  };

  const cardStyle = {
    background: "#111",
    border: "1px solid #2a2a2a",
    borderRadius: 12,
    padding: 24,
  };

  const noContracts = !CONTRACTS.AMM;

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, color: "#eee", marginBottom: 24, textAlign: "center" }}>Swap</h1>

      <div style={cardStyle}>
        {noContracts && (
          <div style={{ color: "#f59e0b", fontSize: 13, marginBottom: 16, textAlign: "center" }}>
            Contracts not deployed yet. Set VITE_AMM_ADDRESS in .env
          </div>
        )}

        {/* From */}
        <div style={{ marginBottom: 8 }}>
          <label style={{ color: "#888", fontSize: 12 }}>From ({direction === "a_to_b" ? "NMB" : "MATIC"})</label>
          <input
            type="number"
            value={amountIn}
            onChange={(e) => {
              setAmountIn(e.target.value);
              getQuote(e.target.value);
            }}
            placeholder="0.0"
            disabled={noContracts || !address}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 8,
              border: "1px solid #2a2a2a",
              background: "#0a0a0a",
              color: "#eee",
              fontSize: 20,
              marginTop: 4,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Flip button */}
        <div style={{ display: "flex", justifyContent: "center", margin: "4px 0" }}>
          <button
            onClick={() => {
              setDirection((d) => (d === "a_to_b" ? "b_to_a" : "a_to_b"));
              setAmountIn("");
              setAmountOut("");
            }}
            style={{
              background: "#1a1a1a",
              border: "1px solid #2a2a2a",
              borderRadius: "50%",
              width: 36,
              height: 36,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#10b981",
            }}
          >
            <ArrowDownUp size={16} />
          </button>
        </div>

        {/* To */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ color: "#888", fontSize: 12 }}>To ({direction === "a_to_b" ? "MATIC" : "NMB"})</label>
          <input
            type="text"
            value={amountOut}
            readOnly
            placeholder="0.0"
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 8,
              border: "1px solid #2a2a2a",
              background: "#0a0a0a",
              color: "#10b981",
              fontSize: 20,
              marginTop: 4,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Pool info */}
        <div style={{ color: "#555", fontSize: 12, marginBottom: 16 }}>
          Pool: {parseFloat(reserveA).toFixed(2)} NMB / {parseFloat(reserveB).toFixed(2)} MATIC
        </div>

        {/* Swap button */}
        <button
          onClick={handleSwap}
          disabled={!address || !amountIn || loading || noContracts}
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 8,
            border: "none",
            background: address && amountIn && !loading ? "#10b981" : "#1a1a1a",
            color: address && amountIn && !loading ? "#000" : "#555",
            fontSize: 16,
            fontWeight: 600,
            cursor: address && amountIn && !loading ? "pointer" : "default",
          }}
        >
          {loading ? "Swapping..." : !address ? "Connect Wallet" : "Swap"}
        </button>

        {txHash && (
          <div style={{ color: "#10b981", fontSize: 12, marginTop: 12, textAlign: "center" }}>
            TX: {txHash.slice(0, 16)}...
          </div>
        )}
      </div>
    </div>
  );
}
