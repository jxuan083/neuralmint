// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MinerStaking - Stake NMT tokens to become eligible for AI tasks
/// @notice Miners must stake tokens to receive AI inference tasks. Misbehavior leads to slashing.
contract MinerStaking is Ownable {
    IERC20 public immutable token;

    uint256 public minStake = 100 * 1e18; // minimum 100 NMT to stake

    struct StakeInfo {
        uint256 amount;
        uint256 stakedAt;
        bool isActive;
    }

    mapping(address => StakeInfo) public stakes;
    address[] public stakers;

    event Staked(address indexed miner, uint256 amount, uint256 totalStake);
    event Unstaked(address indexed miner, uint256 amount, uint256 remaining);
    event Slashed(address indexed miner, uint256 amount, string reason);
    event MinStakeUpdated(uint256 oldMin, uint256 newMin);

    error InsufficientStake();
    error InsufficientBalance();
    error NotStaked();
    error AmountTooLarge();

    constructor(address _token) Ownable(msg.sender) {
        token = IERC20(_token);
    }

    /// @notice Stake NMT tokens to become an active miner
    function stake(uint256 amount) external {
        token.transferFrom(msg.sender, address(this), amount);

        StakeInfo storage info = stakes[msg.sender];
        if (!info.isActive) {
            stakers.push(msg.sender);
            info.isActive = true;
            info.stakedAt = block.timestamp;
        }
        info.amount += amount;

        if (info.amount < minStake) revert InsufficientStake();

        emit Staked(msg.sender, amount, info.amount);
    }

    /// @notice Unstake tokens (no cooldown for demo simplicity)
    function unstake(uint256 amount) external {
        StakeInfo storage info = stakes[msg.sender];
        if (!info.isActive) revert NotStaked();
        if (amount > info.amount) revert AmountTooLarge();

        info.amount -= amount;
        if (info.amount == 0) {
            info.isActive = false;
        }

        token.transfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount, info.amount);
    }

    /// @notice Slash a miner's stake (called by owner/backend for cheating)
    function slash(address miner, uint256 amount, string calldata reason) external onlyOwner {
        StakeInfo storage info = stakes[miner];
        if (!info.isActive) revert NotStaked();

        uint256 slashAmount = amount > info.amount ? info.amount : amount;
        info.amount -= slashAmount;
        if (info.amount == 0) {
            info.isActive = false;
        }

        // Slashed tokens are burned (sent to zero address effectively stay in contract)
        // For simplicity, they stay in the contract as "treasury"
        emit Slashed(miner, slashAmount, reason);
    }

    /// @notice Check if a miner has sufficient stake to receive AI tasks
    function isEligible(address miner) external view returns (bool) {
        return stakes[miner].isActive && stakes[miner].amount >= minStake;
    }

    /// @notice Get stake amount for a miner
    function stakeOf(address miner) external view returns (uint256) {
        return stakes[miner].amount;
    }

    /// @notice Update minimum stake requirement
    function setMinStake(uint256 _minStake) external onlyOwner {
        emit MinStakeUpdated(minStake, _minStake);
        minStake = _minStake;
    }

    /// @notice Total number of stakers (including inactive)
    function stakerCount() external view returns (uint256) {
        return stakers.length;
    }
}
