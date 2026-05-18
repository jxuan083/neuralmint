import { useState, useCallback, useEffect } from "react";
import { BrowserProvider, JsonRpcSigner, Contract, formatEther } from "ethers";
import { CONTRACTS, TOKEN_ABI } from "../services/contracts";
import { api } from "../services/api";

declare global {
  interface Window {
    ethereum?: any;
  }
}

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [balance, setBalance] = useState<string>("0");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError("Please install MetaMask");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const prov = new BrowserProvider(window.ethereum);
      const sign = await prov.getSigner();
      const addr = await sign.getAddress();

      setProvider(prov);
      setSigner(sign);
      setAddress(addr.toLowerCase());

      // Authenticate with backend
      const challenge = await api.getChallenge(addr);
      const signature = await sign.signMessage(challenge.message);
      const auth = await api.verifyAuth(addr, signature, challenge.message);
      localStorage.setItem("nmt_token", auth.access_token);
    } catch (e: any) {
      setError(e.message || "Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setSigner(null);
    setProvider(null);
    setBalance("0");
    localStorage.removeItem("nmt_token");
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!address || !provider || !CONTRACTS.TOKEN) return;
    try {
      const token = new Contract(CONTRACTS.TOKEN, TOKEN_ABI, provider);
      const raw = await token.balanceOf(address);
      setBalance(formatEther(raw));
    } catch {
      // Contract not deployed yet, try API
      try {
        const data = await api.getBalance(address);
        setBalance(data.balance);
      } catch {
        setBalance("0");
      }
    }
  }, [address, provider]);

  useEffect(() => {
    if (address) refreshBalance();
  }, [address, refreshBalance]);

  // Listen for account changes
  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) disconnect();
      else setAddress(accounts[0].toLowerCase());
    };
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    return () => window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
  }, [disconnect]);

  return {
    address,
    signer,
    provider,
    balance,
    isConnecting,
    error,
    connect,
    disconnect,
    refreshBalance,
  };
}
