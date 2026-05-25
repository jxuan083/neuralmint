// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {NeuralMintToken} from "./NeuralMintToken.sol";

/// @title MiningReward - Distributes NMT tokens for AI tasks and PoW mining
/// @notice Implements halving schedule, dynamic pricing, minimum online rewards, and capacity incentives
contract MiningReward is Ownable {
    NeuralMintToken public immutable token;

    // --- Halving ---
    uint256 public constant INITIAL_REWARD = 50 * 1e18;
    uint256 public constant HALVING_INTERVAL = 10_000;
    uint256 public constant MIN_REWARD = 1e15; // 0.001 NMT floor
    uint256 public totalClaims;

    // --- PoW ---
    uint256 public constant POW_REWARD_PCT = 30; // 30% of AI reward
    uint256 public difficulty = type(uint256).max / 1_000_000; // initial easy difficulty
    uint256 public constant DIFFICULTY_ADJUST_INTERVAL = 100;
    uint256 public constant TARGET_INTERVAL = 60; // 60 seconds per 100 PoW solutions
    uint256 public powCount;
    uint256 public lastAdjustmentTime;

    // =========================================================================
    //                        RULE 1: DYNAMIC PRICING
    // =========================================================================
    // NMT cost charged per AI task. Starts at 35 NMT (calibrated for ~365-day
    // first halving). Auto-adjusts ±10% every COST_ADJUST_INTERVAL tasks based
    // on whether observed demand is above or below the target rate.

    uint256 public costPerTask = 35 * 1e18;          // initial: 35 NMT
    uint256 public constant COST_MIN = 10 * 1e18;    // floor: 10 NMT
    uint256 public constant COST_MAX = 200 * 1e18;   // ceiling: 200 NMT
    uint256 public constant COST_ADJUST_INTERVAL = 100; // adjust every 100 tasks
    uint256 public constant COST_TARGET_DAILY = 100; // target tasks/day for neutral pricing
    uint256 public lastCostAdjustClaims;
    uint256 public lastCostAdjustTime;

    // =========================================================================
    //                   RULE 2: MINIMUM ONLINE REWARD
    // =========================================================================
    // Miners can claim a small base reward once per day just for staying online,
    // preventing ROI from going negative and triggering an exodus.

    uint256 public constant MIN_ONLINE_REWARD = 5e17; // 0.5 NMT per heartbeat
    uint256 public constant HEARTBEAT_INTERVAL = 86400; // 1 claim per 24 hours
    mapping(address => uint256) public lastHeartbeat;

    // =========================================================================
    //                   RULE 3: CAPACITY INCENTIVE (miner/DAU ratio)
    // =========================================================================
    // When miner count falls behind DAU growth (DAU/miner ratio > 2.5),
    // the relayer activates a capacity bonus that multiplies AI task rewards.
    // Ensures miner growth rate stays at least 40% of DAU growth.

    bool public capacityBonusActive;
    uint256 public capacityBonusMultiplierBps = 15000; // 150% of normal reward when active

    // --- Anti-replay ---
    mapping(bytes32 => bool) public claimedTasks;
    mapping(bytes32 => bool) public claimedPoW;

    // --- Authorized relayer (backend hot wallet) ---
    address public relayer;

    // --- Events ---
    event AITaskRewarded(address indexed miner, bytes32 indexed taskId, uint256 reward, uint256 epoch);
    event PoWRewarded(address indexed miner, bytes32 indexed nonce, uint256 reward);
    event DifficultyAdjusted(uint256 oldDifficulty, uint256 newDifficulty);
    event RelayerUpdated(address indexed oldRelayer, address indexed newRelayer);
    event CostAdjusted(uint256 oldCost, uint256 newCost);
    event OnlineRewarded(address indexed miner, uint256 reward);
    event CapacityBonusToggled(bool active, uint256 multiplierBps);

    // --- Errors ---
    error OnlyRelayer();
    error TaskAlreadyClaimed();
    error PoWAlreadyClaimed();
    error InvalidPoW();
    error ZeroAddress();
    error HeartbeatTooSoon();
    error InvalidMultiplier();

    modifier onlyRelayer() {
        if (msg.sender != relayer) revert OnlyRelayer();
        _;
    }

    constructor(address _token, address _relayer) Ownable(msg.sender) {
        if (_token == address(0) || _relayer == address(0)) revert ZeroAddress();
        token = NeuralMintToken(_token);
        relayer = _relayer;
        lastAdjustmentTime = block.timestamp;
        lastCostAdjustTime = block.timestamp;
    }

    /// @notice Update relayer address
    function setRelayer(address _relayer) external onlyOwner {
        if (_relayer == address(0)) revert ZeroAddress();
        emit RelayerUpdated(relayer, _relayer);
        relayer = _relayer;
    }

    // =========================================================================
    //                              HALVING LOGIC
    // =========================================================================

    /// @notice Current epoch (number of halvings that have occurred)
    function currentEpoch() public view returns (uint256) {
        return totalClaims / HALVING_INTERVAL;
    }

    /// @notice Current reward per AI task
    function currentReward() public view returns (uint256) {
        uint256 epoch = currentEpoch();
        uint256 reward = INITIAL_REWARD;
        for (uint256 i = 0; i < epoch; i++) {
            reward = reward / 2;
            if (reward < MIN_REWARD) return MIN_REWARD;
        }
        return reward;
    }

    /// @notice Current reward for a PoW solution (30% of AI reward)
    function currentPoWReward() public view returns (uint256) {
        return currentReward() * POW_REWARD_PCT / 100;
    }

    // =========================================================================
    //                            AI TASK MINING
    // =========================================================================

    /// @notice Called by relayer when a miner completes an AI inference task.
    ///         Applies capacity bonus if active, then adjusts cost every 100 tasks.
    function submitAITask(address miner, bytes32 taskId) external onlyRelayer {
        if (claimedTasks[taskId]) revert TaskAlreadyClaimed();
        claimedTasks[taskId] = true;

        uint256 reward = currentReward();

        // Rule 3: capacity bonus multiplier when miner/DAU ratio is too low
        if (capacityBonusActive) {
            reward = reward * capacityBonusMultiplierBps / 10000;
        }

        totalClaims++;

        // Rule 1: trigger dynamic cost adjustment every COST_ADJUST_INTERVAL tasks
        if (totalClaims % COST_ADJUST_INTERVAL == 0) {
            _adjustCost();
        }

        token.mint(miner, reward);
        emit AITaskRewarded(miner, taskId, reward, currentEpoch());
    }

    // =========================================================================
    //                   RULE 1 IMPLEMENTATION: DYNAMIC COST
    // =========================================================================

    /// @dev Adjust costPerTask based on observed demand vs target rate.
    ///      If demand > 110% of target → raise 10%. If < 90% → lower 10%.
    function _adjustCost() internal {
        uint256 elapsed = block.timestamp - lastCostAdjustTime;
        if (elapsed == 0) return;

        uint256 claimsInWindow = totalClaims - lastCostAdjustClaims;
        // scale target to the elapsed window
        uint256 expectedClaims = COST_TARGET_DAILY * elapsed / 86400;
        if (expectedClaims == 0) expectedClaims = 1;

        uint256 oldCost = costPerTask;

        if (claimsInWindow > expectedClaims * 110 / 100) {
            // demand is high: raise cost by 10%
            costPerTask = costPerTask * 110 / 100;
            if (costPerTask > COST_MAX) costPerTask = COST_MAX;
        } else if (claimsInWindow < expectedClaims * 90 / 100) {
            // demand is low: lower cost by 10%
            costPerTask = costPerTask * 90 / 100;
            if (costPerTask < COST_MIN) costPerTask = COST_MIN;
        }

        lastCostAdjustTime = block.timestamp;
        lastCostAdjustClaims = totalClaims;

        if (costPerTask != oldCost) {
            emit CostAdjusted(oldCost, costPerTask);
        }
    }

    // =========================================================================
    //                   RULE 2 IMPLEMENTATION: ONLINE HEARTBEAT
    // =========================================================================

    /// @notice Miner calls once per day to claim minimum online reward (0.5 NMT).
    ///         Fills the ROI floor so miners don't leave during low-demand periods.
    function submitHeartbeat() external {
        if (block.timestamp < lastHeartbeat[msg.sender] + HEARTBEAT_INTERVAL) {
            revert HeartbeatTooSoon();
        }
        lastHeartbeat[msg.sender] = block.timestamp;
        token.mint(msg.sender, MIN_ONLINE_REWARD);
        emit OnlineRewarded(msg.sender, MIN_ONLINE_REWARD);
    }

    // =========================================================================
    //                   RULE 3 IMPLEMENTATION: CAPACITY BONUS
    // =========================================================================

    /// @notice Relayer toggles capacity bonus when DAU/miner ratio exceeds 2.5.
    ///         Bonus multiplies AI task rewards (default 150%) to attract more miners.
    /// @param active       True to activate bonus, false to deactivate
    /// @param multiplierBps Reward multiplier in basis points (e.g. 15000 = 150%)
    function setCapacityBonus(bool active, uint256 multiplierBps) external onlyRelayer {
        if (multiplierBps < 10000) revert InvalidMultiplier(); // must be >= 100%
        capacityBonusActive = active;
        capacityBonusMultiplierBps = multiplierBps;
        emit CapacityBonusToggled(active, multiplierBps);
    }

    // =========================================================================
    //                              PoW MINING
    // =========================================================================

    /// @notice Miner submits a PoW solution. Validated on-chain.
    /// @param nonce The nonce that produces a valid hash
    function submitPoW(uint256 nonce) external {
        bytes32 hash = keccak256(abi.encodePacked(msg.sender, blockhash(block.number - 1), nonce));
        if (uint256(hash) > difficulty) revert InvalidPoW();

        // Anti-replay: hash the full solution as key
        bytes32 solKey = keccak256(abi.encodePacked(msg.sender, nonce, block.number));
        if (claimedPoW[solKey]) revert PoWAlreadyClaimed();
        claimedPoW[solKey] = true;

        uint256 reward = currentPoWReward();
        totalClaims++;
        powCount++;

        token.mint(msg.sender, reward);
        emit PoWRewarded(msg.sender, bytes32(nonce), reward);

        // Adjust difficulty every DIFFICULTY_ADJUST_INTERVAL PoW solutions
        if (powCount % DIFFICULTY_ADJUST_INTERVAL == 0) {
            _adjustDifficulty();
        }
    }

    /// @dev Adjust difficulty based on time elapsed vs target
    function _adjustDifficulty() internal {
        uint256 elapsed = block.timestamp - lastAdjustmentTime;
        uint256 oldDifficulty = difficulty;

        if (elapsed < TARGET_INTERVAL) {
            // Too fast: make harder (lower difficulty threshold)
            difficulty = difficulty * TARGET_INTERVAL / elapsed / 2;
        } else {
            // Too slow: make easier (higher difficulty threshold)
            difficulty = difficulty * elapsed / TARGET_INTERVAL * 2;
            // Cap at initial difficulty
            if (difficulty > type(uint256).max / 1_000_000) {
                difficulty = type(uint256).max / 1_000_000;
            }
        }

        lastAdjustmentTime = block.timestamp;
        emit DifficultyAdjusted(oldDifficulty, difficulty);
    }

    // =========================================================================
    //                              VIEW HELPERS
    // =========================================================================

    /// @notice How many claims remain in the current epoch before next halving
    function claimsUntilHalving() external view returns (uint256) {
        return HALVING_INTERVAL - (totalClaims % HALVING_INTERVAL);
    }

    /// @notice Total NMT minted through mining so far
    function totalMined() external view returns (uint256) {
        return token.totalSupply();
    }

    /// @notice Current pricing state summary
    function pricingState() external view returns (
        uint256 _costPerTask,
        uint256 _costMin,
        uint256 _costMax,
        bool _capacityBonusActive,
        uint256 _capacityMultiplierBps
    ) {
        return (costPerTask, COST_MIN, COST_MAX, capacityBonusActive, capacityBonusMultiplierBps);
    }
}
