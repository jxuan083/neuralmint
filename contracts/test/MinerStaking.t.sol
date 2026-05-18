// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {NeuralMintToken} from "../src/NeuralMintToken.sol";
import {MinerStaking} from "../src/MinerStaking.sol";

contract MinerStakingTest is Test {
    NeuralMintToken public token;
    MinerStaking public staking;

    address owner = address(this);
    address miner1 = makeAddr("miner1");
    address miner2 = makeAddr("miner2");

    function setUp() public {
        token = new NeuralMintToken();
        staking = new MinerStaking(address(token));

        // Give miners some tokens to stake
        token.ownerMint(miner1, 1000 * 1e18);
        token.ownerMint(miner2, 500 * 1e18);
    }

    function test_Stake() public {
        vm.startPrank(miner1);
        token.approve(address(staking), 200 * 1e18);
        staking.stake(200 * 1e18);
        vm.stopPrank();

        assertEq(staking.stakeOf(miner1), 200 * 1e18);
        assertTrue(staking.isEligible(miner1));
        assertEq(token.balanceOf(miner1), 800 * 1e18);
    }

    function test_RevertInsufficientStake() public {
        vm.startPrank(miner1);
        token.approve(address(staking), 50 * 1e18);
        vm.expectRevert(MinerStaking.InsufficientStake.selector);
        staking.stake(50 * 1e18); // below minStake of 100
        vm.stopPrank();
    }

    function test_Unstake() public {
        vm.startPrank(miner1);
        token.approve(address(staking), 200 * 1e18);
        staking.stake(200 * 1e18);
        staking.unstake(100 * 1e18);
        vm.stopPrank();

        assertEq(staking.stakeOf(miner1), 100 * 1e18);
        assertEq(token.balanceOf(miner1), 900 * 1e18);
    }

    function test_UnstakeAll() public {
        vm.startPrank(miner1);
        token.approve(address(staking), 200 * 1e18);
        staking.stake(200 * 1e18);
        staking.unstake(200 * 1e18);
        vm.stopPrank();

        assertEq(staking.stakeOf(miner1), 0);
        assertFalse(staking.isEligible(miner1));
    }

    function test_RevertUnstakeTooMuch() public {
        vm.startPrank(miner1);
        token.approve(address(staking), 200 * 1e18);
        staking.stake(200 * 1e18);
        vm.expectRevert(MinerStaking.AmountTooLarge.selector);
        staking.unstake(300 * 1e18);
        vm.stopPrank();
    }

    function test_Slash() public {
        vm.startPrank(miner1);
        token.approve(address(staking), 200 * 1e18);
        staking.stake(200 * 1e18);
        vm.stopPrank();

        // Owner slashes miner1
        staking.slash(miner1, 50 * 1e18, "returned garbage AI response");

        assertEq(staking.stakeOf(miner1), 150 * 1e18);
        assertTrue(staking.isEligible(miner1)); // still above minStake
    }

    function test_SlashEntireStake() public {
        vm.startPrank(miner1);
        token.approve(address(staking), 200 * 1e18);
        staking.stake(200 * 1e18);
        vm.stopPrank();

        staking.slash(miner1, 999 * 1e18, "severe violation");

        assertEq(staking.stakeOf(miner1), 0);
        assertFalse(staking.isEligible(miner1));
    }

    function test_SetMinStake() public {
        staking.setMinStake(50 * 1e18);
        assertEq(staking.minStake(), 50 * 1e18);
    }

    function test_StakerCount() public {
        vm.startPrank(miner1);
        token.approve(address(staking), 200 * 1e18);
        staking.stake(200 * 1e18);
        vm.stopPrank();

        vm.startPrank(miner2);
        token.approve(address(staking), 200 * 1e18);
        staking.stake(200 * 1e18);
        vm.stopPrank();

        assertEq(staking.stakerCount(), 2);
    }
}
