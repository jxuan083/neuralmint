// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {NeuralMintToken} from "../src/NeuralMintToken.sol";
import {MiningReward} from "../src/MiningReward.sol";
import {MinerStaking} from "../src/MinerStaking.sol";
import {SimpleAMM} from "../src/SimpleAMM.sol";

contract Deploy is Script {
    // Allocation constants
    uint256 constant TEAM_ALLOCATION = 3_150_000 * 1e18; // 15%
    uint256 constant LIQUIDITY_ALLOCATION = 3_150_000 * 1e18; // 15%

    function run() external {
        // Load relayer address from env (backend hot wallet)
        address relayer = vm.envAddress("RELAYER_ADDRESS");
        // Load paired token for AMM (WMATIC on Polygon)
        address pairedToken = vm.envAddress("PAIRED_TOKEN_ADDRESS");

        vm.startBroadcast();

        // 1. Deploy NeuralMintToken
        NeuralMintToken token = new NeuralMintToken();
        console.log("NeuralMintToken deployed:", address(token));

        // 2. Deploy MiningReward
        MiningReward mining = new MiningReward(address(token), relayer);
        console.log("MiningReward deployed:", address(mining));

        // 3. Set MiningReward as the authorized minter
        token.setMinter(address(mining));
        console.log("Minter set to MiningReward");

        // 4. Deploy MinerStaking
        MinerStaking staking = new MinerStaking(address(token));
        console.log("MinerStaking deployed:", address(staking));

        // 5. Deploy SimpleAMM (NMT / paired token)
        SimpleAMM amm = new SimpleAMM(address(token), pairedToken);
        console.log("SimpleAMM deployed:", address(amm));

        // 6. Mint team allocation to deployer
        token.ownerMint(msg.sender, TEAM_ALLOCATION);
        console.log("Team allocation minted:", TEAM_ALLOCATION / 1e18, "NMT");

        // 7. Mint liquidity allocation to deployer (for adding to AMM later)
        token.ownerMint(msg.sender, LIQUIDITY_ALLOCATION);
        console.log("Liquidity allocation minted:", LIQUIDITY_ALLOCATION / 1e18, "NMT");

        // 8. Lock the minter so owner can't change it
        token.lockMinter();
        console.log("Minter locked");

        vm.stopBroadcast();

        // Print summary
        console.log("--- Deployment Summary ---");
        console.log("Token:", address(token));
        console.log("Mining:", address(mining));
        console.log("Staking:", address(staking));
        console.log("AMM:", address(amm));
        console.log("Total minted to deployer:", (TEAM_ALLOCATION + LIQUIDITY_ALLOCATION) / 1e18, "NMT");
        console.log("Remaining for mining:", (21_000_000 * 1e18 - TEAM_ALLOCATION - LIQUIDITY_ALLOCATION) / 1e18, "NMT");
    }
}
