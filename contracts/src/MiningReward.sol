// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {NeuralMintToken} from "./NeuralMintToken.sol";

/// @title MiningReward - Distributes NMT tokens for AI tasks and PoW mining
/// @notice Implements halving schedule and PoW difficulty adjustment
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

    // --- Errors ---
    error OnlyRelayer();
    error TaskAlreadyClaimed();
    error PoWAlreadyClaimed();
    error InvalidPoW();
    error ZeroAddress();

    modifier onlyRelayer() {
        if (msg.sender != relayer) revert OnlyRelayer();
        _;
    }

    constructor(address _token, address _relayer) Ownable(msg.sender) {
        if (_token == address(0) || _relayer == address(0)) revert ZeroAddress();
        token = NeuralMintToken(_token);
        relayer = _relayer;
        lastAdjustmentTime = block.timestamp;
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

    /// @notice Called by relayer when a miner completes an AI inference task
    function submitAITask(address miner, bytes32 taskId) external onlyRelayer {
        if (claimedTasks[taskId]) revert TaskAlreadyClaimed();
        claimedTasks[taskId] = true;

        uint256 reward = currentReward();
        totalClaims++;

        token.mint(miner, reward);
        emit AITaskRewarded(miner, taskId, reward, currentEpoch());
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
}
