// Contract addresses - update after deployment
export const CONTRACTS = {
  TOKEN: import.meta.env.VITE_TOKEN_ADDRESS || "",
  MINING_REWARD: import.meta.env.VITE_MINING_REWARD_ADDRESS || "",
  MINER_STAKING: import.meta.env.VITE_MINER_STAKING_ADDRESS || "",
  AMM: import.meta.env.VITE_AMM_ADDRESS || "",
};

// Minimal ABIs for frontend interaction
export const TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function MAX_SUPPLY() view returns (uint256)",
];

export const STAKING_ABI = [
  "function stake(uint256 amount) external",
  "function unstake(uint256 amount) external",
  "function stakeOf(address miner) view returns (uint256)",
  "function isEligible(address miner) view returns (bool)",
  "function minStake() view returns (uint256)",
];

export const AMM_ABI = [
  "function reserveA() view returns (uint256)",
  "function reserveB() view returns (uint256)",
  "function tokenA() view returns (address)",
  "function tokenB() view returns (address)",
  "function swap(address tokenIn, uint256 amountIn, uint256 minAmountOut) returns (uint256)",
  "function getAmountOut(address tokenIn, uint256 amountIn) view returns (uint256)",
  "function addLiquidity(uint256 amountA, uint256 amountB) returns (uint256)",
  "function removeLiquidity(uint256 liquidityAmount) returns (uint256, uint256)",
  "function liquidity(address) view returns (uint256)",
  "function totalLiquidity() view returns (uint256)",
  "function priceA() view returns (uint256)",
  "function priceB() view returns (uint256)",
];

export const MINING_ABI = [
  "function currentReward() view returns (uint256)",
  "function currentPoWReward() view returns (uint256)",
  "function currentEpoch() view returns (uint256)",
  "function claimsUntilHalving() view returns (uint256)",
  "function totalClaims() view returns (uint256)",
  "function difficulty() view returns (uint256)",
];
