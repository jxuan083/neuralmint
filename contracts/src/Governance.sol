// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Governance - DAO governance for NeuralMint platform
/// @notice NMB holders propose and vote on parameter changes.
///         1 NMB = 1 vote (current balance, no snapshot).
///         Voting period: 3 days. Timelock: 1 day. Quorum: 100,000 NMB.
contract Governance {
    IERC20 public immutable token;

    uint256 public constant VOTING_PERIOD = 3 days;
    uint256 public constant TIMELOCK_DELAY = 1 days;
    uint256 public constant QUORUM = 100_000 * 1e18; // 100k NMB
    uint256 public constant PROPOSAL_THRESHOLD = 1_000 * 1e18; // 1k NMB to propose

    enum ProposalState { Pending, Active, Defeated, Succeeded, Queued, Executed, Canceled }

    struct Proposal {
        uint256 id;
        address proposer;
        string description;
        address target;
        bytes callData;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 startTime;
        uint256 endTime;
        uint256 eta;        // earliest execution time (endTime + TIMELOCK_DELAY)
        bool executed;
        bool canceled;
    }

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    // --- Events ---
    event ProposalCreated(
        uint256 indexed id,
        address indexed proposer,
        address target,
        bytes callData,
        string description,
        uint256 startTime,
        uint256 endTime
    );
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCanceled(uint256 indexed proposalId);

    // --- Errors ---
    error BelowProposalThreshold();
    error VotingNotActive();
    error AlreadyVoted();
    error ProposalNotSucceeded();
    error TimelockNotExpired();
    error ExecutionFailed();
    error OnlyProposer();
    error AlreadyExecutedOrCanceled();

    constructor(address _token) {
        token = IERC20(_token);
    }

    // =========================================================================
    //                              PROPOSE
    // =========================================================================

    /// @notice Create a new governance proposal
    /// @param description Human-readable description of the proposal
    /// @param target Contract address to call upon execution
    /// @param callData ABI-encoded function call to execute
    function propose(
        string calldata description,
        address target,
        bytes calldata callData
    ) external returns (uint256) {
        if (token.balanceOf(msg.sender) < PROPOSAL_THRESHOLD) revert BelowProposalThreshold();

        uint256 id = ++proposalCount;
        uint256 start = block.timestamp;
        uint256 end = start + VOTING_PERIOD;

        proposals[id] = Proposal({
            id: id,
            proposer: msg.sender,
            description: description,
            target: target,
            callData: callData,
            forVotes: 0,
            againstVotes: 0,
            startTime: start,
            endTime: end,
            eta: end + TIMELOCK_DELAY,
            executed: false,
            canceled: false
        });

        emit ProposalCreated(id, msg.sender, target, callData, description, start, end);
        return id;
    }

    // =========================================================================
    //                                VOTE
    // =========================================================================

    /// @notice Cast a vote on an active proposal
    /// @param proposalId The proposal to vote on
    /// @param support True = for, False = against
    function vote(uint256 proposalId, bool support) external {
        if (state(proposalId) != ProposalState.Active) revert VotingNotActive();
        if (hasVoted[proposalId][msg.sender]) revert AlreadyVoted();

        uint256 weight = token.balanceOf(msg.sender);
        hasVoted[proposalId][msg.sender] = true;

        Proposal storage p = proposals[proposalId];
        if (support) {
            p.forVotes += weight;
        } else {
            p.againstVotes += weight;
        }

        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    // =========================================================================
    //                               EXECUTE
    // =========================================================================

    /// @notice Execute a succeeded proposal after timelock expires
    function execute(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        if (p.executed || p.canceled) revert AlreadyExecutedOrCanceled();
        if (state(proposalId) != ProposalState.Queued) revert ProposalNotSucceeded();
        if (block.timestamp < p.eta) revert TimelockNotExpired();

        p.executed = true;

        (bool success,) = p.target.call(p.callData);
        if (!success) revert ExecutionFailed();

        emit ProposalExecuted(proposalId);
    }

    /// @notice Cancel a proposal (only proposer, only before execution)
    function cancel(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        if (msg.sender != p.proposer) revert OnlyProposer();
        if (p.executed) revert AlreadyExecutedOrCanceled();

        p.canceled = true;
        emit ProposalCanceled(proposalId);
    }

    // =========================================================================
    //                              STATE / VIEWS
    // =========================================================================

    /// @notice Get the current state of a proposal
    function state(uint256 proposalId) public view returns (ProposalState) {
        Proposal storage p = proposals[proposalId];

        if (p.canceled) return ProposalState.Canceled;
        if (p.executed) return ProposalState.Executed;

        if (block.timestamp < p.startTime) return ProposalState.Pending;
        if (block.timestamp <= p.endTime) return ProposalState.Active;

        // Voting ended — check quorum and majority
        bool quorumReached = (p.forVotes + p.againstVotes) >= QUORUM;
        bool majorityFor = p.forVotes > p.againstVotes;

        if (!quorumReached || !majorityFor) return ProposalState.Defeated;

        // Passed — check timelock
        if (block.timestamp < p.eta) return ProposalState.Succeeded;

        return ProposalState.Queued;
    }

    /// @notice Get full proposal details
    function getProposal(uint256 proposalId) external view returns (
        address proposer,
        string memory description,
        address target,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 startTime,
        uint256 endTime,
        uint256 eta,
        bool executed,
        bool canceled
    ) {
        Proposal storage p = proposals[proposalId];
        return (
            p.proposer,
            p.description,
            p.target,
            p.forVotes,
            p.againstVotes,
            p.startTime,
            p.endTime,
            p.eta,
            p.executed,
            p.canceled
        );
    }

    /// @notice Get all proposal IDs (1..proposalCount)
    function getAllProposals() external view returns (uint256[] memory) {
        uint256[] memory ids = new uint256[](proposalCount);
        for (uint256 i = 0; i < proposalCount; i++) {
            ids[i] = i + 1;
        }
        return ids;
    }
}
