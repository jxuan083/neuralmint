import { Link, useLocation } from "react-router-dom";
import { Wallet, BarChart3, Key, BookOpen, Pickaxe, ArrowLeftRight, Vote } from "lucide-react";

interface NavbarProps {
  address: string | null;
  balance: string;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

const NAV_ITEMS = [
  { path: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { path: "/keys", label: "API Keys", icon: Key },
  { path: "/docs", label: "Docs", icon: BookOpen },
  { path: "/miner", label: "Mine", icon: Pickaxe },
  { path: "/swap", label: "Swap", icon: ArrowLeftRight },
  { path: "/governance", label: "DAO", icon: Vote },
];

export function Navbar({ address, balance, isConnecting, onConnect, onDisconnect }: NavbarProps) {
  const location = useLocation();

  return (
    <nav style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 24px",
      height: 60,
      borderBottom: "1px solid #2a2a2a",
      background: "#0a0a0a",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
        <Link to="/" style={{ fontSize: 20, fontWeight: 700, color: "#10b981", textDecoration: "none" }}>
          NeuralMint
        </Link>
        <div style={{ display: "flex", gap: 4 }}>
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link key={path} to={path} style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 12px",
                borderRadius: 8,
                color: active ? "#10b981" : "#888",
                background: active ? "#10b98115" : "transparent",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: active ? 600 : 400,
              }}>
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {address && (
          <span style={{ color: "#10b981", fontSize: 14, fontWeight: 600 }}>
            {parseFloat(balance).toFixed(2)} NMB
          </span>
        )}
        <button
          onClick={address ? onDisconnect : onConnect}
          disabled={isConnecting}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid #2a2a2a",
            background: address ? "#1a1a1a" : "#10b981",
            color: address ? "#ccc" : "#000",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          <Wallet size={16} />
          {isConnecting
            ? "Connecting..."
            : address
              ? `${address.slice(0, 6)}...${address.slice(-4)}`
              : "Connect Wallet"}
        </button>
      </div>
    </nav>
  );
}
