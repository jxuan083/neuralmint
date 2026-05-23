// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {NeuralMintToken} from "../src/NeuralMintToken.sol";

contract NeuralMintTokenTest is Test {
    NeuralMintToken public token;
    address owner = address(this);
    address minter = makeAddr("minter");
    address user1 = makeAddr("user1");

    function setUp() public {
        token = new NeuralMintToken();
    }

    function test_InitialState() public view {
        assertEq(token.name(), "NeuralMint");
        assertEq(token.symbol(), "NMB");
        assertEq(token.totalSupply(), 0);
        assertEq(token.MAX_SUPPLY(), 21_000_000 * 1e18);
        assertEq(token.minter(), address(0));
        assertFalse(token.minterLocked());
    }

    function test_SetMinter() public {
        token.setMinter(minter);
        assertEq(token.minter(), minter);
    }

    function test_LockMinter() public {
        token.setMinter(minter);
        token.lockMinter();
        assertTrue(token.minterLocked());
    }

    function test_RevertSetMinterAfterLock() public {
        token.setMinter(minter);
        token.lockMinter();
        vm.expectRevert(NeuralMintToken.MinterAlreadyLocked.selector);
        token.setMinter(address(0x999));
    }

    function test_RevertLockWithoutMinter() public {
        vm.expectRevert(NeuralMintToken.MinterNotSet.selector);
        token.lockMinter();
    }

    function test_MinterCanMint() public {
        token.setMinter(minter);
        vm.prank(minter);
        token.mint(user1, 1000 * 1e18);
        assertEq(token.balanceOf(user1), 1000 * 1e18);
    }

    function test_RevertMintByNonMinter() public {
        token.setMinter(minter);
        vm.prank(user1);
        vm.expectRevert(NeuralMintToken.OnlyMinter.selector);
        token.mint(user1, 1000 * 1e18);
    }

    function test_OwnerMint() public {
        token.ownerMint(user1, 3_150_000 * 1e18);
        assertEq(token.balanceOf(user1), 3_150_000 * 1e18);
    }

    function test_RevertMintExceedsCap() public {
        token.setMinter(minter);

        // Owner mints 30% (team + liquidity)
        token.ownerMint(owner, 6_300_000 * 1e18);

        // Minter tries to mint beyond cap
        vm.prank(minter);
        vm.expectRevert(NeuralMintToken.ExceedsMaxSupply.selector);
        token.mint(user1, 14_700_001 * 1e18);
    }

    function test_MintUpToCap() public {
        token.setMinter(minter);
        vm.prank(minter);
        token.mint(user1, 21_000_000 * 1e18);
        assertEq(token.totalSupply(), token.MAX_SUPPLY());

        // One more wei should fail
        vm.prank(minter);
        vm.expectRevert(NeuralMintToken.ExceedsMaxSupply.selector);
        token.mint(user1, 1);
    }

    function testFuzz_MintNeverExceedsCap(uint256 amount) public {
        amount = bound(amount, 1, 21_000_000 * 1e18);
        token.setMinter(minter);
        vm.prank(minter);
        token.mint(user1, amount);
        assertLe(token.totalSupply(), token.MAX_SUPPLY());
    }
}
