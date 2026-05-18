// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {NeuralMintToken} from "../src/NeuralMintToken.sol";
import {MiningReward} from "../src/MiningReward.sol";

contract MiningRewardTest is Test {
    NeuralMintToken public token;
    MiningReward public mining;

    address owner = address(this);
    address relayer = makeAddr("relayer");
    address miner1 = makeAddr("miner1");
    address miner2 = makeAddr("miner2");

    function setUp() public {
        token = new NeuralMintToken();
        mining = new MiningReward(address(token), relayer);
        token.setMinter(address(mining));
    }

    function test_InitialState() public view {
        assertEq(mining.totalClaims(), 0);
        assertEq(mining.currentEpoch(), 0);
        assertEq(mining.currentReward(), 50 * 1e18);
        assertEq(mining.currentPoWReward(), 15 * 1e18); // 30%
        assertEq(mining.relayer(), relayer);
    }

    function test_SubmitAITask() public {
        bytes32 taskId = keccak256("task-001");

        vm.prank(relayer);
        mining.submitAITask(miner1, taskId);

        assertEq(token.balanceOf(miner1), 50 * 1e18);
        assertEq(mining.totalClaims(), 1);
        assertTrue(mining.claimedTasks(taskId));
    }

    function test_RevertDoubleClaimAITask() public {
        bytes32 taskId = keccak256("task-001");

        vm.prank(relayer);
        mining.submitAITask(miner1, taskId);

        vm.prank(relayer);
        vm.expectRevert(MiningReward.TaskAlreadyClaimed.selector);
        mining.submitAITask(miner1, taskId);
    }

    function test_RevertNonRelayerSubmit() public {
        bytes32 taskId = keccak256("task-001");

        vm.prank(miner1);
        vm.expectRevert(MiningReward.OnlyRelayer.selector);
        mining.submitAITask(miner1, taskId);
    }

    function test_HalvingAfterInterval() public {
        // Submit 10,000 tasks to trigger first halving
        vm.startPrank(relayer);
        for (uint256 i = 0; i < 10_000; i++) {
            bytes32 taskId = keccak256(abi.encodePacked("task", i));
            mining.submitAITask(miner1, taskId);
        }
        vm.stopPrank();

        // After 10,000 claims, epoch should be 1, reward should be 25
        assertEq(mining.currentEpoch(), 1);
        assertEq(mining.currentReward(), 25 * 1e18);
        assertEq(mining.currentPoWReward(), 7.5 * 1e18);
    }

    function test_MultipleHalvings() public view {
        // Test reward calculation at different epochs
        // epoch 0: 50, epoch 1: 25, epoch 2: 12.5, epoch 3: 6.25
        uint256 reward = 50 * 1e18;
        for (uint256 i = 0; i < 10; i++) {
            reward = reward / 2;
        }
        // After 10 halvings: 50 / 1024 ≈ 0.048... still above MIN_REWARD (0.001)
        assertTrue(reward > mining.MIN_REWARD());
    }

    function test_ClaimsUntilHalving() public {
        assertEq(mining.claimsUntilHalving(), 10_000);

        vm.prank(relayer);
        mining.submitAITask(miner1, keccak256("task-0"));

        assertEq(mining.claimsUntilHalving(), 9_999);
    }

    function test_SetRelayer() public {
        address newRelayer = makeAddr("newRelayer");
        mining.setRelayer(newRelayer);
        assertEq(mining.relayer(), newRelayer);
    }

    function test_RevertSetRelayerZero() public {
        vm.expectRevert(MiningReward.ZeroAddress.selector);
        mining.setRelayer(address(0));
    }
}
