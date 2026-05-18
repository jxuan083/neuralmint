// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title SimpleAMM - Constant product AMM (x * y = k) for NMT/WMATIC trading
/// @notice Minimal DEX for the NeuralMint platform. Supports add/remove liquidity and swaps.
contract SimpleAMM {
    IERC20 public immutable tokenA; // NMT
    IERC20 public immutable tokenB; // WMATIC or any paired token

    uint256 public reserveA;
    uint256 public reserveB;

    uint256 public totalLiquidity;
    mapping(address => uint256) public liquidity;

    uint256 public constant FEE_NUMERATOR = 3; // 0.3% fee
    uint256 public constant FEE_DENOMINATOR = 1000;

    event LiquidityAdded(address indexed provider, uint256 amountA, uint256 amountB, uint256 liquidityMinted);
    event LiquidityRemoved(address indexed provider, uint256 amountA, uint256 amountB, uint256 liquidityBurned);
    event Swap(address indexed trader, address indexed tokenIn, uint256 amountIn, uint256 amountOut);

    error ZeroAmount();
    error InsufficientLiquidity();
    error InsufficientOutput();
    error InvalidToken();
    error SlippageExceeded();

    constructor(address _tokenA, address _tokenB) {
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
    }

    /// @notice Add liquidity to the pool
    /// @param amountA Amount of tokenA to add
    /// @param amountB Amount of tokenB to add
    function addLiquidity(uint256 amountA, uint256 amountB) external returns (uint256 liquidityMinted) {
        if (amountA == 0 || amountB == 0) revert ZeroAmount();

        tokenA.transferFrom(msg.sender, address(this), amountA);
        tokenB.transferFrom(msg.sender, address(this), amountB);

        if (totalLiquidity == 0) {
            // First deposit: liquidity = sqrt(amountA * amountB)
            liquidityMinted = _sqrt(amountA * amountB);
        } else {
            // Proportional deposit
            uint256 liquidityA = amountA * totalLiquidity / reserveA;
            uint256 liquidityB = amountB * totalLiquidity / reserveB;
            liquidityMinted = liquidityA < liquidityB ? liquidityA : liquidityB;
        }

        if (liquidityMinted == 0) revert ZeroAmount();

        liquidity[msg.sender] += liquidityMinted;
        totalLiquidity += liquidityMinted;
        reserveA += amountA;
        reserveB += amountB;

        emit LiquidityAdded(msg.sender, amountA, amountB, liquidityMinted);
    }

    /// @notice Remove liquidity from the pool
    /// @param liquidityAmount Amount of liquidity tokens to burn
    function removeLiquidity(uint256 liquidityAmount) external returns (uint256 amountA, uint256 amountB) {
        if (liquidityAmount == 0) revert ZeroAmount();
        if (liquidity[msg.sender] < liquidityAmount) revert InsufficientLiquidity();

        amountA = liquidityAmount * reserveA / totalLiquidity;
        amountB = liquidityAmount * reserveB / totalLiquidity;

        liquidity[msg.sender] -= liquidityAmount;
        totalLiquidity -= liquidityAmount;
        reserveA -= amountA;
        reserveB -= amountB;

        tokenA.transfer(msg.sender, amountA);
        tokenB.transfer(msg.sender, amountB);

        emit LiquidityRemoved(msg.sender, amountA, amountB, liquidityAmount);
    }

    /// @notice Swap tokenA for tokenB or vice versa
    /// @param tokenIn Address of input token (must be tokenA or tokenB)
    /// @param amountIn Amount of input token
    /// @param minAmountOut Minimum output (slippage protection)
    function swap(address tokenIn, uint256 amountIn, uint256 minAmountOut) external returns (uint256 amountOut) {
        if (amountIn == 0) revert ZeroAmount();

        bool isA = tokenIn == address(tokenA);
        bool isB = tokenIn == address(tokenB);
        if (!isA && !isB) revert InvalidToken();

        // Calculate output with 0.3% fee
        uint256 amountInWithFee = amountIn * (FEE_DENOMINATOR - FEE_NUMERATOR);

        if (isA) {
            amountOut = amountInWithFee * reserveB / (reserveA * FEE_DENOMINATOR + amountInWithFee);
            if (amountOut < minAmountOut) revert SlippageExceeded();

            tokenA.transferFrom(msg.sender, address(this), amountIn);
            tokenB.transfer(msg.sender, amountOut);

            reserveA += amountIn;
            reserveB -= amountOut;
        } else {
            amountOut = amountInWithFee * reserveA / (reserveB * FEE_DENOMINATOR + amountInWithFee);
            if (amountOut < minAmountOut) revert SlippageExceeded();

            tokenB.transferFrom(msg.sender, address(this), amountIn);
            tokenA.transfer(msg.sender, amountOut);

            reserveB += amountIn;
            reserveA -= amountOut;
        }

        emit Swap(msg.sender, tokenIn, amountIn, amountOut);
    }

    /// @notice Get expected output for a swap (view function for frontend)
    function getAmountOut(address tokenIn, uint256 amountIn) external view returns (uint256) {
        bool isA = tokenIn == address(tokenA);
        if (!isA && tokenIn != address(tokenB)) revert InvalidToken();

        uint256 amountInWithFee = amountIn * (FEE_DENOMINATOR - FEE_NUMERATOR);

        if (isA) {
            return amountInWithFee * reserveB / (reserveA * FEE_DENOMINATOR + amountInWithFee);
        } else {
            return amountInWithFee * reserveA / (reserveB * FEE_DENOMINATOR + amountInWithFee);
        }
    }

    /// @notice Get current price of tokenA in terms of tokenB
    function priceA() external view returns (uint256) {
        if (reserveA == 0) return 0;
        return reserveB * 1e18 / reserveA;
    }

    /// @notice Get current price of tokenB in terms of tokenA
    function priceB() external view returns (uint256) {
        if (reserveB == 0) return 0;
        return reserveA * 1e18 / reserveB;
    }

    /// @dev Babylonian method sqrt
    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
