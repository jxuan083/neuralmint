// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {Governance} from "../src/Governance.sol";
import {NeuralMintToken} from "../src/NeuralMintToken.sol";
import {MinerStaking} from "../src/MinerStaking.sol";

contract GovernanceTest is Test {
    Governance public gov;
    NeuralMintToken public token;
    MinerStaking public staking;

    address owner = address(this);
    address proposer = makeAddr("proposer");
    address voter1 = makeAddr("voter1");
    address voter2 = makeAddr("voter2");

    uint256 constant THRESHOLD = 1_000 * 1e18;
    uint256 constant QUORUM = 100_000 * 1e18;

    function setUp() public {
        token = new NeuralMintToken();
        gov = new Governance(address(token));
        staking = new MinerStaking(address(token));

        // Fund participants
        token.ownerMint(proposer, THRESHOLD + 1e18);
        token.ownerMint(voter1, 80_000 * 1e18);
        token.ownerMint(voter2, 30_000 * 1e18);
    }

    // --- Propose ---

    function test_Propose() public {
        vm.prank(proposer);
        uint256 id = gov.propose("Set min stake to 50 NMB", address(staking), _setMinStakeCall(50 * 1e18));
        assertEq(id, 1);
        assertEq(gov.proposalCount(), 1);
    }

    function test_RevertProposeBelowThreshold() public {
        address poor = makeAddr("poor");
        token.ownerMint(poor, THRESHOLD - 1);
        vm.prank(poor);
        vm.expectRevert(Governance.BelowProposalThreshold.selector);
        gov.propose("Test", address(staking), "");
    }

    // --- State ---

    function test_StateActive() public {
        _createProposal();
        assertEq(uint8(gov.state(1)), uint8(Governance.ProposalState.Active));
    }

    function test_StateDefeatedNoQuorum() public {
        _createProposal();
        // Vote but not enough for quorum
        vm.prank(voter1);
        gov.vote(1, true); // 80k < 100k quorum

        vm.warp(block.timestamp + 3 days + 1);
        assertEq(uint8(gov.state(1)), uint8(Governance.ProposalState.Defeated));
    }

    function test_StateSucceeded() public {
        _createProposal();
        _reachQuorum(true);
        vm.warp(block.timestamp + 3 days + 1);
        assertEq(uint8(gov.state(1)), uint8(Governance.ProposalState.Succeeded));
    }

    function test_StateQueued() public {
        _createProposal();
        _reachQuorum(true);
        vm.warp(block.timestamp + 3 days + 1 days + 1);
        assertEq(uint8(gov.state(1)), uint8(Governance.ProposalState.Queued));
    }

    // --- Vote ---

    function test_VoteFor() public {
        _createProposal();
        vm.prank(voter1);
        gov.vote(1, true);
        (,,,uint256 forVotes,,,,,, ) = gov.getProposal(1);
        assertEq(forVotes, 80_000 * 1e18);
    }

    function test_VoteAgainst() public {
        _createProposal();
        vm.prank(voter1);
        gov.vote(1, false);
        (,,,,uint256 againstVotes,,,,, ) = gov.getProposal(1);
        assertEq(againstVotes, 80_000 * 1e18);
    }

    function test_RevertDoubleVote() public {
        _createProposal();
        vm.prank(voter1);
        gov.vote(1, true);
        vm.prank(voter1);
        vm.expectRevert(Governance.AlreadyVoted.selector);
        gov.vote(1, true);
    }

    function test_RevertVoteAfterPeriod() public {
        _createProposal();
        vm.warp(block.timestamp + 3 days + 1);
        vm.prank(voter1);
        vm.expectRevert(Governance.VotingNotActive.selector);
        gov.vote(1, true);
    }

    // --- Execute ---

    function test_Execute() public {
        // Transfer staking ownership to governance
        staking.transferOwnership(address(gov));

        _createProposal();
        _reachQuorum(true);
        vm.warp(block.timestamp + 3 days + 1 days + 1);

        gov.execute(1);

        assertEq(uint8(gov.state(1)), uint8(Governance.ProposalState.Executed));
        assertEq(staking.minStake(), 50 * 1e18);
    }

    function test_RevertExecuteTimelockNotExpired() public {
        staking.transferOwnership(address(gov));
        _createProposal();
        _reachQuorum(true);
        vm.warp(block.timestamp + 3 days + 1); // Succeeded, but timelock not done

        vm.expectRevert(Governance.ProposalNotSucceeded.selector);
        gov.execute(1);
    }

    // --- Cancel ---

    function test_Cancel() public {
        _createProposal();
        vm.prank(proposer);
        gov.cancel(1);
        assertEq(uint8(gov.state(1)), uint8(Governance.ProposalState.Canceled));
    }

    function test_RevertCancelByNonProposer() public {
        _createProposal();
        vm.prank(voter1);
        vm.expectRevert(Governance.OnlyProposer.selector);
        gov.cancel(1);
    }

    // --- Helpers ---

    function _createProposal() internal returns (uint256) {
        vm.prank(proposer);
        return gov.propose("Set min stake to 50 NMB", address(staking), _setMinStakeCall(50 * 1e18));
    }

    function _reachQuorum(bool support) internal {
        vm.prank(voter1);
        gov.vote(1, support); // 80k
        vm.prank(voter2);
        gov.vote(1, support); // 30k → total 110k > 100k quorum
    }

    function _setMinStakeCall(uint256 amount) internal pure returns (bytes memory) {
        return abi.encodeWithSignature("setMinStake(uint256)", amount);
    }
}
