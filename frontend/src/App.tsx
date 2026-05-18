import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useWallet } from "./hooks/useWallet";
import { Navbar } from "./components/Navbar";
import { DashboardPage } from "./pages/DashboardPage";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { DocsPage } from "./pages/DocsPage";
import { MinerPage } from "./pages/MinerPage";
import { SwapPage } from "./pages/SwapPage";

export default function App() {
  const wallet = useWallet();

  return (
    <BrowserRouter>
      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#eee" }}>
        <Navbar
          address={wallet.address}
          balance={wallet.balance}
          isConnecting={wallet.isConnecting}
          onConnect={wallet.connect}
          onDisconnect={wallet.disconnect}
        />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage address={wallet.address} />} />
          <Route path="/keys" element={<ApiKeysPage address={wallet.address} />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/miner" element={<MinerPage />} />
          <Route path="/swap" element={
            <SwapPage address={wallet.address} signer={wallet.signer} onBalanceRefresh={wallet.refreshBalance} />
          } />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
