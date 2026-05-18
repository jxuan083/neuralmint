export interface MinerInfo {
  address: string;
  gpu_name: string | null;
  gpu_memory_mb: number | null;
  model_loaded: string | null;
  status: "online" | "busy" | "offline";
  tasks_completed: number;
  tokens_earned: number;
}

export interface TokenStats {
  total_supply: string;
  max_supply: string;
  circulating: string;
  total_mined: string;
  current_reward: string;
  current_epoch: number;
  claims_until_halving: number;
  active_miners: number;
  pow_difficulty: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  miner?: string;
}
