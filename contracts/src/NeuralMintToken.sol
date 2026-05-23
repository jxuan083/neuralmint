// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title NeuralMintToken - Fixed-supply ERC-20 for the NeuralMint platform
/// @notice 21M total supply, only the authorized minter (MiningReward contract) can mint
contract NeuralMintToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 21_000_000 * 1e18;

    address public minter;
    bool public minterLocked;

    error MinterAlreadyLocked();
    error MinterNotSet();
    error OnlyMinter();
    error ExceedsMaxSupply();

    modifier onlyMinter() {
        if (msg.sender != minter) revert OnlyMinter();
        _;
    }

    constructor() ERC20("NeuralMint", "NMB") Ownable(msg.sender) {}

    /// @notice Set the minter address (MiningReward contract). Can only be locked once.
    function setMinter(address _minter) external onlyOwner {
        if (minterLocked) revert MinterAlreadyLocked();
        minter = _minter;
    }

    /// @notice Lock the minter so it can never be changed again
    function lockMinter() external onlyOwner {
        if (minter == address(0)) revert MinterNotSet();
        minterLocked = true;
    }

    /// @notice Mint tokens - only callable by the MiningReward contract
    function mint(address to, uint256 amount) external onlyMinter {
        if (totalSupply() + amount > MAX_SUPPLY) revert ExceedsMaxSupply();
        _mint(to, amount);
    }

    /// @notice Owner can mint the initial allocations (team + liquidity) before locking
    function ownerMint(address to, uint256 amount) external onlyOwner {
        if (totalSupply() + amount > MAX_SUPPLY) revert ExceedsMaxSupply();
        _mint(to, amount);
    }
}
